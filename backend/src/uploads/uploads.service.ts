import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AppEnv } from '../config/env.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Detects the real image type from magic bytes; the client-sent name and MIME type are ignored. */
export async function detectImageExtension(
  buffer: Uint8Array,
): Promise<string> {
  const type = await fileTypeFromBuffer(buffer);
  const extension = type ? ALLOWED_TYPES[type.mime] : undefined;
  if (!extension) {
    throw new BadRequestException(
      'Only JPEG, PNG, WebP and GIF images are allowed',
    );
  }
  return extension;
}

@Injectable()
export class UploadsService {
  readonly directory: string;

  constructor(config: ConfigService<AppEnv, true>) {
    this.directory = resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  async saveImage(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const extension = await detectImageExtension(file.buffer);
    const name = `${randomUUID()}.${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, name), file.buffer, { flag: 'wx' });
    return { url: `/uploads/${name}` };
  }
}
