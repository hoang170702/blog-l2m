import { applyTheme, getTheme, setTheme } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('prefers the saved choice', () => {
    localStorage.setItem('theme', 'dark')
    expect(getTheme()).toBe('dark')
  })

  it('falls back to the system preference', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('dark') }))
    expect(getTheme()).toBe('dark')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(getTheme()).toBe('light')
    vi.unstubAllGlobals()
  })

  it('ignores unknown saved values', () => {
    localStorage.setItem('theme', 'sepia')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(getTheme()).toBe('light')
    vi.unstubAllGlobals()
  })

  it('stores the choice and marks the document', () => {
    setTheme('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
