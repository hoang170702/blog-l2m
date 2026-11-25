/**
 * Reading preferences (PLAN-20261125-reading-prefs): text size for the post body and comments,
 * font family for the whole site. Device-local, like the theme. The defaults reproduce the
 * blog exactly as it looked before the control existed (D1).
 */

export const FONTS = [
  { id: 'default', label: 'Mặc định (Plus Jakarta Sans)' },
  { id: 'be-vietnam', label: 'Be Vietnam Pro' },
  { id: 'lora', label: 'Lora (có chân)' },
  { id: 'system', label: 'Font hệ thống' },
] as const

/** Post-body font size in px; index 1 is today's `prose-lg` size. */
export const SIZES = [
  { id: 'sm', label: 'Nhỏ', px: 16 },
  { id: 'md', label: 'Vừa', px: 18 },
  { id: 'lg', label: 'Lớn', px: 20 },
  { id: 'xl', label: 'Rất lớn', px: 22 },
] as const

export type FontId = (typeof FONTS)[number]['id']
export type SizeId = (typeof SIZES)[number]['id']
export type ReadingPrefs = { font: FontId; size: SizeId }

export const DEFAULT_PREFS: ReadingPrefs = { font: 'default', size: 'md' }

const KEY = 'reading-prefs'

function isFont(value: unknown): value is FontId {
  return FONTS.some((f) => f.id === value)
}
function isSize(value: unknown): value is SizeId {
  return SIZES.some((s) => s.id === value)
}

/** Stored choice, or the defaults when nothing valid is stored (unknown ids, bad JSON). */
export function getPrefs(storage: Pick<Storage, 'getItem'> = localStorage): ReadingPrefs {
  try {
    const raw: unknown = JSON.parse(storage.getItem(KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) return DEFAULT_PREFS
    const { font, size } = raw as Record<string, unknown>
    return {
      font: isFont(font) ? font : DEFAULT_PREFS.font,
      size: isSize(size) ? size : DEFAULT_PREFS.size,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/** `data-font` on <html> swaps `--font-sans`; `--reader-size` scales `.reader` text (index.css). */
export function applyPrefs(prefs: ReadingPrefs) {
  const root = document.documentElement
  if (prefs.font === 'default') delete root.dataset.font
  else root.dataset.font = prefs.font
  const px = SIZES.find((s) => s.id === prefs.size)?.px ?? 18
  if (prefs.size === 'md') root.style.removeProperty('--reader-size')
  else root.style.setProperty('--reader-size', `${px}px`)
}

export function setPrefs(prefs: ReadingPrefs, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(KEY, JSON.stringify(prefs))
  applyPrefs(prefs)
}

export function isDefault(prefs: ReadingPrefs) {
  return prefs.font === DEFAULT_PREFS.font && prefs.size === DEFAULT_PREFS.size
}
