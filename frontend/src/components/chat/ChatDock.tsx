import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { chatApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { countUnreadRoom, getRoomReadMark, subscribeMessages } from '../../lib/chat'
import { supabase } from '../../lib/supabase'
import { ChatPanel } from './ChatPanel'
import { useInbox } from './useInbox'

/**
 * Floating chat button for signed-in members (D6). The badge adds unread private messages
 * (`dm_inbox`) to room messages newer than the local read mark. Hidden on /chat itself.
 */
export function ChatDock() {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const inbox = useInbox(Boolean(user))
  const room = useQuery({
    queryKey: ['chat', 'room'],
    queryFn: () => chatApi.messages(null),
    enabled: Boolean(user),
  })

  // Refresh the inbox and the room list on any live insert so the badge moves without polling.
  useEffect(() => {
    if (!user) return
    return subscribeMessages(supabase, {
      onInsert: () => {
        void inbox.refetch()
        void room.refetch()
      },
      onDelete: () => void room.refetch(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!user || location.pathname.startsWith('/chat')) return null

  const unread =
    (inbox.data?.reduce((sum, t) => sum + t.unread, 0) ?? 0) +
    (room.data ? countUnreadRoom(room.data, user.id, getRoomReadMark()) : 0)

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Trò chuyện"
          className="card fixed inset-0 z-40 flex flex-col overflow-hidden rounded-none sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[560px] sm:w-[380px] sm:rounded-3xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="font-bold">💬 Trò chuyện</span>
            <span className="flex items-center gap-2 text-xs">
              <Link
                to="/chat"
                onClick={() => setOpen(false)}
                className="font-semibold text-muted hover:text-primary"
              >
                Mở to
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng khung chat"
                className="btn-ghost h-8 w-8 p-0"
              >
                ✕
              </button>
            </span>
          </div>
          <ChatPanel className="flex-1" />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          open ? 'Đóng khung chat' : `Mở khung chat${unread ? `, ${unread} tin chưa đọc` : ''}`
        }
        className="btn-primary fixed right-4 bottom-4 z-30 h-14 w-14 rounded-full p-0 text-2xl shadow-glow sm:right-6 sm:bottom-6"
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span
            data-testid="chat-unread"
            className="absolute -top-1 -right-1 grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1.5 text-xs font-bold text-canvas ring-2 ring-canvas"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </>
  )
}
