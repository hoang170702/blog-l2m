import { centeredView, clampView, cropRect, zoomView } from './crop'

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

  it('never lets the image leave a gap in the frame', () => {
    const view = clampView({ zoom: 1, x: 50, y: -10_000 }, photo, frame)
    expect(cropRect(view, photo, frame)).toEqual({ sx: 0, sy: 750, sw: 4000, sh: 2250 })
  })

  it('zooming in keeps the middle of the frame on the same point', () => {
    const view = zoomView(centeredView(photo, frame), 2, photo, frame)
    expect(cropRect(view, photo, frame)).toEqual({ sx: 1000, sy: 938, sw: 2000, sh: 1125 })
  })

  it('caps the zoom', () => {
    expect(clampView({ zoom: 10, x: 0, y: 0 }, photo, frame).zoom).toBe(4)
  })
})
