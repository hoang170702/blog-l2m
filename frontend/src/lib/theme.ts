/** Light or dark theme (D45): the user's choice in localStorage, else the system preference. */

export type Theme = 'light' | 'dark'

const KEY = 'theme'

export function getTheme(storage: Pick<Storage, 'getItem'> = localStorage): Theme {
  const saved = storage.getItem(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Sets `data-theme` on <html>; index.css swaps the color variables on it. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function setTheme(theme: Theme, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(KEY, theme)
  applyTheme(theme)
}
