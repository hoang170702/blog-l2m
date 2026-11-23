import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import 'highlight.js/styles/github.css'

/**
 * Renders untrusted Markdown: raw HTML is never rendered and the tree is sanitized before highlighting.
 * Images are dropped: a post's only image is its cover (D37).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-lg max-w-none prose-headings:font-display prose-headings:text-ink prose-a:text-primary prose-a:decoration-primary/40 prose-a:underline-offset-4 hover:prose-a:text-primary-hover prose-strong:text-ink prose-blockquote:border-primary prose-blockquote:bg-primary-soft/50 prose-blockquote:py-1 prose-img:rounded-2xl prose-pre:rounded-2xl prose-pre:bg-[#2a1f1a] prose-code:text-primary-dark">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
        disallowedElements={['img']}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
