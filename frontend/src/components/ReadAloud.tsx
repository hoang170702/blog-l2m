import { useEffect, useMemo, useState } from 'react'
import { markdownToParagraphs } from '../lib/markdownText'
import { createReader, supported, type Reader, type ReaderState } from '../lib/speech'

const RATES = [0.8, 1, 1.25, 1.5]

/** "Nghe bài viết": the browser reads the post with the device voice (D1). Hidden when unsupported. */
export function ReadAloud({ title, markdown }: { title: string; markdown: string }) {
  const paragraphs = useMemo(() => [title, ...markdownToParagraphs(markdown)], [title, markdown])
  const [rate, setRate] = useState(1)
  const [state, setState] = useState<ReaderState>('idle')
  const [reader, setReader] = useState<Reader | null>(null)

  // A new reader per post and rate; leaving the page or changing the post stops the speech.
  useEffect(() => {
    if (!supported()) return
    const instance = createReader(paragraphs, { rate })
    const off = instance.onChange(setState)
    // Deferred so the effect itself does not set state synchronously.
    const timer = setTimeout(() => setReader(instance), 0)
    return () => {
      clearTimeout(timer)
      off()
      instance.stop()
    }
  }, [paragraphs, rate])

  if (!supported()) return null
  const current = reader
  // Before the effect ran there is no reader yet; assume a voice rather than flash the note.
  const hasVoice = current?.hasVietnameseVoice ?? true
  const button =
    'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold transition hover:border-primary hover:text-primary disabled:opacity-50'

  return (
    <div
      role="group"
      aria-label="Nghe bài viết"
      className="card mt-6 flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
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
        <button type="button" className={button} onClick={() => current?.play()}>
          ▶ Nghe
        </button>
      )}
      {(state === 'playing' || state === 'paused') && (
        <button type="button" className={button} onClick={() => current?.stop()}>
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
      {!hasVoice && (
        <p className="w-full text-xs text-muted">
          Thiết bị không có giọng tiếng Việt, dùng giọng mặc định.
        </p>
      )}
    </div>
  )
}
