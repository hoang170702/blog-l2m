export function Spinner() {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      Đang tải…
    </div>
  )
}

/**
 * Error box. With `onRetry` (a failed page load) the reader gets a plain sentence and a retry
 * button, and the technical message goes to the console; without it (a failed action) the
 * message itself is shown, because RPCs raise readable Vietnamese errors ("bị chặn", ...).
 */
export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Đã có lỗi xảy ra'
  if (onRetry) console.error(error)
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-5 py-4 text-sm text-danger"
    >
      <span className="flex-1">
        {onRetry ? 'Không tải được nội dung. Kiểm tra kết nối rồi thử lại.' : message}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost py-1.5 text-danger">
          Thử lại
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="card py-16 text-center text-muted">{children}</p>
}
