import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ReadAloud } from './ReadAloud'
import { ReadingPrefs } from './ReadingPrefs'
import { supported } from '../lib/speech'

type Panel = 'listen' | 'prefs'

/**
 * Floating controls for a post: a pill at the bottom left on phones and tablets (the right edge
 * would cover the text there), a vertical rail on the right edge from lg. Its icon buttons open
 * the read-aloud and reading-preference panels. Panels stay mounted while closed so the speech
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
    <div
      ref={ref}
      className="fixed bottom-4 left-4 z-30 sm:bottom-6 sm:left-6 lg:top-1/2 lg:right-4 lg:bottom-auto lg:left-auto lg:-translate-y-1/2"
    >
      <div className="card flex gap-1 rounded-full p-1.5 lg:flex-col">
        {supported() && item('listen', 'Nghe bài viết', '🎧')}
        {item('prefs', 'Cỡ chữ & font', 'Aa')}
      </div>
      <div className="absolute bottom-full left-0 mb-2 w-[min(20rem,calc(100vw-2rem))] lg:top-1/2 lg:right-full lg:bottom-auto lg:left-auto lg:mr-2 lg:mb-0 lg:w-80 lg:-translate-y-1/2">
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
