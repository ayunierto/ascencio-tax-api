import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime, Interval } from 'luxon';
import { Appointment } from 'src/bookings/appointments/entities/appointment.entity';
import { CalendarService } from 'src/calendar/calendar.service';
import { Between, Repository } from 'typeorm';
import { SearchAvailabilityDto } from './dto/search-availability.dto';
import { AvailableSlot } from './interfaces/available-slot';
import { SystemSettingsService } from 'src/system-settings/system-settings.service';
import { ServicesService } from '../services/services.service';
import { StaffMember } from '../staff-members/entities/staff-member.entity';
import { Schedule } from '../schedules/entities/schedule.entity';

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(StaffMember)
    private readonly staffRepository: Repository<StaffMember>,
    private readonly servicesService: ServicesService,
    private readonly calendarService: CalendarService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  /**
   * 1. Buscar disponibilidad de slots para un servicio en una fecha específica.
   * @param date Fecha solicitada por el usuario (YYYY-MM-DD).
   * @param specificStaffId Opcional: para filtrar la disponibilidad.
   * @returns Promesa que resuelve a una lista de AvailableSlot.
   */
  async searchAvailability(
    searchAvailabilityDto: SearchAvailabilityDto,
  ): Promise<AvailableSlot[]> {
    const {
      serviceId,
      date,
      staffId,
      timeZone: userTimeZone,
    } = searchAvailabilityDto;

    // --- 1. CONFIGURACIÓN INICIAL Y VALIDACIÓN ---

    // 1.1 Comprobar si existe el servicio por el id.
    const service = await this.servicesService.findOne(serviceId);
    const duration = service.durationMinutes;
    if (!duration || duration <= 0) {
      throw new BadRequestException(
        'Service durationMinutes must be configured',
      );
    }

    if (!service.staffMembers || service.staffMembers.length === 0) {
      throw new BadRequestException(
        'El servicio no tiene staff asignado. Asigne al menos un miembro.',
      );
    }

    // 1.2 Obtener ajustes del negocio (para zona horaria) con valor por defecto
    const defaultBusinessTz =
      process.env.BUSINESS_TZ ||
      process.env.BUSINESS_TIMEZONE ||
      'America/Toronto';

    const businessTimeZone = await this.settingsService.findOneOrDefault(
      'timezone',
      defaultBusinessTz,
    );

    const targetDate = DateTime.fromISO(date, {
      zone: userTimeZone,
    });
    if (!targetDate.isValid) {
      throw new Error('Formato de fecha inválido.');
    }

    const now = DateTime.now().setZone(businessTimeZone);

    // targetDate ya está definido como DateTime, pero debe ser forzado a la zona del negocio
    const businessDate = targetDate.setZone(businessTimeZone, {
      keepLocalTime: true,
    });

    // Obtener el día de la semana según la zona del negocio. Mapear 7 a 0. Usar 0-6 (0=Dom, 1=Lun...)
    const dayOfWeek = businessDate.weekday % 7;

    // --- 2. OBTENER STAFF(S) VÁLIDOS ---
    // Buscar StaffMember que ofrezca el servicio y, opcionalmente, filtrar por staff específico
    let staff: StaffMember[] = [];

    const qb = this.staffRepository
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.services', 'service')
      .leftJoinAndSelect('staff.schedules', 'schedule')
      .where('staff.isActive = :active', { active: true })
      .andWhere('service.id = :serviceId', { serviceId })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek });

    if (staffId) {
      qb.andWhere('staff.id = :staffId', { staffId });
    }

    staff = await qb.getMany();
    if (staff.length === 0) return []; // No hay staff disponible para ese dia.

    // Estructura para consolidar slots: Map<startTimeUTC, StaffMember[]>
    const consolidatedSlots = new Map<string, StaffMember[]>();

    // --- 3. PROCESAR DISPONIBILIDAD POR CADA STAFF ---
    for (const staffMember of staff) {
      // a) Horarios Semanales para el día del staff
      // const schedule = await this.getStaffSchedule(staff.id, dayOfWeek);
      // if (schedule.length === 0) continue; // StaffMember no trabaja este día

      // b) Bloqueos/Vacaciones (StaffTimeOff) para la fecha
      // const timeOffs = await this.getStaffTimeOff(staff.id, requestedDate);

      // c) Citas Confirmadas para el día
      const dateStart = businessDate.startOf('day').toJSDate();
      const dateEnd = businessDate.endOf('day').toJSDate();
      const appointments: Appointment[] =
        await this.appointmentsRepository.find({
          where: {
            staffMember: { id: staffMember.id },
            status: 'confirmed',
            start: Between(dateStart, dateEnd),
          },
        });

      const schedules = staffMember.schedules ?? [];
      if (schedules.length === 0) {
        continue;
      }

      let availableIntervals: Interval[] = this.calculateBaseIntervals(
        schedules,
        businessDate,
      );
      availableIntervals = this.subtractAppointments(
        availableIntervals,
        appointments,
        businessTimeZone,
      );

      try {
        const calendarEvents = await this.calendarService.checkEventsInRange(
          dateStart.toISOString(),
          dateEnd.toISOString(),
          businessTimeZone,
          staffMember.id,
        );
        availableIntervals = this.subtractCalendarEvents(
          availableIntervals,
          calendarEvents,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Calendar lookup failed: ${message}`);
      }

      // Filtrar intervalos que ya han pasado
      availableIntervals = availableIntervals.filter((interval) => {
        const end = interval.end;
        return end !== null && end > now;
      });

      this.generateAndConsolidateSlots(
        availableIntervals,
        duration,
        staffMember,
        consolidatedSlots,
        now, // Pasar now para filtrar slots individuales
      );
    }

    return Array.from(consolidatedSlots, ([startTimeUTC, availableStaff]) => {
      const slotEnd = DateTime.fromISO(startTimeUTC, { zone: 'utc' })
        .plus({ minutes: duration })
        .toUTC()
        .toISO();

      if (!slotEnd) {
        throw new BadRequestException(
          'No fue posible calcular el final del intervalo solicitado.',
        );
      }

      return {
        startTimeUTC,
        endTimeUTC: slotEnd,
        availableStaff,
      };
    }).sort((a, b) => a.startTimeUTC.localeCompare(b.startTimeUTC));
  }

  private async checkForAppointments(
    staffId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const appointments =
      (await this.appointmentsRepository.count({
        where: {
          staffMember: { id: staffId },
          start: Between(startDate, endDate),
        },
      })) > 0;

    return appointments; // True if there's at least one appointment
  }

  private async checkForEvents(startTime: Date, endTime: Date) {
    const events = await this.calendarService.checkEventsInRange(
      startTime.toUTCString(),
      endTime.toUTCString(),
      'UTC',
    );

    return events.length > 0; // True if there's at least one event
  }

  /**
   * Resta las citas confirmadas de los intervalos disponibles.
   * @param intervals Intervalos de tiempo disponibles.
   * @param appointments Citas confirmadas que deben ser restadas.
   * @param businessTimeZone Zona horaria del negocio para conversión correcta.
   * @returns Nuevos intervalos disponibles tras restar las citas.
   */
  private subtractAppointments(
    intervals: Interval[],
    appointments: Appointment[],
    businessTimeZone: string,
  ): Interval[] {
    // Convertir entidades de DB a Intervalos de Luxon
    const apptIntervals = appointments.map((appt) =>
      Interval.fromDateTimes(
        DateTime.fromJSDate(appt.start, { zone: 'utc' }).setZone(
          businessTimeZone,
        ),
        DateTime.fromJSDate(appt.end, { zone: 'utc' }).setZone(
          businessTimeZone,
        ),
      ),
    );

    let result = intervals;
    apptIntervals.forEach((appt) => {
      result = result.flatMap((interval) => interval.difference(appt));
    });
    return result;
  }

  private subtractCalendarEvents(
    intervals: Interval[],
    eventIntervals: Interval[],
  ): Interval[] {
    let result = intervals;

    eventIntervals.forEach((event) => {
      result = result.flatMap((interval) => interval.difference(event));
    });
    return result;
  }

  /**
   * Resta los intervalos ocupados (bloqueos) de los intervalos disponibles.
   */
  // private subtractTimeOffs(
  //   intervals: Interval[],
  //   timeOffs: StaffTimeOff[],
  // ): Interval[] {
  //   // Convertir entidades de DB a Intervalos de Luxon
  //   const blockIntervals = timeOffs.map((to) =>
  //     Interval.fromDateTimes(
  //       DateTime.fromJSDate(to.startDate, { zone: 'utc' }).setZone(
  //         BUSINESS_TIMEZONE,
  //       ),
  //       DateTime.fromJSDate(to.endDate, { zone: 'utc' }).setZone(
  //         BUSINESS_TIMEZONE,
  //       ),
  //     ),
  //   );

  //   let result = intervals;
  //   blockIntervals.forEach((block) => {
  //     // flatMap realiza la resta del intervalo y aplanamiento de la lista resultante
  //     result = result.flatMap((interval) => interval.difference(block));
  //   });
  //   return result;
  // }

  /**
   * Crea los intervalos base a partir del StaffSchedule.
   * Interpreta los strings HH:MM como horas en la zona del negocio.
   */
  private calculateBaseIntervals(
    schedules: Schedule[],
    date: DateTime,
  ): Interval[] {
    return schedules
      .map(({ startTime, endTime }) => {
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const start = date.set({
          hour: startHour,
          minute: startMinute,
        });
        const end = date.set({ hour: endHour, minute: endMinute });

        return start < end ? Interval.fromDateTimes(start, end) : null;
      })
      .filter((interval): interval is Interval => interval !== null);
  }

  /**
   * Itera sobre los intervalos libres y genera slots del tamaño del servicio, consolidándolos.
   * @param staff El StaffMember que está disponible en este intervalo.
   * @param consolidatedSlots El mapa global de slots disponibles.
   * @param now La hora actual para filtrar slots que ya pasaron.
   */
  private generateAndConsolidateSlots(
    intervals: Interval[],
    duration: number,
    staff: StaffMember,
    consolidatedSlots: Map<string, StaffMember[]>,
    now: DateTime,
  ): void {
    intervals.forEach((interval) => {
      if (!interval.start || !interval.end) return;

      let currentStart = interval.start;

      while (currentStart.plus({ minutes: duration }) <= interval.end) {
        // Filtrar slots que ya han pasado (comparar inicio del slot con el momento actual)
        if (currentStart <= now) {
          currentStart = currentStart.plus({ minutes: duration });
          continue;
        }

        // 1. Convertir la hora de inicio (que está en BUSINESS_TIMEZONE) a UTC.
        const startTimeUTC = currentStart.toUTC().toISO();
        if (!startTimeUTC) {
          this.logger.warn(
            `No se pudo convertir el slot a ISO (${currentStart.toISO()})`,
          );
          break;
        }

        // 2. Usar el ISO string UTC como clave para el mapa.
        const existingStaff = consolidatedSlots.get(startTimeUTC);
        if (existingStaff !== undefined) {
          existingStaff.push(staff);
        } else {
          // Si es un slot nuevo, crear la entrada con el staff inicial
          consolidatedSlots.set(startTimeUTC, [staff]);
        }

        // 3. Avanzar al siguiente slot
        currentStart = currentStart.plus({ minutes: duration });
      }
    });
  }
}
