import { useEffect, useState } from 'react'

/** Share the current page without a backend (D46): copy the link, Facebook, or the device's share sheet. */
export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window === 'undefined' ? '' : window.location.href
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Sao chép liên kết:', url)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Chia sẻ bài viết">
      <span className="font-semibold text-muted">Chia sẻ:</span>
      <button type="button" onClick={() => void copy()} className="btn-ghost py-1.5 text-xs">
        {copied ? '✓ Đã sao chép' : '🔗 Sao chép liên kết'}
      </button>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost py-1.5 text-xs"
      >
        Facebook
      </a>
      {canShare && (
        <button
          type="button"
          onClick={() => void navigator.share({ title, url }).catch(() => undefined)}
          className="btn-ghost py-1.5 text-xs"
        >
          Chia sẻ…
        </button>
      )}
    </div>
  )
}
