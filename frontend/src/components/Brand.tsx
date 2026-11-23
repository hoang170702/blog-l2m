export const SITE_NAME = 'L2M Blog'

/** Monogram + wordmark. `compact` drops the monogram (footer, admin header). */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {!compact && (
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary font-display text-[0.7rem] font-black tracking-tight text-white shadow-glow"
        >
          L2M
        </span>
      )}
      <span className="font-display text-xl font-extrabold">
        <span className="text-gradient">L2M</span> <span className="text-ink">Blog</span>
      </span>
    </span>
  )
}
