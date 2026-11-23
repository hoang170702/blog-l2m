export function Spinner() {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      Đang tải…
    </div>
  )
}

export function ErrorMessage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Đã có lỗi xảy ra'
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
    >
      {message}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="card py-16 text-center text-muted">{children}</p>
}
