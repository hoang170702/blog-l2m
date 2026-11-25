import { useState } from 'react'
import {
  DEFAULT_PREFS,
  FONTS,
  SIZES,
  getPrefs,
  isDefault,
  setPrefs,
  type FontId,
  type ReadingPrefs as Prefs,
} from '../lib/readingPrefs'

/** "Tuỳ chỉnh đọc": text size stepper and font picker, remembered on the device. */
export function ReadingPrefs() {
  const [prefs, setCurrent] = useState<Prefs>(() => getPrefs())
  const sizeIndex = SIZES.findIndex((s) => s.id === prefs.size)

  function update(next: Prefs) {
    setPrefs(next)
    setCurrent(next)
  }
  function step(delta: number) {
    const target = SIZES[sizeIndex + delta]
    if (target) update({ ...prefs, size: target.id })
  }

  const button =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-line bg-surface px-2 text-sm font-semibold transition hover:bg-primary-soft hover:text-primary-dark disabled:opacity-40 disabled:hover:bg-surface'

  return (
    <div
      role="group"
      aria-label="Tuỳ chỉnh đọc"
      className="card flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
    >
      <span className="font-bold">Aa Tuỳ chỉnh đọc</span>
      <span className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className={button}
          onClick={() => step(-1)}
          disabled={sizeIndex <= 0}
          aria-label="Chữ nhỏ hơn"
        >
          A−
        </button>
        <span className="min-w-14 text-center text-muted" aria-live="polite">
          {SIZES[sizeIndex]?.label}
        </span>
        <button
          type="button"
          className={button}
          onClick={() => step(1)}
          disabled={sizeIndex >= SIZES.length - 1}
          aria-label="Chữ lớn hơn"
        >
          A+
        </button>
      </span>
      <label className="flex items-center gap-1 text-muted">
        <span className="sr-only">Font chữ</span>
        <select
          value={prefs.font}
          onChange={(e) => update({ ...prefs, font: e.target.value as FontId })}
          className="input w-auto py-1 text-sm"
        >
          {FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      {!isDefault(prefs) && (
        <button
          type="button"
          onClick={() => update(DEFAULT_PREFS)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Về mặc định
        </button>
      )}
    </div>
  )
}
