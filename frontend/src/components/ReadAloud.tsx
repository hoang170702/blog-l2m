import { useEffect, useMemo, useRef, useState } from 'react'
import { markdownToParagraphs } from '../lib/markdownText'
import {
  createReader,
  getSavedVoice,
  saveVoice,
  sortVoices,
  supported,
  type Reader,
  type ReaderState,
} from '../lib/speech'

const RATES = [0.8, 1, 1.25, 1.5]

/** "Nghe bài viết": the browser reads the post with the device voice (D1). Hidden when unsupported. */
export function ReadAloud({ title, markdown }: { title: string; markdown: string }) {
  const paragraphs = useMemo(() => [title, ...markdownToParagraphs(markdown)], [title, markdown])
  const [rate, setRate] = useState(1)
  const [voiceURI, setVoiceURI] = useState(() => getSavedVoice())
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    supported() ? sortVoices(window.speechSynthesis.getVoices()) : [],
  )
  const [state, setState] = useState<ReaderState>('idle')
  const [reader, setReader] = useState<Reader | null>(null)
  // Chunk being read, or where the next "Nghe" starts.
  const [position, setPosition] = useState(0)
  // Where to continue when the rate or voice changes mid-reading (same post only).
  const resume = useRef<{ paragraphs: string[]; position: number } | null>(null)

  // Chrome fills the voice list asynchronously.
  useEffect(() => {
    if (!supported()) return
    const synth = window.speechSynthesis
    const update = () => setVoices(sortVoices(synth.getVoices()))
    synth.addEventListener?.('voiceschanged', update)
    return () => synth.removeEventListener?.('voiceschanged', update)
  }, [])

  // A new reader per post, rate and voice; leaving the page or changing the post stops the speech,
  // changing the rate or voice while reading continues from the current chunk.
  useEffect(() => {
    if (!supported()) return
    const instance = createReader(paragraphs, { rate, voiceURI })
    const off = instance.onChange(setState)
    const offProgress = instance.onProgress(setPosition)
    const from = resume.current?.paragraphs === paragraphs ? resume.current.position : null
    resume.current = null
    let started = false
    // Deferred so the effect itself does not set state synchronously.
    const timer = setTimeout(() => {
      started = true
      setReader(instance)
      if (from === null) setState(instance.state)
      else instance.play(from)
    }, 0)
    return () => {
      clearTimeout(timer)
      const active = instance.state === 'playing' || instance.state === 'paused'
      if (active) resume.current = { paragraphs, position: instance.position }
      else if (!started && from !== null) resume.current = { paragraphs, position: from }
      off()
      offProgress()
      instance.stop()
    }
  }, [paragraphs, rate, voiceURI])

  if (!supported()) return null
  const current = reader
  // Before the effect ran there is no reader yet; assume a voice rather than flash the note.
  const hasVoice = current?.hasVietnameseVoice ?? true
  const chunks = current?.chunks ?? []
  const at = Math.min(position, Math.max(chunks.length - 1, 0))
  const active = state === 'playing' || state === 'paused'

  function seek(target: number) {
    setPosition(target)
    if (active) current?.play(target)
  }
  const button =
    'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold transition hover:border-primary hover:text-primary disabled:opacity-50'

  return (
    <div
      role="group"
      aria-label="Nghe bài viết"
      className="card flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
    >
      <span className="font-bold">🔊 Nghe bài viết</span>
      {state === 'playing' ? (
        <button type="button" className={button} onClick={() => current?.pause()}>
          ❚❚ Tạm dừng
        </button>
      ) : state === 'paused' ? (
        <button type="button" className={button} onClick={() => current?.resume()}>
          ▶ Tiếp tục
        </button>
      ) : (
        <button
          type="button"
          className={button}
          onClick={() => current?.play(state === 'done' ? 0 : at)}
        >
          ▶ Nghe
        </button>
      )}
      {active && (
        <button
          type="button"
          className={button}
          onClick={() => {
            current?.stop()
            setPosition(0)
          }}
        >
          ■ Dừng
        </button>
      )}
      <label className="ml-auto flex items-center gap-1 text-muted">
        Tốc độ
        <select
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="input w-auto py-1 text-sm"
        >
          {RATES.map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
      </label>
      {chunks.length > 1 && (
        <div className="w-full">
          <label className="flex items-center gap-2 text-muted">
            <span className="shrink-0 tabular-nums">
              Đoạn {at + 1}/{chunks.length}
            </span>
            <input
              type="range"
              min={0}
              max={chunks.length - 1}
              value={at}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Đoạn đang nghe"
              className="min-w-0 flex-1 accent-primary"
            />
          </label>
          <p className="mt-1 truncate text-xs text-muted" title={chunks[at]}>
            {chunks[at]}
          </p>
        </div>
      )}
      {voices.length > 0 && (
        <label className="flex w-full items-center gap-1 text-muted">
          Giọng
          <select
            value={voices.some((voice) => voice.voiceURI === voiceURI) ? (voiceURI ?? '') : ''}
            onChange={(e) => {
              const next = e.target.value || null
              saveVoice(next)
              setVoiceURI(next)
            }}
            className="input min-w-0 flex-1 py-1 text-sm"
          >
            <option value="">Tự động (tiếng Việt nếu có)</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </label>
      )}
      {!hasVoice && !voiceURI && (
        <p className="w-full text-xs text-muted">
          Thiết bị không có giọng tiếng Việt, dùng giọng mặc định.
        </p>
      )}
    </div>
  )
}
