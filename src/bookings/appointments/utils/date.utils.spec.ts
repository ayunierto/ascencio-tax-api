import { DateUtils } from './date.utils';
import { Settings } from 'luxon';

describe('DateUtils', () => {
  const dateUtils = new DateUtils();

  afterEach(() => {
    jest.restoreAllMocks();
    Settings.defaultZone = 'system';
  });

  it('convierte HH:MM:SS a minutos del día', () => {
    expect(dateUtils.convertTimeToMinutesOfDay('01:30:30')).toBe(90.5);
  });

  it('detecta rango que cruza medianoche', () => {
    expect(
      dateUtils.checkIfTimeIsInRange('23:30:00', '22:00:00', '02:00:00'),
    ).toBe(true);
    expect(
      dateUtils.checkIfTimeIsInRange('03:00:00', '22:00:00', '02:00:00'),
    ).toBe(false);
  });

  it('convierte ISO a hora de Toronto y restablece zona por defecto', () => {
    const spy = jest
      .spyOn(Date.prototype, 'toLocaleTimeString')
      .mockReturnValue('07:00:00');

    const result = dateUtils.convertToIso8601ToToronto('2024-01-01T12:00:00Z');

    expect(result).toBe('07:00:00');
    expect(spy).toHaveBeenCalled();
  });

  it('retorna null para ISO inválido', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const result = dateUtils.convertToIso8601ToToronto('fecha-invalida');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
