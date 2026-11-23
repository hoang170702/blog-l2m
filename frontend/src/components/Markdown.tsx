import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import 'highlight.js/styles/github.css'

/** Renders untrusted Markdown: raw HTML is never rendered and the tree is sanitized before highlighting. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-slate max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
