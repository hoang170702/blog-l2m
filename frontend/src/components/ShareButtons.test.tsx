import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareButtons } from './ShareButtons'

describe('ShareButtons', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('copies the page link and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<ShareButtons title="Bài" />)
    // user-event would install its own clipboard stub, so click without it here.
    fireEvent.click(screen.getByRole('button', { name: /Sao chép liên kết/ }))
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(await screen.findByRole('button', { name: /Đã sao chép/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chia sẻ…' })).toBeNull()
  })

  it('links to the Facebook sharer with the encoded page URL', () => {
    render(<ShareButtons title="Bài" />)
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
      'href',
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
    )
  })

  it('offers the share sheet when the browser has one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } })
    render(<ShareButtons title="Bài" />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Chia sẻ…' }))
    expect(share).toHaveBeenCalledWith({ title: 'Bài', url: window.location.href })
  })
})
