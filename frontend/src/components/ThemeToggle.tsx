import { useState } from 'react'
import { getTheme, setTheme, type Theme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setCurrent] = useState<Theme>(() => getTheme())
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next)
        setCurrent(next)
      }}
      aria-label={next === 'dark' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
      title={next === 'dark' ? 'Giao diện tối' : 'Giao diện sáng'}
      className="btn-ghost h-10 w-10 p-0 text-base"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
