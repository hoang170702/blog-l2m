const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })

export function formatDate(value: string | null | undefined) {
  return value ? dateFormat.format(new Date(value)) : ''
}
