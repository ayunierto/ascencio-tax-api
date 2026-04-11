/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarService } from './calendar.service';
import { CalendarEvent } from './entities/calendar.entity';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';
import { CalendarConnectionService } from './calendar-connection.service';

interface AdapterMock {
  createEvent: jest.Mock;
  updateEvent: jest.Mock;
  deleteEvent: jest.Mock;
}

const createCalendarEventRepositoryMock = () =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    merge: jest.fn(
      (entity: CalendarEvent, patch: Partial<CalendarEvent>) =>
        Object.assign({}, entity, patch) as CalendarEvent,
    ),
  }) as unknown as jest.Mocked<Repository<CalendarEvent>>;

const createStaffRepositoryMock = () =>
  ({
    find: jest.fn(),
  }) as unknown as jest.Mocked<Repository<StaffMember>>;

const createConnectionServiceMock = () => ({
  getConnection: jest.fn(),
  getAdapter: jest.fn(),
});

describe('CalendarService (OAuth-only)', () => {
  let service: CalendarService;
  let eventsRepository: jest.Mocked<Repository<CalendarEvent>>;
  let connectionService: ReturnType<typeof createConnectionServiceMock>;
  let adapterMock: AdapterMock;

  beforeEach(async () => {
    eventsRepository = createCalendarEventRepositoryMock();
    connectionService = createConnectionServiceMock();
    adapterMock = {
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CalendarService,
        {
          provide: getRepositoryToken(CalendarEvent),
          useValue: eventsRepository,
        },
        {
          provide: getRepositoryToken(StaffMember),
          useValue: createStaffRepositoryMock(),
        },
        {
          provide: CalendarConnectionService,
          useValue: connectionService,
        },
      ],
    }).compile();

    service = moduleRef.get(CalendarService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('createEvent guarda localmente aunque no exista conexion OAuth activa', async () => {
    const localId = '6d2847c7-2e86-4aa0-81cd-6ebad9720f91';
    const localEvent = {
      id: localId,
      summary: 'Event',
      timeZone: 'America/Toronto',
    } as CalendarEvent;

    eventsRepository.create.mockReturnValue(localEvent);
    eventsRepository.save.mockResolvedValue(localEvent);
    connectionService.getConnection.mockResolvedValue(null);

    const result = await service.createEvent(
      {
        summary: 'Appointment',
        start: {
          dateTime: '2026-04-15T10:00:00.000-04:00',
          timeZone: 'America/Toronto',
        },
        end: {
          dateTime: '2026-04-15T11:00:00.000-04:00',
          timeZone: 'America/Toronto',
        },
      },
      {
        actorType: 'company',
        actorId: 'company',
      },
    );

    expect(result).toBe(localId);
    expect(connectionService.getAdapter).not.toHaveBeenCalled();
    expect(eventsRepository.update).not.toHaveBeenCalled();
  });

  it('createEvent sincroniza con OAuth cuando encuentra conexion activa', async () => {
    const localId = 'e2f6bb27-a9a2-4f56-884f-f8f860db0368';
    const localEvent = {
      id: localId,
      summary: 'Event',
      timeZone: 'America/Toronto',
    } as CalendarEvent;

    eventsRepository.create.mockReturnValue(localEvent);
    eventsRepository.save.mockResolvedValue(localEvent);

    connectionService.getConnection.mockResolvedValue({
      isActive: true,
      calendarId: 'company-calendar-id',
    });
    connectionService.getAdapter.mockResolvedValue(adapterMock);
    adapterMock.createEvent.mockResolvedValue('google-event-id');

    const result = await service.createEvent(
      {
        summary: 'Appointment',
        start: {
          dateTime: '2026-04-15T10:00:00.000-04:00',
          timeZone: 'America/Toronto',
        },
        end: {
          dateTime: '2026-04-15T11:00:00.000-04:00',
          timeZone: 'America/Toronto',
        },
      },
      {
        actorType: 'company',
        actorId: 'company',
      },
    );

    expect(result).toBe('google-event-id');
    expect(connectionService.getAdapter).toHaveBeenCalledWith(
      'company',
      'company',
    );
    expect(adapterMock.createEvent).toHaveBeenCalled();
    expect(eventsRepository.update).toHaveBeenCalledWith(localId, {
      externalEventId: 'google-event-id',
      externalCalendarId: 'company-calendar-id',
      externalActorType: 'company',
      externalActorId: 'company',
    });
  });

  it('updateEvent usa actor OAuth persistido para sincronizar cambios', async () => {
    const localId = 'cb073cc2-c36d-4888-9541-1f56dfba8a70';
    const existingEvent = {
      id: localId,
      summary: 'Old title',
      description: 'Old desc',
      location: 'Old location',
      start: new Date('2026-04-15T14:00:00.000Z'),
      end: new Date('2026-04-15T15:00:00.000Z'),
      timeZone: 'America/Toronto',
      sourceType: 'appointment',
      sourceId: 'appt-1',
      isBusy: true,
      status: 'confirmed',
      externalEventId: 'google-event-id',
      externalCalendarId: 'company-calendar-id',
      externalActorType: 'company',
      externalActorId: 'company',
    } as CalendarEvent;

    eventsRepository.findOne.mockResolvedValue(existingEvent);
    eventsRepository.save.mockResolvedValue(existingEvent);
    connectionService.getConnection.mockResolvedValue({
      isActive: true,
      calendarId: 'company-calendar-id',
    });
    connectionService.getAdapter.mockResolvedValue(adapterMock);

    await service.updateEvent(localId, {
      summary: 'New title',
      start: {
        dateTime: '2026-04-15T10:30:00.000-04:00',
        timeZone: 'America/Toronto',
      },
      end: {
        dateTime: '2026-04-15T11:30:00.000-04:00',
        timeZone: 'America/Toronto',
      },
    });

    expect(connectionService.getAdapter).toHaveBeenCalledWith(
      'company',
      'company',
    );
    expect(adapterMock.updateEvent).toHaveBeenCalledWith(
      'google-event-id',
      expect.objectContaining({ summary: 'New title' }),
      'company-calendar-id',
    );
  });

  it('deleteEvent no falla si no existe destino OAuth para borrado externo', async () => {
    const localId = '4bcd2f95-d990-4f30-8ffb-7d9e438c55f7';
    const existingEvent = {
      id: localId,
      summary: 'Event',
      start: new Date('2026-04-15T14:00:00.000Z'),
      end: new Date('2026-04-15T15:00:00.000Z'),
      timeZone: 'America/Toronto',
      sourceType: 'appointment',
      isBusy: true,
      status: 'confirmed',
      externalEventId: 'google-event-id',
      externalActorType: 'company',
      externalActorId: 'company',
    } as CalendarEvent;

    eventsRepository.findOne.mockResolvedValue(existingEvent);
    eventsRepository.save.mockResolvedValue(existingEvent);
    connectionService.getConnection.mockResolvedValue(null);

    await expect(service.deleteEvent(localId)).resolves.toBeUndefined();
    expect(connectionService.getAdapter).not.toHaveBeenCalled();
    expect(eventsRepository.save).toHaveBeenCalled();
  });
});
