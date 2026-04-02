import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadSignaturePayload } from '@ascencio/shared';
import { UploadApiResponse } from 'cloudinary';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('signature')
  signImage(@Body('folder') folder?: string): UploadSignaturePayload {
    return this.filesService.getUploadSignature(folder);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor(
      'file',
      //   {
      //   fileFilter: FileFilter,
      // }
    ),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ): Promise<UploadApiResponse> {
    return this.filesService.upload(file, folder);
  }

  @Post('move')
  async moveFile(
    @Body('publicId') publicId: string,
    @Body('targetFolder') targetFolder: string,
  ): Promise<unknown> {
    if (!publicId || !targetFolder) {
      throw new Error('publicId and targetFolder are required');
    }

    // Extract filename from publicId (e.g., "temp_files/abc123" -> "abc123")
    const parts = publicId.split('/');
    const filename = parts[parts.length - 1];

    // Create new publicId with target folder
    const newPublicId = `${targetFolder}/${filename}`;

    return this.filesService.move(publicId, newPublicId);
  }

  @Delete(':publicId')
  async deleteFile(@Param('publicId') publicId: string): Promise<unknown> {
    return this.filesService.delete(publicId);
  }
}
