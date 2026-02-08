import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import cloudinary from '../config/cloudinary';

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      dest: './uploads',
    }),
  )
  async upload(@UploadedFile() file: { path: string }) {
    const res = await cloudinary.uploader.upload(file.path, {
      resource_type: 'auto',
    });

    return {
      url: res.secure_url,
      type: res.resource_type.toUpperCase(),
    };
  }
}
