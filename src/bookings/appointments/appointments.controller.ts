import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AppointmentsService } from './appointments.service';
import {
  CancelAppointmentRequest,
  cancelAppointmentSchema,
  CreateAppointmentRequest,
  createAppointmentSchema,
  UpdateAppointmentRequest,
  updateAppointmentSchema,
} from '@ascencio/shared';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Auth()
  create(
    @Body(new ZodValidationPipe(createAppointmentSchema))
    createAppointmentDto: CreateAppointmentRequest,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.create(createAppointmentDto, user);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.appointmentsService.findAll(paginationDto);
  }

  @Get('current-user')
  @Auth()
  findCurrentUser(
    @GetUser() user: User,
    @Query('state') state: 'pending' | 'past' = 'pending',
  ) {
    return this.appointmentsService.findCurrentUser(user, state);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }

  @Patch(':id/cancel')
  @Auth()
  @HttpCode(HttpStatus.OK)
  async cancelAppointment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelAppointmentSchema))
    cancelDto: CancelAppointmentRequest,
    @GetUser() user: User,
  ) {
    const userId = user.id; // Asumiendo que el guard añade el usuario a la request
    const cancelledAppointment =
      await this.appointmentsService.cancelAppointment(id, userId, cancelDto);

    return {
      message: 'Appointment cancelled successfully',
      appointment: cancelledAppointment,
    };
  }

  @Patch(':id')
  @Auth()
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema))
    updateAppointmentDto: UpdateAppointmentRequest,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.update(id, updateAppointmentDto, user);
  }

  @Get(':id/add-to-calendar')
  @Auth()
  async getAddToCalendarData(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('format') format: 'ics' | 'link' | 'json' = 'json',
    @Res() res: Response,
  ) {
    const data = await this.appointmentsService.buildAddToCalendarData(id);

    if (format === 'ics') {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="appointment-${id}.ics"`,
      );
      return res.send(data.ics);
    }

    if (format === 'link') {
      res.redirect(data.googleCalendarUrl);
      return;
    }

    return res.json(data);
  }

  @Post(':id/add-to-calendar')
  @Auth()
  async addToClientCalendar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.addAppointmentToClientCalendar(id, user.id);
  }
}
