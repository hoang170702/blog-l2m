/** Client-side image preparation before upload: the bucket caps files at 2 MiB. */

// Every cover uses one 16:9 frame (D37): the home card and the top of the post.
// Avatars are square and small.
const SHAPES = {
  cover: { ratio: 16 / 9, maxWidth: 1600 },
  avatar: { ratio: 1, maxWidth: 400 },
} as const
export type ImageShape = keyof typeof SHAPES

/** Width / height of the frame an image of this shape is cut to. */
export const shapeRatio = (shape: ImageShape) => SHAPES[shape].ratio

/** Region of the source image to keep, in source pixels. */
export interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}
const MAX_BYTES = 2 * 1024 * 1024
const QUALITY = 0.9
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface PreparedImage {
  blob: Blob
  contentType: string
  extension: 'webp' | 'jpg' | 'png' | 'gif'
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/** Source rectangle (centered, in the shape's ratio) and output size (never upscaled). */
export function centerCrop(sourceWidth: number, sourceHeight: number, shape: ImageShape) {
  const { ratio, maxWidth } = SHAPES[shape]
  const sw = Math.min(sourceWidth, Math.round(sourceHeight * ratio))
  const sh = Math.min(sourceHeight, Math.round(sw / ratio))
  const width = Math.min(maxWidth, sw)
  return {
    sx: Math.round((sourceWidth - sw) / 2),
    sy: Math.round((sourceHeight - sh) / 2),
    sw,
    sh,
    width,
    height: Math.round(width / ratio),
  }
}

export const coverCrop = (sourceWidth: number, sourceHeight: number) =>
  centerCrop(sourceWidth, sourceHeight, 'cover')

/** Output size for a crop: the shape's maximum width, never larger than the cropped region. */
export function outputSize(crop: CropRect, shape: ImageShape) {
  const { ratio, maxWidth } = SHAPES[shape]
  const width = Math.max(1, Math.min(maxWidth, Math.round(crop.sw)))
  return { width, height: Math.max(1, Math.round(width / ratio)) }
}

/**
 * Draws the crop at the target size. Large reductions are done in halving steps with
 * high-quality smoothing: a single big step makes browsers sample coarsely, which blurs and
 * roughens edges.
 */
function drawCrop(source: CanvasImageSource, crop: CropRect, width: number, height: number) {
  let current: CanvasImageSource = source
  let { sx, sy, sw, sh } = crop
  while (sw / 2 >= width && sh / 2 >= height) {
    const step = document.createElement('canvas')
    step.width = Math.round(sw / 2)
    step.height = Math.round(sh / 2)
    const context = step.getContext('2d')
    if (!context) break
    context.imageSmoothingQuality = 'high'
    context.drawImage(current, sx, sy, sw, sh, 0, 0, step.width, step.height)
    current = step
    sx = 0
    sy = 0
    sw = step.width
    sh = step.height
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Trình duyệt không xử lý được ảnh.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(current, sx, sy, sw, sh, 0, 0, width, height)
  return canvas
}

/**
 * Cuts the chosen region (centered when `crop` is omitted) in the shape's frame (cover: 16:9
 * up to 1600x900; avatar: square up to 400x400) and re-encodes as WebP (JPEG where WebP
 * encoding is unsupported).
 */
export async function prepareImage(
  file: File,
  shape: ImageShape = 'cover',
  crop?: CropRect,
): Promise<PreparedImage> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF.')
  }

  // GIFs are kept as-is so animations survive; CSS crops them to the frame.
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new Error('Ảnh GIF vượt quá 2 MB.')
    return { blob: file, contentType: 'image/gif', extension: 'gif' }
  }

  const bitmap = await createImageBitmap(file)
  const region = crop ?? centerCrop(bitmap.width, bitmap.height, shape)
  const { width, height } = outputSize(region, shape)
  const canvas = drawCrop(bitmap, region, width, height)
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
