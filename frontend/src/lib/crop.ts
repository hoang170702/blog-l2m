import type { CropRect } from './image'

/** Size in pixels. */
export interface Size {
  width: number
  height: number
}

/**
 * What the crop frame shows: the image scaled by `zoom` relative to the "cover" fit (zoom 1
 * fills the frame exactly; below 1 the whole picture shrinks inside it), its top-left corner at
 * (x, y) in frame pixels.
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

/**
 * Smallest zoom: half the size at which the whole picture just fits, so it can shrink with a
 * margin around it (filled by a blurred copy when saved).
 */
export function minZoom(image: Size, frame: Size) {
  const contain = Math.min(frame.width / image.width, frame.height / image.height)
  return (contain / coverScale(image, frame)) * 0.5
}

/**
 * Keeps zoom in range. Along each axis, an image larger than the frame must cover it (no gap
 * at the edge); a smaller one must stay fully inside it.
 */
export function clampView(view: CropView, image: Size, frame: Size): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom(image, frame), view.zoom))
  const scale = coverScale(image, frame) * zoom
  const axis = (value: number, frameLength: number, imageLength: number) => {
    const low = Math.min(0, frameLength - imageLength)
    const high = Math.max(0, frameLength - imageLength)
    return Math.min(high, Math.max(low, value))
  }
  return {
    zoom,
    x: axis(view.x, frame.width, image.width * scale),
    y: axis(view.y, frame.height, image.height * scale),
  }
}

export function centeredView(image: Size, frame: Size, zoom = 1): CropView {
  const scale = coverScale(image, frame) * zoom
  return {
    zoom,
    x: (frame.width - image.width * scale) / 2,
    y: (frame.height - image.height * scale) / 2,
  }
}

/** Zooms around the frame's center, so the point in the middle stays in the middle. */
export function zoomView(view: CropView, zoom: number, image: Size, frame: Size): CropView {
  const next = Math.min(MAX_ZOOM, Math.max(minZoom(image, frame), zoom))
  const before = viewScale(view, image, frame)
  const after = coverScale(image, frame) * next
  const centerX = (frame.width / 2 - view.x) / before
  const centerY = (frame.height / 2 - view.y) / before
  return clampView(
    { zoom: next, x: frame.width / 2 - centerX * after, y: frame.height / 2 - centerY * after },
    image,
    frame,
  )
}

/**
 * The region the frame shows, in source pixels. When zoomed out it reaches past the picture's
 * edges (negative sx/sy, or wider/taller than the source).
 */
export function cropRect(view: CropView, image: Size, frame: Size): CropRect {
  const scale = viewScale(view, image, frame)
  // "+ 0" turns -0 (from rounding a tiny negative) into 0.
  const round = (value: number) => Math.round(value) + 0
  return {
    sx: round(-view.x / scale),
    sy: round(-view.y / scale),
    sw: round(frame.width / scale),
    sh: round(frame.height / scale),
  }
}

/**
 * Zoom slider with "fill the frame" in the middle: -1 is the smallest zoom, 0 is zoom 1, 1 is
 * MAX_ZOOM, each side linear.
 */
export function sliderToZoom(value: number, min: number) {
  return value >= 0 ? 1 + value * (MAX_ZOOM - 1) : 1 + value * (1 - min)
}

export function zoomToSlider(zoom: number, min: number) {
  if (zoom >= 1) return (zoom - 1) / (MAX_ZOOM - 1)
  return min < 1 ? -(1 - zoom) / (1 - min) : 0
}
