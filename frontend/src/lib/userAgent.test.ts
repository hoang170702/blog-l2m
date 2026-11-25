import { describeUserAgent } from './userAgent'

describe('describeUserAgent', () => {
  it('names the OS and browser when the model is reduced away', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Android · Chrome 131')
  })

  it('keeps the phone model when the user agent still carries it', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Android SM-A155F · Samsung Internet 27')
  })

  it('never invents an iPhone model', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('iPhone · Safari 18')
  })

  it('returns null without a user agent', () => {
    expect(describeUserAgent(null)).toBeNull()
  })
})
