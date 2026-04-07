export interface GeolocationLookupResult {
  callingCode: string | null;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface GeolocationProviderAdapter {
  readonly name: string;
  lookupByIp(ip: string): Promise<GeolocationLookupResult | null>;
}

export const GEOLOCATION_PROVIDER = Symbol('GEOLOCATION_PROVIDER');
