import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReadingPrefs } from './ReadingPrefs'

describe('ReadingPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.font
    document.documentElement.style.removeProperty('--reader-size')
  })

  it('starts at the default size and font with no reset link', () => {
    render(<ReadingPrefs />)
    expect(screen.getByText('Vừa')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('default')
    expect(screen.queryByRole('button', { name: 'Về mặc định' })).toBeNull()
  })

  it('A+ enlarges, persists, and stops at the largest step', async () => {
    const user = userEvent.setup()
    render(<ReadingPrefs />)
    const bigger = screen.getByRole('button', { name: 'Chữ lớn hơn' })
    await user.click(bigger)
    expect(screen.getByText('Lớn')).toBeInTheDocument()
    expect(document.documentElement.style.getPropertyValue('--reader-size')).toBe('20px')
    expect(JSON.parse(localStorage.getItem('reading-prefs') ?? '{}')).toEqual({
      font: 'default',
      size: 'lg',
    })
    await user.click(bigger)
    expect(screen.getByText('Rất lớn')).toBeInTheDocument()
    expect(bigger).toBeDisabled()
  })

  it('changes the font and returns to the defaults', async () => {
    const user = userEvent.setup()
    render(<ReadingPrefs />)
    await user.selectOptions(screen.getByRole('combobox'), 'lora')
    expect(document.documentElement.dataset.font).toBe('lora')
    await user.click(screen.getByRole('button', { name: 'Về mặc định' }))
    expect(document.documentElement.dataset.font).toBeUndefined()
    expect(screen.getByRole('combobox')).toHaveValue('default')
    expect(localStorage.getItem('reading-prefs')).toBe('{"font":"default","size":"md"}')
  })
})
