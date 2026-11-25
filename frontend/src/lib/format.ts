const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })

export function formatDate(value: string | null | undefined) {
  return value ? dateFormat.format(new Date(value)) : ''
}

const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

/** "14:05" for today, "25/11/2026 14:05" otherwise (chat timestamps). */
export function formatTime(value: string, now: Date = new Date()) {
  const date = new Date(value)
  return date.toDateString() === now.toDateString()
    ? timeFormat.format(date)
    : dateTimeFormat.format(date)
}
