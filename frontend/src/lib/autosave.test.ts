import { autosaveKey, clearAutosaves } from './autosave'

describe('clearAutosaves', () => {
  it('removes every autosaved draft and nothing else', () => {
    localStorage.setItem(autosaveKey('u1', undefined), '{}')
    localStorage.setItem(autosaveKey('u2', 'p1'), '{}')
    localStorage.setItem('viewed:other', '1')
    clearAutosaves()
    expect(Object.keys(localStorage)).toEqual(['viewed:other'])
  })
})
