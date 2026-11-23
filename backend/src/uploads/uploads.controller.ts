import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../auth/admin.guard.js';
import { MAX_UPLOAD_BYTES, UploadsService } from './uploads.service.js';

@Controller('admin/uploads')
@UseGuards(AdminGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.uploads.saveImage(file);
  }
}
