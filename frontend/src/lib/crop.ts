import type { CropRect } from './image'

/** Size in pixels. */
export interface Size {
  width: number
  height: number
}

/**
 * What the crop frame shows: the image scaled by `zoom` on top of the "cover" fit, its top-left
 * corner at (x, y) in frame pixels (x, y <= 0, since the image always covers the frame).
 */
export interface CropView {
  zoom: number
  x: number
  y: number
}

export const MAX_ZOOM = 4

const coverScale = (image: Size, frame: Size) =>
  Math.max(frame.width / image.width, frame.height / image.height)

export const viewScale = (view: CropView, image: Size, frame: Size) =>
  coverScale(image, frame) * view.zoom

/** Keeps zoom in range and the frame fully covered by the image. */
export function clampView(view: CropView, image: Size, frame: Size): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom))
  const scale = coverScale(image, frame) * zoom
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value))
  return {
    zoom,
    x: clamp(view.x, frame.width - image.width * scale),
    y: clamp(view.y, frame.height - image.height * scale),
  }
}

export function centeredView(image: Size, frame: Size): CropView {
  const scale = coverScale(image, frame)
  return {
    zoom: 1,
    x: (frame.width - image.width * scale) / 2,
    y: (frame.height - image.height * scale) / 2,
  }
}

/** Zooms around the frame's center, so the point in the middle stays in the middle. */
export function zoomView(view: CropView, zoom: number, image: Size, frame: Size): CropView {
  const before = viewScale(view, image, frame)
  const after = coverScale(image, frame) * Math.min(MAX_ZOOM, Math.max(1, zoom))
  const centerX = (frame.width / 2 - view.x) / before
  const centerY = (frame.height / 2 - view.y) / before
  return clampView(
    { zoom, x: frame.width / 2 - centerX * after, y: frame.height / 2 - centerY * after },
    image,
    frame,
  )
}

/** The source-pixel region the frame shows. */
export function cropRect(view: CropView, image: Size, frame: Size): CropRect {
  const scale = viewScale(view, image, frame)
  const sw = Math.min(image.width, frame.width / scale)
  const sh = Math.min(image.height, frame.height / scale)
  return {
    sx: Math.round(Math.min(image.width - sw, Math.max(0, -view.x / scale))),
    sy: Math.round(Math.min(image.height - sh, Math.max(0, -view.y / scale))),
    sw: Math.round(sw),
    sh: Math.round(sh),
  }
}
