import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import streamifier from 'streamifier';

@Injectable()
export class FilesService {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    const cloudName = process.env.CLOUDINARY_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing Cloudinary configuration');
    }

    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async upload(
    file: Express.Multer.File,
    folder = 'temp_files',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          format: 'jpg',
          // transformation: [
          //   { quality: 'auto', fetch_format: 'auto' }, //
          // ],
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          if (!result) {
            reject(new Error('Upload failed'));
            return;
          }
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Upload a PDF buffer to Cloudinary
   * @param buffer - The PDF buffer
   * @param folder - The target folder
   * @param filename - Optional filename (without extension)
   */
  async uploadPdf(
    buffer: Buffer,
    folder = 'invoices',
    filename?: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const publicId = filename
        ? `${folder}/${filename}`
        : `${folder}/${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'raw',
          format: 'pdf',
          public_id: publicId,
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          if (!result) {
            reject(new Error('Upload failed'));
            return;
          }
          resolve(result);
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  async getUploadSignature(folder = 'temp_files') {
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `${folder}/${timestamp}-${Math.random()
      .toString(16)
      .slice(2, 8)}`;

    const signature = cloudinary.utils.api_sign_request(
      {
        public_id: publicId,
        folder,
        timestamp,
      },
      this.apiSecret,
    );

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      signature,
      folder,
      publicId,
    };
  }

  async move(oldPublicId: string, newPublicId: string) {
    return await cloudinary.uploader.rename(oldPublicId, newPublicId, {
      overwrite: true, // Replace the file if it already exists
    });
  }

  /**
   * Promote an image from temp_files to a permanent folder.
   * Returns the new publicId and secure_url.
   *
   * @param tempPublicId - The current public_id in temp_files (e.g., "temp_files/abc123")
   * @param targetFolder - The destination folder (e.g., "companies")
   * @returns The new publicId and secureUrl
   */
  async promoteImage(
    tempPublicId: string,
    targetFolder: string,
  ): Promise<{ publicId: string; secureUrl: string }> {
    // Extract just the filename from temp_files/filename
    const parts = tempPublicId.split('/');
    const filename = parts[parts.length - 1];

    // Build new public_id with target folder
    const newPublicId = `${targetFolder}/${filename}`;

    const result = await cloudinary.uploader.rename(tempPublicId, newPublicId, {
      overwrite: true,
    });

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
    };
  }

  /**
   * Schedule deletion of an old image (fire and forget).
   * Used when replacing an existing image with a new one.
   *
   * @param publicId - The public_id to delete
   */
  scheduleDelete(publicId: string): void {
    // Fire and forget - don't await, don't block the main operation
    this.delete(publicId).catch((error) => {
      console.error(`Failed to delete old image ${publicId}:`, error);
    });
  }

  async delete(publicId: string) {
    try {
      return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new BadRequestException('Delete Failed');
    }
  }
}
