export function Spinner() {
  return (
    <div role="status" className="py-12 text-center text-slate-500">
      Đang tải…
    </div>
  )
}

export function ErrorMessage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Đã có lỗi xảy ra'
  return (
    <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
      {message}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-slate-500">{children}</p>
}
