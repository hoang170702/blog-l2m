import { foldVi } from './fold'

/** The parts of a hast node this module reads; kept local so no hast types are needed. */
interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

export function headingSlug(text: string) {
  return (
    foldVi(text)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'muc'
  )
}

function textOf(node: HastNode): string {
  return node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join('')
}

/**
 * Rehype plugin: gives every h2/h3 an id built from its text ("Cài đặt" → "h-cai-dat", repeats
 * get "-2", "-3") so the table of contents can link to it. It runs after rehype-sanitize (which
 * would rename the ids), so it adds its own "h-" prefix: an author-chosen bare id such as
 * "process" would otherwise shadow the global `window.process` (DOM clobbering).
 */
export function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const seen = new Map<string, number>()
    const visit = (node: HastNode) => {
      if (node.type === 'element' && (node.tagName === 'h2' || node.tagName === 'h3')) {
        const base = headingSlug(textOf(node))
        const count = (seen.get(base) ?? 0) + 1
        seen.set(base, count)
        const id = `h-${base}`
        node.properties = { ...node.properties, id: count > 1 ? `${id}-${count}` : id }
        return
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

/** Minutes to read at about 200 words a minute, never less than one. */
export function readingMinutes(markdown: string) {
  const text = markdown.trim()
  return Math.max(1, Math.round((text ? text.split(/\s+/).length : 0) / 200))
}
