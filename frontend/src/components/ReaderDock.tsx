import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ReadAloud } from './ReadAloud'
import { ReadingPrefs } from './ReadingPrefs'
import { supported } from '../lib/speech'

type Panel = 'listen' | 'prefs'

/**
 * Floating rail on the right edge of a post: icon buttons that open the read-aloud and
 * reading-preference panels to their left. Panels stay mounted while closed so the speech
 * keeps playing.
 */
export function ReaderDock({ title, markdown }: { title: string; markdown: string }) {
  const [open, setOpen] = useState<Panel | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function item(id: Panel, label: string, icon: ReactNode) {
    const active = open === id
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={active}
        onClick={() => setOpen(active ? null : id)}
        className={`grid h-10 w-10 place-items-center rounded-full text-base font-bold transition hover:bg-primary-soft hover:text-primary-dark ${
          active ? 'bg-primary-soft text-primary-dark' : 'text-ink'
        }`}
      >
        {icon}
      </button>
    )
  }

  return (
    <div ref={ref} className="fixed top-1/2 right-2 z-30 -translate-y-1/2 sm:right-4">
      <div className="card flex flex-col gap-1 rounded-full p-1.5">
        {supported() && item('listen', 'Nghe bài viết', '🎧')}
        {item('prefs', 'Cỡ chữ & font', 'Aa')}
      </div>
      <div className="absolute top-1/2 right-full mr-2 w-[min(20rem,calc(100vw-5rem))] -translate-y-1/2">
        <div hidden={open !== 'listen'}>
          <ReadAloud title={title} markdown={markdown} />
        </div>
        <div hidden={open !== 'prefs'}>
          <ReadingPrefs />
        </div>
      </div>
    </div>
  )
}
