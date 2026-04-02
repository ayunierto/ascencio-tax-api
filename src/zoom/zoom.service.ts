import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CreateZoomMeetingDto, UpdateZoomMeetingDto } from './dto';

interface ZoomTokenResponse {
  access_token: string;
  expires_in: number;
}

type ZoomTokenResult =
  | {
      access_token: string;
      expires_in: number;
      error: null;
    }
  | {
      access_token: null;
      expires_in: null;
      error: string;
    };

@Injectable()
export class ZoomService {
  private readonly ZOOM_OAUTH_ENDPOINT = 'https://zoom.us/oauth/token';
  private readonly ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';

  private readonly logger = new Logger(ZoomService.name);

  async createZoomMeeting(body: CreateZoomMeetingDto) {
    try {
      const zoomToken = await this.getZoomToken();
      if (!zoomToken.access_token) {
        throw new Error(
          `Unable to get Zoom token: ${zoomToken.error ?? 'unknown error'}`,
        );
      }

      const { data } = await axios.post<unknown>(
        `${this.ZOOM_API_BASE_URL}/users/me/meetings`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${zoomToken.access_token}`,
          },
        },
      );

      this.logger.log('Meeting created successfully');
      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating Zoom meeting: ${message}`);
      throw error;
    }
  }

  async updateMeeting(meetingId: string, updateData: UpdateZoomMeetingDto) {
    try {
      const zoomToken = await this.getZoomToken();
      if (!zoomToken.access_token) {
        throw new Error(
          `Unable to get Zoom token: ${zoomToken.error ?? 'unknown error'}`,
        );
      }

      this.logger.log(
        `Updating meeting ${meetingId} with data:`,
        JSON.stringify(updateData, null, 2),
      );

      const { data } = await axios.patch<unknown>(
        `${this.ZOOM_API_BASE_URL}/meetings/${meetingId}`,
        updateData,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${zoomToken.access_token}`,
          },
        },
      );

      this.logger.log(`Meeting ${meetingId} updated successfully`);
      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error updating Zoom meeting ${meetingId}: ${message}`);

      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(
          `Zoom API Error Response: ${JSON.stringify(error.response.data, null, 2)}`,
        );
        this.logger.error(`Status: ${String(error.response.status)}`);
      }

      throw error;
    }
  }

  async remove(id: string) {
    if (!id || id === 'N/A') {
      this.logger.warn('Zoom meeting ID is empty or N/A; skipping delete');
      return;
    }

    try {
      const zoomToken = await this.getZoomToken();
      if (!zoomToken.access_token) {
        throw new Error(
          `Unable to get Zoom token: ${zoomToken.error ?? 'unknown error'}`,
        );
      }

      const request = await axios.delete<unknown>(
        `${this.ZOOM_API_BASE_URL}/meetings/${id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${zoomToken.access_token}`,
          },
        },
      );

      return request.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        this.logger.warn(
          `Zoom meeting ${id} not found (404). Continuing cancellation flow.`,
        );
        return;
      }

      throw error;
    }
  }

  /**
   * Retrieve token from Zoom API
   *
   * @returns {Object} { access_token, expires_in, error }
   */
  async getZoomToken(): Promise<ZoomTokenResult> {
    try {
      const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } =
        process.env;

      const accountId = ZOOM_ACCOUNT_ID ?? '';
      const clientId = ZOOM_CLIENT_ID ?? '';
      const clientSecret = ZOOM_CLIENT_SECRET ?? '';

      const request = await axios.post<ZoomTokenResponse>(
        this.ZOOM_OAUTH_ENDPOINT,
        `grant_type=account_credentials&account_id=${accountId}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
        },
      );

      const { access_token, expires_in } = request.data;

      return { access_token, expires_in, error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { access_token: null, expires_in: null, error: message };
    }
  }
}
