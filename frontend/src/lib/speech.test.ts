import {
  chunk,
  createReader,
  getSavedVoice,
  pickVoice,
  saveVoice,
  sortVoices,
  supported,
} from './speech'

type Utterance = {
  text: string
  rate: number
  lang: string
  voice: unknown
  onend: (() => void) | null
}

function fakeSynth(voices: Partial<SpeechSynthesisVoice>[] = []) {
  const spoken: Utterance[] = []
  const synth = {
    speak: vi.fn((utterance: Utterance) => spoken.push(utterance)),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => voices,
    addEventListener: vi.fn(),
  }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      rate = 1
      lang = ''
      voice: unknown = null
      onend: (() => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      text: string
      constructor(text: string) {
        this.text = text
      }
    },
  )
  return { synth, spoken }
}

afterEach(() => vi.unstubAllGlobals())

describe('speech', () => {
  it('detects support', () => {
    fakeSynth()
    expect(supported()).toBe(true)
  })

  it('prefers a Vietnamese voice and otherwise the default', () => {
    const vi1 = { lang: 'vi-VN' } as SpeechSynthesisVoice
    expect(pickVoice([{ lang: 'en-US' } as SpeechSynthesisVoice, vi1])).toBe(vi1)
    expect(pickVoice([{ lang: 'en-US' } as SpeechSynthesisVoice])).toBeNull()
  })

  it('uses the picked voice while the device has it, else falls back to Vietnamese', () => {
    const viVoice = { lang: 'vi-VN', voiceURI: 'vi' } as SpeechSynthesisVoice
    const enVoice = { lang: 'en-US', voiceURI: 'en' } as SpeechSynthesisVoice
    expect(pickVoice([viVoice, enVoice], 'en')).toBe(enVoice)
    expect(pickVoice([viVoice, enVoice], 'gone')).toBe(viVoice)
  })

  it('lists Vietnamese voices first, then by language and name', () => {
    const voices = [
      { lang: 'fr-FR', name: 'Amélie' },
      { lang: 'en-US', name: 'Zoe' },
      { lang: 'vi-VN', name: 'Linh' },
      { lang: 'en-US', name: 'Alex' },
    ] as SpeechSynthesisVoice[]
    expect(sortVoices(voices).map((voice) => voice.name)).toEqual(['Linh', 'Alex', 'Zoe', 'Amélie'])
  })

  it('remembers the picked voice and forgets it on automatic', () => {
    saveVoice('en')
    expect(getSavedVoice()).toBe('en')
    saveVoice(null)
    expect(getSavedVoice()).toBeNull()
  })

  it('speaks with the picked voice and still reports a missing Vietnamese voice', () => {
    const enVoice = { lang: 'en-US', voiceURI: 'en' }
    const { spoken } = fakeSynth([enVoice])
    const reader = createReader(['Hello'], { voiceURI: 'en' })
    reader.play()
    expect(spoken[0]?.voice).toBe(enVoice)
    expect(spoken[0]?.lang).toBe('en-US')
    expect(reader.hasVietnameseVoice).toBe(false)
  })

  it('splits long paragraphs at sentence ends', () => {
    const sentence = 'Câu này dài vừa đủ để thử. '
    const pieces = chunk(sentence.repeat(60).trim(), 200)
    expect(pieces.length).toBeGreaterThan(5)
    expect(pieces.every((piece) => piece.length <= 200 && piece.endsWith('.'))).toBe(true)
  })

  it('reads paragraphs one after another and reports its state', () => {
    const { synth, spoken } = fakeSynth([{ lang: 'vi-VN' }])
    const reader = createReader(['Một.', 'Hai.'], { rate: 1.25 })
    const states: string[] = []
    reader.onChange((state) => states.push(state))
    expect(reader.hasVietnameseVoice).toBe(true)

    reader.play()
    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(spoken[0]).toMatchObject({ text: 'Một.', rate: 1.25, lang: 'vi-VN' })
    spoken[0].onend!()
    expect(spoken[1].text).toBe('Hai.')
    reader.pause()
    expect(synth.pause).toHaveBeenCalled()
    reader.resume()
    expect(synth.resume).toHaveBeenCalled()
    spoken[1].onend!()
    expect(states).toEqual(['playing', 'paused', 'playing', 'done'])
  })

  it('stop cancels and does not continue the queue', () => {
    const { synth, spoken } = fakeSynth()
    const reader = createReader(['Một.', 'Hai.'])
    reader.play()
    reader.stop()
    spoken[0].onend!()
    expect(synth.cancel).toHaveBeenCalled()
    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(reader.state).toBe('idle')
    expect(reader.hasVietnameseVoice).toBe(false)
  })
})
