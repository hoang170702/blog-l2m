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

  it('gives h2/h3 stable, unique ids for the table of contents', () => {
    const { container } = render(
      <Markdown>
        {'## Cài đặt **nhanh**\n\n### Bước 1\n\n## Cài đặt nhanh\n\n#### Bỏ qua'}
      </Markdown>,
    )
    expect(Array.from(container.querySelectorAll('[id]'), (node) => node.id)).toEqual([
      'h-cai-dat-nhanh',
      'h-buoc-1',
      'h-cai-dat-nhanh-2',
    ])
  })

  it('drops Markdown images because a post shows only its cover', () => {
    const { container } = render(
      <Markdown>{'Text\n\n![photo](https://example.com/a.webp)'}</Markdown>,
    )
    expect(container).toHaveTextContent('Text')
    expect(container.querySelector('img')).toBeNull()
  })
})
