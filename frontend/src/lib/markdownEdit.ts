/** Markdown editing actions for the editor toolbar and keyboard shortcuts. */

/** Applies an edit to the textarea selection and returns the new text plus the new selection. */
export interface TextEdit {
  text: string
  selectionStart: number
  selectionEnd: number
}

type Action = (value: string, start: number, end: number) => TextEdit

function wrap(before: string, after: string, placeholder: string): Action {
  return (value, start, end) => {
    const selected = value.slice(start, end) || placeholder
    const text = value.slice(0, start) + before + selected + after + value.slice(end)
    return {
      text,
      selectionStart: start + before.length,
      selectionEnd: start + before.length + selected.length,
    }
  }
}

/** Prefixes every selected line (or the current line) with `prefix`. */
function linePrefix(prefix: string): Action {
  return (value, start, end) => {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const block = value.slice(lineStart, end)
    const prefixed = block
      .split('\n')
      .map((line) => prefix + line)
      .join('\n')
    return {
      text: value.slice(0, lineStart) + prefixed + value.slice(end),
      selectionStart: start + prefix.length,
      selectionEnd: end + (prefixed.length - block.length),
    }
  }
}

const codeAction: Action = (value, start, end) => {
  const selected = value.slice(start, end)
  return selected.includes('\n')
    ? wrap('\n```\n', '\n```\n', '')(value, start, end)
    : wrap('`', '`', 'code')(value, start, end)
}

export const actions: { label: string; title: string; action: Action; className?: string }[] = [
  {
    label: 'B',
    title: 'In đậm (Ctrl+B)',
    action: wrap('**', '**', 'chữ đậm'),
    className: 'font-black',
  },
  {
    label: 'I',
    title: 'In nghiêng (Ctrl+I)',
    action: wrap('_', '_', 'chữ nghiêng'),
    className: 'italic font-serif',
  },
  { label: 'H2', title: 'Tiêu đề lớn', action: linePrefix('## ') },
  { label: 'H3', title: 'Tiêu đề nhỏ', action: linePrefix('### ') },
  { label: '❝', title: 'Trích dẫn', action: linePrefix('> ') },
  { label: '•', title: 'Danh sách', action: linePrefix('- ') },
  { label: '🔗', title: 'Chèn link (Ctrl+K)', action: wrap('[', '](https://)', 'chữ hiển thị') },
  { label: '</>', title: 'Code', action: codeAction, className: 'font-mono' },
]

export const shortcuts: Record<string, Action> = {
  b: actions[0].action,
  i: actions[1].action,
  k: actions[6].action,
}

/** Runs an action on the textarea and hands the result to `onChange`, keeping the selection. */
export function applyAction(
  textarea: HTMLTextAreaElement,
  action: Action,
  onChange: (text: string) => void,
) {
  const result = action(textarea.value, textarea.selectionStart, textarea.selectionEnd)
  onChange(result.text)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
  })
}
