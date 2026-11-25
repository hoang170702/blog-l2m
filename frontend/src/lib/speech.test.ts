import {
  chunk,
  createReader,
  getSavedVoice,
  group,
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
  onboundary: ((event: { charIndex: number }) => void) | null
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
      onboundary: ((event: { charIndex: number }) => void) | null = null
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

  // Long enough that two of them never fit in one utterance.
  const long = (word: string) => `${`${word} `.repeat(125).trim()}.`
  const [A, B, C] = [long('Một'), long('Hai'), long('Ba')]

  it('groups consecutive chunks up to the limit, always at least one', () => {
    expect(group(['a', 'b', 'c'], 0, 3)).toBe(2)
    expect(group(['a', 'b', 'c'], 1, 100)).toBe(3)
    expect(group([A, B], 0, 10)).toBe(1)
  })

  it('speaks short paragraphs as one utterance, ending headings with a stop', () => {
    const { synth, spoken } = fakeSynth()
    createReader(['Mở đầu', 'Xin chào.']).play()
    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(spoken[0].text).toBe('Mở đầu. Xin chào.')
  })

  it('reads utterances one after another and reports its state', () => {
    const { synth, spoken } = fakeSynth([{ lang: 'vi-VN' }])
    const reader = createReader([A, B], { rate: 1.25 })
    const states: string[] = []
    reader.onChange((state) => states.push(state))
    expect(reader.hasVietnameseVoice).toBe(true)

    reader.play()
    // The next utterance is queued right away so the browser reads them back to back.
    expect(synth.speak).toHaveBeenCalledTimes(2)
    expect(spoken[0]).toMatchObject({ text: A, rate: 1.25, lang: 'vi-VN' })
    expect(spoken[1].text).toBe(B)
    spoken[0].onend!()
    expect(reader.position).toBe(1)
    reader.pause()
    expect(synth.pause).toHaveBeenCalled()
    reader.resume()
    expect(synth.resume).toHaveBeenCalled()
    spoken[1].onend!()
    expect(states).toEqual(['playing', 'paused', 'playing', 'done'])
  })

  it('starts from a given chunk and falls back to the beginning', () => {
    const { spoken } = fakeSynth()
    const reader = createReader([A, B, C])
    reader.play(1)
    expect(spoken[0].text).toBe(B)
    expect(reader.position).toBe(1)
    spoken[0].onend!()
    expect(reader.position).toBe(2)
    const before = spoken.length
    reader.play(9)
    expect(spoken[before].text).toBe(A)
  })

  it('follows word boundaries to the chunk being read', () => {
    const { spoken } = fakeSynth()
    const reader = createReader(['Một.', 'Hai.'])
    const positions: number[] = []
    reader.onProgress((position) => positions.push(position))
    expect(reader.chunks).toEqual(['Một.', 'Hai.'])
    reader.play()
    spoken[0].onboundary!({ charIndex: 0 })
    spoken[0].onboundary!({ charIndex: 'Một. '.length })
    expect(positions).toEqual([0, 1])
    spoken[0].onend!()
    expect(reader.state).toBe('done')
  })

  it('keeps one utterance queued ahead while reading', () => {
    const { spoken } = fakeSynth()
    const reader = createReader([A, B, C])
    reader.play()
    expect(spoken.map((u) => u.text)).toEqual([A, B])
    spoken[0].onend!()
    expect(spoken.map((u) => u.text)).toEqual([A, B, C])
  })

  it('uses short utterances for Chrome Google voices, which stop after about 15 seconds', () => {
    const google = { lang: 'vi-VN', name: 'Google tiếng Việt', voiceURI: 'g' }
    const { spoken } = fakeSynth([google])
    const part = `${'chữ '.repeat(40).trim()}.`
    createReader([part, part, part], { voiceURI: 'g' }).play()
    expect(spoken[0].text).toBe(part)
  })

  it('ignores events of utterances from before a restart', () => {
    const { spoken } = fakeSynth()
    const reader = createReader([A, B, C])
    reader.play()
    reader.play(2)
    // Safari reports the cancelled first run as ended.
    spoken[0].onend!()
    expect(reader.position).toBe(2)
    expect(reader.state).toBe('playing')
  })

  it('stop cancels and does not continue the queue', () => {
    const { synth, spoken } = fakeSynth()
    const reader = createReader([A, B, C])
    reader.play()
    reader.stop()
    spoken[0].onend!()
    expect(synth.cancel).toHaveBeenCalled()
    expect(synth.speak).toHaveBeenCalledTimes(2)
    expect(reader.state).toBe('idle')
    expect(reader.hasVietnameseVoice).toBe(false)
  })
})
