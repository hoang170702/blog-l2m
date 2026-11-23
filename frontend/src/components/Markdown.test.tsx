import { render } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders formatting but never raw HTML or script links', () => {
    const { container } = render(
      <Markdown>
        {
          '**bold**\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[click](javascript:alert(1))'
        }
      </Markdown>,
    )
    expect(container.querySelector('strong')).toHaveTextContent('bold')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/javascript:/)
  })
})
