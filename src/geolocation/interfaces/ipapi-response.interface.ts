export interface IpApiLocation {
  calling_code?: string;
}

export interface IpApiSuccessResponse {
  ip?: string;
  country_code?: string;
  country_name?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  country_calling_code?: string;
  location?: IpApiLocation;
}

export interface IpApiErrorResponse {
  success: false;
  error?: {
    code?: number;
    type?: string;
    info?: string;
  };
}
