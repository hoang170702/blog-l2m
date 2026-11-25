/**
 * Markdown → plain-text paragraphs for the read-aloud control (PLAN-20261125-audio, P01).
 * Code blocks become "Đoạn mã."; images, HTML and Markdown marks are dropped; link text is kept.
 */
export function markdownToParagraphs(markdown: string): string[] {
  const blocks = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/(```|~~~)[\s\S]*?\1/g, '\n\nĐoạn mã.\n\n')
    .split(/\n\s*\n/)
  return blocks
    .map((block) =>
      block
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s{0,3}>\s?/gm, '')
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, '')
        .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '')
        .replace(/^\|.*\|\s*$/gm, (row) =>
          row
            .split('|')
            .map((cell) => cell.trim())
            .filter((cell) => cell && !/^:?-{2,}:?$/.test(cell))
            .join(', '),
        )
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
}
