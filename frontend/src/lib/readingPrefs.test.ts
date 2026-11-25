import { DEFAULT_PREFS, applyPrefs, getPrefs, isDefault, setPrefs } from './readingPrefs'

function memory(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  }
}

describe('readingPrefs', () => {
  afterEach(() => applyPrefs(DEFAULT_PREFS))

  it('defaults to the current look when nothing is stored', () => {
    expect(getPrefs(memory())).toEqual({ font: 'default', size: 'md' })
    expect(isDefault(getPrefs(memory()))).toBe(true)
  })

  it('ignores bad JSON and unknown ids', () => {
    expect(getPrefs(memory({ 'reading-prefs': '{oops' }))).toEqual(DEFAULT_PREFS)
    expect(getPrefs(memory({ 'reading-prefs': '"lora"' }))).toEqual(DEFAULT_PREFS)
    expect(
      getPrefs(memory({ 'reading-prefs': JSON.stringify({ font: 'comic-sans', size: 'lg' }) })),
    ).toEqual({ font: 'default', size: 'lg' })
  })

  it('persists and applies the choice to <html>', () => {
    const storage = memory()
    setPrefs({ font: 'lora', size: 'xl' }, storage)
    expect(getPrefs(storage)).toEqual({ font: 'lora', size: 'xl' })
    expect(document.documentElement.dataset.font).toBe('lora')
    expect(document.documentElement.style.getPropertyValue('--reader-size')).toBe('22px')
  })

  it('removes the attribute and variable again for the defaults', () => {
    applyPrefs({ font: 'system', size: 'sm' })
    applyPrefs(DEFAULT_PREFS)
    expect(document.documentElement.dataset.font).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--reader-size')).toBe('')
  })
})
