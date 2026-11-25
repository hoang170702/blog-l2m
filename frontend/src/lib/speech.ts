/**
 * Read paragraphs aloud with the browser's Web Speech API (D1): the device's Vietnamese voice
 * when it has one, else its default voice. One utterance per chunk; long paragraphs are split
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

/** First voice whose language starts with "vi", or null for the browser default. */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('vi')) ?? null
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

export function createReader(paragraphs: string[], options: { rate?: number } = {}): Reader {
  const synth = window.speechSynthesis
  const chunks = paragraphs.flatMap((paragraph) => chunk(paragraph))
  const listeners = new Set<(state: ReaderState) => void>()
  let state: ReaderState = 'idle'
  let index = 0
  let voice = pickVoice(synth.getVoices())
  // Voices load asynchronously in Chrome; refresh the choice when they arrive.
  synth.addEventListener?.('voiceschanged', () => {
    voice = pickVoice(synth.getVoices())
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
      return voice !== null
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
