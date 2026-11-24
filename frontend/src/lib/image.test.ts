import { centerCrop, coverCrop } from './image'

describe('coverCrop', () => {
  it('cuts the middle of a tall photo to 16:9 and scales it to 1600x900', () => {
    expect(coverCrop(3000, 4000)).toEqual({
      sx: 0,
      sy: 1156,
      sw: 3000,
      sh: 1688,
      width: 1600,
      height: 900,
    })
  })

  it('cuts the sides of a wide panorama', () => {
    expect(coverCrop(4000, 900)).toEqual({
      sx: 1200,
      sy: 0,
      sw: 1600,
      sh: 900,
      width: 1600,
      height: 900,
    })
  })

  it('never upscales a small image', () => {
    expect(coverCrop(800, 600)).toEqual({
      sx: 0,
      sy: 75,
      sw: 800,
      sh: 450,
      width: 800,
      height: 450,
    })
  })
})

describe('centerCrop for avatars', () => {
  it('cuts a square from the middle and scales it to 400x400', () => {
    expect(centerCrop(1200, 800, 'avatar')).toEqual({
      sx: 200,
      sy: 0,
      sw: 800,
      sh: 800,
      width: 400,
      height: 400,
    })
  })
})
