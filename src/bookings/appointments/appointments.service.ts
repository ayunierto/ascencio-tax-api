import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { calendar_v3 } from 'googleapis';
import { User } from '../../auth/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { Schedule } from 'src/bookings/schedules/entities/schedule.entity';
import { CalendarService } from 'src/calendar/calendar.service';
import { ZoomService } from 'src/zoom/zoom.service';
import { DateTime, Interval } from 'luxon';
import { NotificationService } from 'src/notification/notification.service';
import { SystemSettingsService } from 'src/system-settings/system-settings.service';
import { CalendarConnectionService } from 'src/calendar/calendar-connection.service';
import {
  formatAppointmentDescription,
  isWithinWorkingHours,
  getZoomMeetingConfig,
  validateWorkingHours,
  validateDatesForUpdate,
  validateTimeZone,
} from './utils/appointment.utils';
import { AppointmentHelper } from './helpers/appointment.helper';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ServicesService } from '../services/services.service';
import { StaffMembersService } from '../staff-members/staff-members.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BookingsMessages,
  CancelAppointmentRequest,
  CommonMessages,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from '@ascencio/shared';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  private readonly appointmentHelper: AppointmentHelper;

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    private readonly zoomService: ZoomService,
    private readonly calendarService: CalendarService,
    private readonly calendarConnectionService: CalendarConnectionService,
    private readonly notificationService: NotificationService,
    private readonly servicesService: ServicesService,
    private readonly staffService: StaffMembersService,
    private readonly settingsService: SystemSettingsService,
  ) {
    this.appointmentHelper = new AppointmentHelper(
      this.scheduleRepository,
      this.staffService,
      this.servicesService,
    );
  }

  async create(
    createAppointmentDto: CreateAppointmentRequest,
    user: User,
  ): Promise<Appointment> {
    try {
      const {
        staffId,
        serviceId,
        startTimeUTC,
        endTimeUTC,
        timeZone,
        ...rest
      } = createAppointmentDto;

      // Obtener timezone de negocio con fallback profesional
      const defaultBusinessTz =
        process.env.BUSINESS_TZ ?? process.env.BUSINESS_TIMEZONE ?? 'UTC';
      const businessTimeZone = await this.settingsService.findOneOrDefault(
        'timezone',
        defaultBusinessTz,
      );

      // Validar la zona horaria
      const validatedTimeZone = validateTimeZone(timeZone);

      // 1. Obtener servicio y personal
      const { service, staff } =
        await this.appointmentHelper.getServiceAndStaff(serviceId, staffId);

      // 2. Set appointment start and end date and time
      const startDateAndTime = DateTime.fromISO(startTimeUTC, {
        zone: 'utc',
      });
      const endDateAndTime = DateTime.fromISO(endTimeUTC, {
        zone: 'utc',
      });

      // Validar fechas
      validateDatesForUpdate(startDateAndTime, endDateAndTime, null, null);

      const startIso = startDateAndTime.setZone(validatedTimeZone).toISO();
      const endIso = endDateAndTime.setZone(validatedTimeZone).toISO();
      if (!startIso || !endIso) {
        throw new BadRequestException('Invalid appointment date range');
      }

      const businessStartDateAndTime =
        startDateAndTime.setZone(businessTimeZone);

      // 3. Validar horario y obtener schedules del día
      const schedules = await this.appointmentHelper.validateAndGetSchedules(
        staffId,
        businessStartDateAndTime,
      );

      // 4. Validar horas laborales contra cualquier horario del día
      const matchingSchedule = schedules.find((schedule) =>
        isWithinWorkingHours(
          schedule,
          startDateAndTime,
          endDateAndTime,
          businessTimeZone,
        ),
      );

      if (!matchingSchedule) {
        // Reutilizar el error existente para mantener mensajes consistentes.
        validateWorkingHours(
          schedules[0],
          startDateAndTime,
          endDateAndTime,
          businessTimeZone,
        );
      }

      // 5.1 Validar conflictos con eventos externos de calendario
      await this.assertNoCalendarConflicts(
        startDateAndTime,
        endDateAndTime,
        businessTimeZone,
        staff.id,
      );

      // 5. Verificar conflictos con otras citas
      const overlappingAppointment = await this.appointmentsRepository.findOne({
        where: {
          staffMember: { id: staffId },
          start: LessThan(endDateAndTime.toJSDate()),
          end: MoreThan(startDateAndTime.toJSDate()),
        },
      });

      if (overlappingAppointment) {
        throw new ConflictException(
          'The selected time slot is not available. Please choose another time.',
        );
      }

      await this.assertNoUserAppointmentConflicts(
        user.id,
        startDateAndTime,
        endDateAndTime,
      );

      // 6. Crear reunión de Zoom
      const meeting = this.normalizeZoomMeeting(
        await this.zoomService.createZoomMeeting(
          getZoomMeetingConfig(service.name, startIso, validatedTimeZone),
        ),
      );

      // 7. Crear evento en el calendario
      const calendarEventBody = {
        summary: `Appointment: ${service.name}`,
        location: service.address,
        description: formatAppointmentDescription(
          meeting.joinUrl ?? '',
          staff.firstName,
          staff.lastName,
          user.firstName,
          user.lastName,
          user.email,
          user.phoneNumber ?? '',
        ),
        start: {
          dateTime: startIso,
          timeZone: validatedTimeZone,
        },
        end: {
          dateTime: endIso,
          timeZone: validatedTimeZone,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      const eventId = await this.calendarService.createEvent(
        calendarEventBody,
        {
          actorType: 'company',
          actorId: 'company',
          staffMemberId: staff.id,
          serviceId: service.id,
          sourceType: 'appointment',
        },
      );

      // 8. Guardar la cita
      const newAppointment = this.appointmentsRepository.create({
        user,
        staffMember: staff,
        service,
        start: startDateAndTime,
        end: endDateAndTime,
        timeZone: validatedTimeZone,
        calendarEventId: typeof eventId === 'string' ? eventId : 'N/A',
        zoomMeetingId: meeting.id ?? 'N/A',
        zoomMeetingLink: meeting.joinUrl ?? 'N/A',
        ...rest,
      });
      await this.appointmentsRepository.save(newAppointment);

      // 9. Enviar notificaciones
      await this.notificationService.sendAppointmentConfirmationEmailToClient(
        user.email,
        {
          serviceName: service.name,
          appointmentDate: startDateAndTime
            .setZone(validatedTimeZone)
            .toFormat('yyyy-MM-dd'),
          appointmentTime: startDateAndTime
            .setZone(validatedTimeZone)
            .toFormat('HH:mm a'),
          clientName: `${user.firstName} ${user.lastName}`,
          location: service.address,
          staffName: `${staff.firstName} ${staff.lastName}`,
          meetingLink: meeting.joinUrl ?? '',
          clientEmail: user.email,
          clientPhoneNumber: user.phoneNumber ?? '',
        },
      );

      const staffNotificationEmail = process.env.ENTERPRISE_EMAIL ?? user.email;

      await this.notificationService.sendAppointmentConfirmationEmailToStaff(
        staffNotificationEmail,
        {
          serviceName: service.name,
          appointmentDate: startDateAndTime
            .setZone(businessTimeZone)
            .toFormat('yyyy-MM-dd'),
          appointmentTime: startDateAndTime
            .setZone(businessTimeZone)
            .toFormat('HH:mm a'),
          clientName: `${user.firstName} ${user.lastName}`,
          location: service.address,
          staffName: `${staff.firstName} ${staff.lastName}`,
          meetingLink: meeting.joinUrl ?? '',
          clientEmail: user.email,
          clientPhoneNumber: user.phoneNumber ?? '',
        },
      );

      if (typeof eventId === 'string' && eventId !== 'N/A') {
        await this.calendarService.updateEvent(eventId, calendarEventBody, {
          actorType: 'company',
          actorId: 'company',
          sourceId: newAppointment.id,
          staffMemberId: staff.id,
          serviceId: service.id,
          sync: false,
        });
      }

      return newAppointment;
    } catch (error) {
      this.logger.error(
        'Error creating appointment',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markPastAppointmentsCompleted(): Promise<void> {
    const now = new Date();
    const result = await this.appointmentsRepository.update(
      { status: In(['pending', 'confirmed']), end: LessThan(now) },
      { status: 'completed' },
    );
    if (result.affected && result.affected > 0) {
      this.logger.log(
        `Marked ${String(result.affected)} past appointment(s) as completed`,
      );
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;

    const appointments = await this.appointmentsRepository.find({
      take: limit,
      skip: offset,
      relations: {
        staffMember: true,
        service: true,
        user: true,
      },
      order: {
        id: 'ASC',
      },
    });

    const total = await this.appointmentsRepository.count();

    return {
      count: total,
      pages: Math.ceil(total / limit),
      appointments: appointments,
    };
  }

  async findOne(id: string) {
    return this.appointmentsRepository.findOne({
      where: { id },
      relations: {
        staffMember: true,
        service: true,
        user: true,
      },
    });
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentRequest,
    user: User,
  ) {
    try {
      // 1. Buscar la cita existente
      const appointment = await this.appointmentsRepository.findOne({
        where: { id },
        relations: ['staffMember', 'service', 'user'],
      });

      if (!appointment) {
        throw new BadRequestException('Appointment not found');
      }

      const {
        staffId,
        serviceId,
        startTimeUTC,
        endTimeUTC,
        timeZone,
        ...rest
      } = updateAppointmentDto;

      const appointmentTimeZone = validateTimeZone(
        timeZone ?? appointment.timeZone,
      );

      const defaultBusinessTz =
        process.env.BUSINESS_TZ ?? process.env.BUSINESS_TIMEZONE ?? 'UTC';
      const businessTimeZone = await this.settingsService.findOneOrDefault(
        'timezone',
        defaultBusinessTz,
      );

      // 2. Obtener servicio y personal actualizado usando el helper
      const { service, staff } =
        await this.appointmentHelper.getServiceAndStaff(
          serviceId,
          staffId,
          appointment.service,
          appointment.staffMember,
        );

      // 3. Si se actualizan las fechas, validar disponibilidad
      if (startTimeUTC && endTimeUTC) {
        this.logger.log(
          `Received start: ${startTimeUTC}, end: ${endTimeUTC}, timeZone: ${timeZone ?? appointment.timeZone}`,
        );

        const startDateAndTime = DateTime.fromISO(startTimeUTC, {
          zone: 'utc',
        });
        const endDateAndTime = DateTime.fromISO(endTimeUTC, {
          zone: 'utc',
        });
        const businessStartDateAndTime =
          startDateAndTime.setZone(businessTimeZone);

        const startIsoUtc = startDateAndTime.toISO() ?? '';
        const endIsoUtc = endDateAndTime.toISO() ?? '';

        this.logger.log(`Parsed startDateAndTime (UTC): ${startIsoUtc}`);
        this.logger.log(`Parsed endDateAndTime (UTC): ${endIsoUtc}`);
        this.logger.log(`appointmentTimeZone: ${appointmentTimeZone}`);

        // Log de las fechas en la zona horaria objetivo
        const startIsoTz =
          startDateAndTime.setZone(appointmentTimeZone).toISO() ?? '';
        const endIsoTz =
          endDateAndTime.setZone(appointmentTimeZone).toISO() ?? '';

        this.logger.log(`Start in target timezone: ${startIsoTz}`);
        this.logger.log(`End in target timezone: ${endIsoTz}`);

        // Validar fechas
        validateDatesForUpdate(
          startDateAndTime,
          endDateAndTime,
          DateTime.fromJSDate(appointment.start),
          DateTime.fromJSDate(appointment.end),
        );

        // Validar horario del personal y obtener schedules del día
        const schedules = await this.appointmentHelper.validateAndGetSchedules(
          staff.id,
          businessStartDateAndTime,
        );

        // Validar horas laborales contra cualquier horario del día
        const matchingSchedule = schedules.find((schedule) =>
          isWithinWorkingHours(
            schedule,
            startDateAndTime,
            endDateAndTime,
            businessTimeZone,
          ),
        );

        if (!matchingSchedule) {
          // Reutilizar el error existente para mantener mensajes consistentes.
          validateWorkingHours(
            schedules[0],
            startDateAndTime,
            endDateAndTime,
            businessTimeZone,
          );
        }

        await this.assertNoCalendarConflicts(
          startDateAndTime,
          endDateAndTime,
          businessTimeZone,
          staff.id,
        );

        // Verificar conflictos con otras citas
        const overlappingAppointment =
          await this.appointmentsRepository.findOne({
            where: {
              staffMember: { id: staff.id },
              id: Not(id),
              start: LessThan(endDateAndTime.toJSDate()),
              end: MoreThan(startDateAndTime.toJSDate()),
            },
          });

        if (overlappingAppointment) {
          throw new ConflictException(
            'The selected time slot is not available. Please choose another time.',
          );
        }

        await this.assertNoUserAppointmentConflicts(
          appointment.user.id,
          startDateAndTime,
          endDateAndTime,
          id,
        );

        // 4. Actualizar servicios externos (Zoom y Calendar)
        await this.appointmentHelper.updateExternalServices(
          this.zoomService,
          this.calendarService,
          appointment,
          {
            startDateAndTime,
            endDateAndTime,
            timeZone: appointmentTimeZone,
            serviceName: service.name,
            serviceAddress: service.address,
            staffName: {
              firstName: staff.firstName,
              lastName: staff.lastName,
            },
            userName: {
              firstName: user.firstName,
              lastName: user.lastName,
            },
            userEmail: user.email,
            userPhoneNumber: user.phoneNumber ?? '',
          },
        );

        // 4.1 Fallback: crear recursos externos si faltan IDs válidos
        if (
          !appointment.calendarEventId ||
          appointment.calendarEventId === 'N/A'
        ) {
          const fallbackEventBody = {
            summary: `Appointment: ${service.name}`,
            location: service.address,
            description: formatAppointmentDescription(
              appointment.zoomMeetingLink,
              staff.firstName,
              staff.lastName,
              user.firstName,
              user.lastName,
              user.email,
              user.phoneNumber ?? '',
            ),
            start: {
              dateTime: startIsoTz,
              timeZone: appointmentTimeZone,
            },
            end: {
              dateTime: endIsoTz,
              timeZone: appointmentTimeZone,
            },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 10 },
              ],
            },
          };

          const newEventId = await this.calendarService.createEvent(
            fallbackEventBody,
            {
              actorType: 'company',
              actorId: 'company',
              staffMemberId: staff.id,
              serviceId: service.id,
              sourceType: 'appointment',
              sourceId: appointment.id,
            },
          );
          appointment.calendarEventId =
            typeof newEventId === 'string' ? newEventId : 'N/A';
        }

        if (!appointment.zoomMeetingId || appointment.zoomMeetingId === 'N/A') {
          const meeting = this.normalizeZoomMeeting(
            await this.zoomService.createZoomMeeting(
              getZoomMeetingConfig(
                service.name,
                startIsoTz,
                appointmentTimeZone,
              ),
            ),
          );
          appointment.zoomMeetingId = meeting.id ?? 'N/A';
          appointment.zoomMeetingLink = meeting.joinUrl ?? 'N/A';
        }

        // 5. Actualizar la cita
        const updatedAppointment = this.appointmentsRepository.merge(
          appointment,
          {
            staffMember: staff,
            service,
            start: startDateAndTime.toJSDate(),
            end: endDateAndTime.toJSDate(),
            timeZone: appointmentTimeZone,
            ...rest,
          },
        );

        await this.appointmentsRepository.save(updatedAppointment);
        return updatedAppointment;
      } else {
        // Si no se actualizan las fechas, actualizar otros campos y también sincronizar servicios externos
        const startDateAndTime = DateTime.fromJSDate(appointment.start, {
          zone: 'utc',
        });
        const endDateAndTime = DateTime.fromJSDate(appointment.end, {
          zone: 'utc',
        });

        const startIsoTz =
          startDateAndTime.setZone(appointmentTimeZone).toISO() ?? '';
        const endIsoTz =
          endDateAndTime.setZone(appointmentTimeZone).toISO() ?? '';

        // Actualizar servicios externos (título, ubicación, descripción) aunque el horario no cambie
        await this.appointmentHelper.updateExternalServices(
          this.zoomService,
          this.calendarService,
          appointment,
          {
            startDateAndTime,
            endDateAndTime,
            timeZone: appointmentTimeZone,
            serviceName: service.name,
            serviceAddress: service.address,
            staffName: {
              firstName: staff.firstName,
              lastName: staff.lastName,
            },
            userName: {
              firstName: user.firstName,
              lastName: user.lastName,
            },
            userEmail: user.email,
            userPhoneNumber: user.phoneNumber ?? '',
          },
        );

        // Fallback: crear recursos externos si faltan IDs válidos
        if (
          !appointment.calendarEventId ||
          appointment.calendarEventId === 'N/A'
        ) {
          const fallbackEventBody = {
            summary: `Appointment: ${service.name}`,
            location: service.address,
            description: formatAppointmentDescription(
              appointment.zoomMeetingLink,
              staff.firstName,
              staff.lastName,
              user.firstName,
              user.lastName,
              user.email,
              user.phoneNumber ?? '',
            ),
            start: {
              dateTime: startIsoTz,
              timeZone: appointmentTimeZone,
            },
            end: {
              dateTime: endIsoTz,
              timeZone: appointmentTimeZone,
            },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 10 },
              ],
            },
          };

          const newEventId = await this.calendarService.createEvent(
            fallbackEventBody,
            {
              actorType: 'company',
              actorId: 'company',
              staffMemberId: staff.id,
              serviceId: service.id,
              sourceType: 'appointment',
              sourceId: appointment.id,
            },
          );
          appointment.calendarEventId =
            typeof newEventId === 'string' ? newEventId : 'N/A';
        }

        if (!appointment.zoomMeetingId || appointment.zoomMeetingId === 'N/A') {
          const meeting = this.normalizeZoomMeeting(
            await this.zoomService.createZoomMeeting(
              getZoomMeetingConfig(
                service.name,
                startIsoTz,
                appointmentTimeZone,
              ),
            ),
          );
          appointment.zoomMeetingId = meeting.id ?? 'N/A';
          appointment.zoomMeetingLink = meeting.joinUrl ?? 'N/A';
        }

        const updatedAppointment = this.appointmentsRepository.merge(
          appointment,
          {
            staffMember: staff,
            service,
            ...rest,
          },
        );

        await this.appointmentsRepository.save(updatedAppointment);
        return updatedAppointment;
      }
    } catch (error) {
      this.logger.error(
        'Error updating appointment',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async findCurrentUser(
    user: User,
    state: 'pending' | 'past',
  ): Promise<Appointment[]> {
    try {
      const now = DateTime.utc().toJSDate();

      switch (state) {
        case 'pending':
          return await this.appointmentsRepository.find({
            where: {
              user: { id: user.id },
              start: MoreThan(now),
              status: In(['pending', 'confirmed']),
            },
            relations: ['staffMember', 'service'],
          });
        case 'past':
          return await this.appointmentsRepository.find({
            where: { user: { id: user.id }, start: LessThan(now) },
            relations: ['staffMember', 'service'],
          });
      }
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        (error instanceof Error ? error.message : undefined) ??
          'An unexpected error occurred while fetching the appointments. Please try again later.',
      );
    }
  }

  async remove(id: string) {
    const appointment = await this.appointmentsRepository.findOneBy({ id });
    if (!appointment) throw new BadRequestException('Appointment not found');
    await this.appointmentsRepository.remove(appointment);

    if (appointment.zoomMeetingId && appointment.zoomMeetingId !== 'N/A') {
      try {
        await this.zoomService.remove(appointment.zoomMeetingId);
      } catch (error) {
        this.logger.warn(
          `Could not remove Zoom meeting ${appointment.zoomMeetingId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (appointment.calendarEventId && appointment.calendarEventId !== 'N/A') {
      try {
        await this.calendarService.deleteEvent(appointment.calendarEventId);
      } catch (error) {
        this.logger.warn(
          `Could not delete Calendar event ${appointment.calendarEventId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return appointment;
  }

  async cancelAppointment(
    appointmentId: string,
    userId: string,
    cancelDto: CancelAppointmentRequest,
  ): Promise<Appointment> {
    // 1. Buscar la cita
    const appointment = await this.appointmentsRepository.findOne({
      where: { id: appointmentId },
      relations: {
        user: true,
        service: true,
        staffMember: true,
      }, // Ajusta según tus relaciones
    });

    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found`,
      );
    }

    // 2. Verificar que el usuario es el dueño de la cita
    if (appointment.user.id !== userId) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }

    // 3. Verificar que la cita no esté ya cancelada
    if (appointment.status === 'cancelled') {
      throw new BadRequestException('This appointment is already cancelled');
    }

    // 4. Verificar que la cita no esté completada
    if (appointment.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed appointment');
    }

    // 5. Opcional: Verificar tiempo mínimo de cancelación (ej: 24 horas antes)
    const now = new Date();
    const appointmentStart = new Date(appointment.start);
    const hoursUntilAppointment =
      (appointmentStart.getTime() - now.getTime()) / (1000 * 60 * 60); // Convertir a horas

    if (hoursUntilAppointment < 24) {
      // Puedes lanzar excepción o permitirlo con una nota
      throw new BadRequestException(
        'Appointments must be cancelled at least 24 hours in advance. Please contact support for assistance.',
      );
    }

    // 6. Actualizar la cita
    appointment.status = 'cancelled';
    appointment.cancellationReason = cancelDto.cancellationReason;
    appointment.cancelledAt = new Date();

    const cancelledAppointment =
      await this.appointmentsRepository.save(appointment);

    // 7. Opcional: Enviar notificación por email
    await this.notificationService.sendCancellationEmail({
      appointmentDate: DateTime.fromJSDate(appointment.start)
        .setZone(appointment.timeZone)
        .toFormat('yyyy-MM-dd'),
      appointmentTime: DateTime.fromJSDate(appointment.start)
        .setZone(appointment.timeZone)
        .toFormat('hh:mm a'),
      clientName: appointment.user.firstName + ' ' + appointment.user.lastName,
      clientEmail: appointment.user.email,
      staffName:
        appointment.staffMember.firstName +
        ' ' +
        appointment.staffMember.lastName,
      serviceName: appointment.service.name,
      clientPhoneNumber: appointment.user.phoneNumber ?? '',
      location: appointment.service.address,
      meetingLink: appointment.zoomMeetingLink,
    });

    // 8. Opcional: Registrar en log/auditoría
    // await this.logsService.logAppointmentCancellation(appointment, userId);

    // 9. Remove calendar event and zoom meeting (best effort)
    if (appointment.calendarEventId && appointment.calendarEventId !== 'N/A') {
      try {
        await this.calendarService.deleteEvent(appointment.calendarEventId);
      } catch (error) {
        this.logger.warn(
          `Could not delete Calendar event ${appointment.calendarEventId} during cancellation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (appointment.zoomMeetingId && appointment.zoomMeetingId !== 'N/A') {
      try {
        await this.zoomService.remove(appointment.zoomMeetingId);
      } catch (error) {
        this.logger.warn(
          `Could not remove Zoom meeting ${appointment.zoomMeetingId} during cancellation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return cancelledAppointment;
  }

  // Método auxiliar para verificar si se puede cancelar
  async canCancelAppointment(
    appointmentId: string,
    userId: string,
  ): Promise<boolean> {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id: appointmentId },
      relations: { user: true },
    });

    if (!appointment) return false;
    if (appointment.user.id !== userId) return false;
    if (appointment.status !== 'confirmed') return false;

    const now = new Date();
    const appointmentStart = new Date(appointment.start);
    const hoursUntilAppointment =
      (appointmentStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Permitir cancelación si es más de 24 horas antes
    return hoursUntilAppointment >= 24;
  }

  // Para obtener citas activas (no canceladas)
  async getUserActiveAppointments(userId: string) {
    return this.appointmentsRepository.find({
      where: {
        user: { id: userId },
        status: Not(In(['cancelled', 'no-show'])),
      },
      order: { start: 'ASC' },
    });
  }

  // Para obtener historial incluyendo canceladas
  async getUserAppointmentHistory(userId: string) {
    return this.appointmentsRepository.find({
      where: { user: { id: userId } },
      order: { start: 'DESC' },
    });
  }

  private normalizeZoomMeeting(meeting: unknown): {
    id?: string;
    joinUrl?: string;
  } {
    if (meeting && typeof meeting === 'object') {
      const data = meeting as Record<string, unknown>;
      const id = typeof data.id === 'string' ? data.id : undefined;
      const joinUrl =
        typeof data.join_url === 'string' ? data.join_url : undefined;
      return { id, joinUrl };
    }
    return {};
  }

  private async assertNoCalendarConflicts(
    start: DateTime,
    end: DateTime,
    timeZone: string,
    staffMemberId: string,
  ): Promise<void> {
    const startIso = start.toUTC().toISO();
    const endIso = end.toUTC().toISO();

    if (!startIso || !endIso) {
      throw new BadRequestException('Invalid date range for calendar check');
    }

    const conflicts: Interval[] = await this.calendarService.checkEventsInRange(
      startIso,
      endIso,
      timeZone,
      staffMemberId,
    );

    if (conflicts.length > 0) {
      throw new ConflictException(BookingsMessages.SLOT_OVERLAP);
    }
  }

  private async assertNoUserAppointmentConflicts(
    userId: string,
    start: DateTime,
    end: DateTime,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const whereClause = {
      user: { id: userId },
      status: In(['pending', 'confirmed']),
      start: LessThan(end.toJSDate()),
      end: MoreThan(start.toJSDate()),
      ...(excludeAppointmentId ? { id: Not(excludeAppointmentId) } : {}),
    };

    const userOverlappingAppointment =
      await this.appointmentsRepository.findOne({
        where: whereClause,
      });

    if (userOverlappingAppointment) {
      throw new ConflictException(
        'You already have another appointment during this time slot.',
      );
    }
  }

  async buildAddToCalendarData(appointmentId: string): Promise<{
    ics: string;
    googleCalendarUrl: string;
    title: string;
    start: string;
    end: string;
  }> {
    const appointment = await this.findAppointmentWithRelations(appointmentId);
    const { title, description, location, start, end } =
      this.buildCalendarEventPresentation(appointment);

    const formatIcsDate = (dt: DateTime) =>
      dt.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ascencio Tax Inc//Appointment//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:appointment-${appointmentId}@ascenciotax.com`,
      `DTSTAMP:${formatIcsDate(DateTime.utc())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${formatIcsDate(start)}/${formatIcsDate(end)}`,
      details: description,
      location,
    });
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

    return {
      ics,
      googleCalendarUrl,
      title,
      start: start.toISO() ?? '',
      end: end.toISO() ?? '',
    };
  }

  async addAppointmentToClientCalendar(
    appointmentId: string,
    userId: string,
  ): Promise<{ added: true; externalEventId: string }> {
    const appointment = await this.findAppointmentWithRelations(appointmentId);

    if (appointment.user.id !== userId) {
      throw new ForbiddenException(CommonMessages.ACCESS_DENIED);
    }

    const connection = await this.calendarConnectionService.getConnection(
      'client',
      userId,
    );

    if (!connection?.isActive || !connection.calendarId) {
      throw new BadRequestException('Client calendar is not connected');
    }

    const adapter = await this.calendarConnectionService.getAdapter(
      'client',
      userId,
    );
    const eventBody = this.buildClientCalendarEventBody(appointment);
    const externalEventId = await adapter.createEvent(
      eventBody,
      connection.calendarId,
    );

    if (!externalEventId) {
      throw new InternalServerErrorException(
        'Failed to create event in client calendar',
      );
    }

    return {
      added: true,
      externalEventId,
    };
  }

  private async findAppointmentWithRelations(
    appointmentId: string,
  ): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id: appointmentId },
      relations: { staffMember: true, service: true, user: true },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    return appointment;
  }

  private buildCalendarEventPresentation(appointment: Appointment): {
    title: string;
    description: string;
    location: string;
    start: DateTime;
    end: DateTime;
  } {
    const start = DateTime.fromJSDate(appointment.start, {
      zone: appointment.timeZone,
    });
    const end = DateTime.fromJSDate(appointment.end, {
      zone: appointment.timeZone,
    });

    const title = `${appointment.service.name} — Ascencio Tax`;
    const description =
      appointment.service.description.length > 0
        ? appointment.service.description
        : `Appointment with ${appointment.staffMember.firstName} ${appointment.staffMember.lastName}`;
    const location = appointment.zoomMeetingId
      ? `Virtual — Zoom meeting ID: ${appointment.zoomMeetingId}`
      : 'Ascencio Tax Inc.';

    return { title, description, location, start, end };
  }

  private buildClientCalendarEventBody(
    appointment: Appointment,
  ): calendar_v3.Schema$Event {
    const { title, description, location, start, end } =
      this.buildCalendarEventPresentation(appointment);

    return {
      summary: title,
      description,
      location,
      start: {
        dateTime: start.toISO() ?? undefined,
        timeZone: appointment.timeZone,
      },
      end: {
        dateTime: end.toISO() ?? undefined,
        timeZone: appointment.timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };
  }
}
