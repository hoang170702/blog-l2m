import type { RefObject } from 'react'
import { actions, applyAction } from '../lib/markdownEdit'

export function MarkdownToolbar({
  textareaRef,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onChange: (text: string) => void
}) {
  return (
    <div
      role="toolbar"
      aria-label="Định dạng"
      className="flex flex-wrap items-center gap-1 border-b border-line bg-canvas/60 px-2 py-1.5"
    >
      {actions.map(({ label, title, action, className }) => (
        <button
          key={title}
          type="button"
          title={title}
          aria-label={title}
          onMouseDown={(e) => e.preventDefault()} // keep the textarea selection
          onClick={() => textareaRef.current && applyAction(textareaRef.current, action, onChange)}
          className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm text-ink transition hover:bg-primary-soft hover:text-primary-dark ${className ?? ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
