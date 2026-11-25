/**
 * Read paragraphs aloud with the browser's Web Speech API (D1): the voice the reader picked
 * from the device's own voices, else the device's Vietnamese voice, else its default voice. One utterance per chunk; long paragraphs are split
 * at sentence ends because some browsers cut utterances after ~15 seconds.
 */

export type ReaderState = 'idle' | 'playing' | 'paused' | 'done'

export interface Reader {
  play(): void
  pause(): void
  resume(): void
  stop(): void
  readonly state: ReaderState
  readonly hasVietnameseVoice: boolean
  onChange(listener: (state: ReaderState) => void): () => void
}

const MAX_CHUNK = 800

export function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  )
}

function isVietnamese(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith('vi')
}

/**
 * The voice the reader chose (by `voiceURI`) when the device still has it, else the first
 * Vietnamese voice, else null for the browser default.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferred?: string | null,
): SpeechSynthesisVoice | null {
  const chosen = preferred ? voices.find((voice) => voice.voiceURI === preferred) : undefined
  return chosen ?? voices.find(isVietnamese) ?? null
}

/** Every device voice for the picker: Vietnamese first, then by language and name. */
export function sortVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices].sort(
    (a, b) =>
      Number(isVietnamese(b)) - Number(isVietnamese(a)) ||
      a.lang.localeCompare(b.lang) ||
      a.name.localeCompare(b.name),
  )
}

const VOICE_KEY = 'read-aloud-voice'

/** The voice picked on this device, or null for automatic. */
export function getSavedVoice(storage: Pick<Storage, 'getItem'> = localStorage): string | null {
  try {
    return storage.getItem(VOICE_KEY) || null
  } catch {
    return null
  }
}

export function saveVoice(
  voiceURI: string | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
) {
  try {
    if (voiceURI) storage.setItem(VOICE_KEY, voiceURI)
    else storage.removeItem(VOICE_KEY)
  } catch {
    // Private mode or full storage: the choice simply is not remembered.
  }
}

export function chunk(paragraph: string, max = MAX_CHUNK): string[] {
  if (paragraph.length <= max) return [paragraph]
  const pieces: string[] = []
  let current = ''
  for (const sentence of paragraph.split(/(?<=[.!?…])\s+/)) {
    if (current && current.length + sentence.length + 1 > max) {
      pieces.push(current)
      current = sentence
    } else current = current ? `${current} ${sentence}` : sentence
  }
  if (current) pieces.push(current)
  return pieces
}

export function createReader(
  paragraphs: string[],
  options: { rate?: number; voiceURI?: string | null } = {},
): Reader {
  const synth = window.speechSynthesis
  const chunks = paragraphs.flatMap((paragraph) => chunk(paragraph))
  const listeners = new Set<(state: ReaderState) => void>()
  let state: ReaderState = 'idle'
  let index = 0
  let voices = synth.getVoices()
  let voice = pickVoice(voices, options.voiceURI)
  // Voices load asynchronously in Chrome; refresh the choice when they arrive.
  synth.addEventListener?.('voiceschanged', () => {
    voices = synth.getVoices()
    voice = pickVoice(voices, options.voiceURI)
  })

  function set(next: ReaderState) {
    state = next
    listeners.forEach((listener) => listener(next))
  }

  function speakNext() {
    if (index >= chunks.length) {
      set('done')
      return
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index])
    utterance.lang = voice?.lang ?? 'vi-VN'
    if (voice) utterance.voice = voice
    utterance.rate = options.rate ?? 1
    utterance.onend = () => {
      if (state !== 'playing') return
      index += 1
      speakNext()
    }
    utterance.onerror = (event) => {
      // "interrupted"/"canceled" follow our own stop(); anything else ends the reading.
      if (event.error === 'interrupted' || event.error === 'canceled') return
      set('done')
    }
    synth.speak(utterance)
  }

  return {
    get state() {
      return state
    },
    get hasVietnameseVoice() {
      return voices.some(isVietnamese)
    },
    play() {
      synth.cancel()
      index = 0
      set('playing')
      speakNext()
    },
    pause() {
      if (state !== 'playing') return
      synth.pause()
      set('paused')
    },
    resume() {
      if (state !== 'paused') return
      set('playing')
      synth.resume()
    },
    stop() {
      set('idle')
      synth.cancel()
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
