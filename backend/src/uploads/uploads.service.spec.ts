import { BadRequestException } from '@nestjs/common';
import { detectImageExtension } from './uploads.service.js';

const PNG_HEADER = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
]);

describe('detectImageExtension', () => {
  it('accepts real PNG bytes', async () => {
    await expect(detectImageExtension(PNG_HEADER)).resolves.toBe('png');
  });

  it('rejects a script disguised as an image', async () => {
    const fake = new TextEncoder().encode('<script>alert(1)</script>');
    await expect(detectImageExtension(fake)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
