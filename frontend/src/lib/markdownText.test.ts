import { markdownToParagraphs } from './markdownText'

describe('markdownToParagraphs', () => {
  it('turns a post into spoken paragraphs', () => {
    const md = [
      '## Mở đầu',
      '',
      'Xin **chào** các _bạn_, xem [tài liệu](https://x.y) nhé.',
      '',
      '![ảnh](https://x.y/a.webp)',
      '',
      '```ts',
      'const a = 1',
      '```',
      '',
      '- Một',
      '- Hai',
      '',
      '> Trích dẫn',
      '',
      '| Cột | Giá |',
      '| --- | --- |',
      '| A | 1 |',
      '',
      '<span>html</span> và `code` ~~gạch~~',
    ].join('\n')
    expect(markdownToParagraphs(md)).toEqual([
      'Mở đầu',
      'Xin chào các bạn, xem tài liệu nhé.',
      'Đoạn mã.',
      'Một Hai',
      'Trích dẫn',
      'Cột, Giá A, 1',
      'html và code gạch',
    ])
  })

  it('returns nothing for an empty body', () => {
    expect(markdownToParagraphs('\n\n')).toEqual([])
  })

  it('stays fast on unclosed tags and links (security audit, quadratic regex)', () => {
    const inputs = [
      '<a'.repeat(20000),
      '[a'.repeat(20000),
      '[a](b'.repeat(10000),
      '![a'.repeat(20000),
    ]
    const started = performance.now()
    for (const input of inputs) markdownToParagraphs(input)
    // Before the fix a single 40 kB input took about one second.
    expect(performance.now() - started).toBeLessThan(250)
  })
})
