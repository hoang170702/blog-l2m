import {
  centeredView,
  clampView,
  cropRect,
  minZoom,
  sliderToZoom,
  zoomToSlider,
  zoomView,
} from './crop'

const photo = { width: 4000, height: 3000 }
const frame = { width: 640, height: 360 }

describe('crop frame', () => {
  it('starts centered, cutting the 16:9 middle of a 4:3 photo', () => {
    expect(cropRect(centeredView(photo, frame), photo, frame)).toEqual({
      sx: 0,
      sy: 375,
      sw: 4000,
      sh: 2250,
    })
  })

  it('never lets a frame-filling image leave a gap', () => {
    const view = clampView({ zoom: 1, x: 50, y: -10_000 }, photo, frame)
    expect(cropRect(view, photo, frame)).toEqual({ sx: 0, sy: 750, sw: 4000, sh: 2250 })
  })

  it('zooming in keeps the middle of the frame on the same point', () => {
    const view = zoomView(centeredView(photo, frame), 2, photo, frame)
    expect(cropRect(view, photo, frame)).toEqual({ sx: 1000, sy: 938, sw: 2000, sh: 1125 })
  })

  it('zooming out shows the whole photo with room around it', () => {
    // Whole 4:3 photo just fits the 16:9 frame at zoom 0.75; the minimum is half of that.
    expect(minZoom(photo, frame)).toBeCloseTo(0.375)
    const view = zoomView(centeredView(photo, frame), 0.75, photo, frame)
    expect(cropRect(view, photo, frame)).toEqual({ sx: -667, sy: 0, sw: 5333, sh: 3000 })
  })

  it('keeps a shrunken photo inside the frame', () => {
    const view = clampView({ zoom: 0.5, x: -500, y: 500 }, photo, frame)
    const crop = cropRect(view, photo, frame)
    expect(crop.sx).toBeLessThanOrEqual(0)
    expect(crop.sx + crop.sw).toBeGreaterThanOrEqual(photo.width)
    expect(crop.sy).toBeLessThanOrEqual(0)
    expect(crop.sy + crop.sh).toBeGreaterThanOrEqual(photo.height)
  })

  it('caps the zoom', () => {
    expect(clampView({ zoom: 10, x: 0, y: 0 }, photo, frame).zoom).toBe(4)
  })
})

describe('zoom slider', () => {
  it('fills the frame in the middle, zooms in to the right and out to the left', () => {
    expect(sliderToZoom(0, 0.375)).toBe(1)
    expect(sliderToZoom(1, 0.375)).toBe(4)
    expect(sliderToZoom(-1, 0.375)).toBe(0.375)
    expect(zoomToSlider(sliderToZoom(-0.4, 0.375), 0.375)).toBeCloseTo(-0.4)
    expect(zoomToSlider(sliderToZoom(0.7, 0.375), 0.375)).toBeCloseTo(0.7)
  })
})
