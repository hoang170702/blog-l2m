export function Pagination({
  page,
  total,
  limit,
  onChange,
}: {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null
  return (
    <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Phân trang">
      <button
        className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Trước
      </button>
      <span className="text-sm font-semibold text-muted">
        Trang {page}/{pages}
      </span>
      <button
        className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Sau →
      </button>
    </nav>
  )
}
