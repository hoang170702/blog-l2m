/** Client-side image preparation before upload: the bucket caps files at 2 MiB. */

const MAX_DIMENSION = 1600
const MAX_BYTES = 2 * 1024 * 1024
const QUALITY = 0.85
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface PreparedImage {
  blob: Blob
  contentType: string
  extension: 'webp' | 'jpg' | 'png' | 'gif'
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/** Resizes to at most 1600px and re-encodes as WebP (JPEG where WebP encoding is unsupported). */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF.')
  }

  // GIFs are kept as-is so animations survive.
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new Error('Ảnh GIF vượt quá 2 MB.')
    return { blob: file, contentType: 'image/gif', extension: 'gif' }
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Trình duyệt không xử lý được ảnh.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // Browsers without a WebP encoder silently return PNG, so check the result type.
  const webp = await toBlob(canvas, 'image/webp')
  const prepared: PreparedImage | null =
    webp?.type === 'image/webp'
      ? { blob: webp, contentType: 'image/webp', extension: 'webp' }
      : await toBlob(canvas, 'image/jpeg').then((jpeg) =>
          jpeg ? { blob: jpeg, contentType: 'image/jpeg', extension: 'jpg' } : null,
        )
  if (!prepared) throw new Error('Không nén được ảnh.')
  if (prepared.blob.size > MAX_BYTES) throw new Error('Ảnh sau khi nén vẫn vượt quá 2 MB.')
  return prepared
}
