/**
 * Read paragraphs aloud with the browser's Web Speech API (D1): the voice the reader picked
 * from the device's own voices, else the device's Vietnamese voice, else its default voice.
 * Paragraphs are split into chunks at sentence ends (the unit for seeking and progress), and
 * consecutive chunks are spoken together as one utterance (see GROUP), in every browser.
 */

export type ReaderState = 'idle' | 'playing' | 'paused' | 'done'

export interface Reader {
  /** Starts from chunk `from` (default the beginning), e.g. to continue after a rate change. */
  play(from?: number): void
  pause(): void
  resume(): void
  stop(): void
  readonly state: ReaderState
  /** Index of the chunk being read. */
  readonly position: number
  /** The text split for seeking and progress (several are spoken per utterance); `position` indexes it. */
  readonly chunks: readonly string[]
  readonly hasVietnameseVoice: boolean
  onChange(listener: (state: ReaderState) => void): () => void
  /** Called with `position` each time a chunk starts. */
  onProgress(listener: (position: number) => void): () => void
}

const MAX_CHUNK = 800
// Starting an utterance costs seconds with online voices (Edge "… Online", 4-5 s measured), so
// consecutive chunks are spoken together, up to this many characters per utterance, and the
// next utterance is queued while the current one plays.
const GROUP = 800
// Chrome's "Google …" voices stop an utterance after about 15 seconds.
const GROUP_GOOGLE = 200
const LOOKAHEAD = 2

/** Chunks `from`..`to - 1` spoken as one utterance, at most `limit` characters (always one chunk). */
export function group(chunks: readonly string[], from: number, limit: number): number {
  let to = from + 1
  let length = chunks[from]?.length ?? 0
  while (to < chunks.length && length + 1 + chunks[to].length <= limit) {
    length += 1 + chunks[to].length
    to += 1
  }
  return to
}

/** Ends every chunk with punctuation so a heading is not run into the next sentence. */
function sentence(text: string): string {
  return /[.!?…:;]$/.test(text) ? text : `${text}.`
}

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
  const progressListeners = new Set<(position: number) => void>()
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

  // Bumped by play() and stop(): events of utterances from an earlier run are ignored (Safari
  // fires onend for utterances removed by cancel()).
  let run = 0
  let queued = 0 // first chunk not yet handed to the browser
  let ahead = 0 // utterances handed over and not finished

  function moveTo(next: number) {
    if (next === index) return
    index = next
    progressListeners.forEach((listener) => listener(index))
  }

  function fill(current: number) {
    const limit = (voice?.name ?? '').startsWith('Google') ? GROUP_GOOGLE : GROUP
    while (queued < chunks.length && ahead < LOOKAHEAD) {
      const to = group(chunks, queued, limit)
      speak(queued, to, current)
      queued = to
      ahead += 1
    }
  }

  function speak(from: number, to: number, current: number) {
    const parts = chunks.slice(from, to).map(sentence)
    // Character offset where each chunk starts, to follow word boundaries back to a chunk.
    const starts: number[] = []
    let offset = 0
    for (const part of parts) {
      starts.push(offset)
      offset += part.length + 1
    }
    const utterance = new SpeechSynthesisUtterance(parts.join(' '))
    utterance.lang = voice?.lang ?? 'vi-VN'
    if (voice) utterance.voice = voice
    utterance.rate = options.rate ?? 1
    utterance.onboundary = (event) => {
      if (current !== run) return
      let k = starts.length - 1
      while (k > 0 && starts[k] > event.charIndex) k -= 1
      moveTo(from + k)
    }
    utterance.onend = () => {
      if (current !== run) return
      ahead -= 1
      if (to >= chunks.length) {
        set('done')
        return
      }
      moveTo(to)
      fill(current)
    }
    utterance.onerror = (event) => {
      // "interrupted"/"canceled" follow our own stop(); anything else ends the reading.
      if (current !== run || event.error === 'interrupted' || event.error === 'canceled') return
      set('done')
    }
    synth.speak(utterance)
  }

  return {
    get state() {
      return state
    },
    get position() {
      return index
    },
    chunks,
    get hasVietnameseVoice() {
      return voices.some(isVietnamese)
    },
    play(from = 0) {
      synth.cancel()
      // Chrome stays paused across cancel(), so a reading paused before would never start.
      if (synth.paused) synth.resume()
      index = from >= 0 && from < chunks.length ? from : 0
      queued = index
      ahead = 0
      run += 1
      set('playing')
      progressListeners.forEach((listener) => listener(index))
      fill(run)
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
      run += 1
      set('idle')
      synth.cancel()
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onProgress(listener) {
      progressListeners.add(listener)
      return () => progressListeners.delete(listener)
    },
  }
}
