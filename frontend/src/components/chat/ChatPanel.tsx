import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { chatApi } from '../../api/endpoints'
import type { DmThread } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { trackPresence } from '../../lib/chat'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../UserMenu'
import { ChatRoom } from './ChatRoom'
import { Inbox } from './Inbox'
import { useInbox } from './useInbox'

type View = { kind: 'room' } | { kind: 'inbox' } | { kind: 'thread'; thread: DmThread }

/**
 * Tabs Chung / Riêng and the open conversation. Shared by the floating dock and /chat.
 * `initialThreadId` opens a thread from the URL once the inbox has loaded it.
 */
export function ChatPanel({
  initialThreadId = null,
  onThreadChange,
  className = '',
}: {
  initialThreadId?: string | null
  onThreadChange?: (threadId: string | null) => void
  className?: string
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const inbox = useInbox()
  const [view, setView] = useState<View>(initialThreadId ? { kind: 'inbox' } : { kind: 'room' })
  const [online, setOnline] = useState(0)

  useEffect(() => {
    if (!user) return
    return trackPresence(supabase, user.id, setOnline)
  }, [user])

  // The thread named by the URL opens as soon as the inbox knows it (the page remounts the
  // panel per URL, so going back simply navigates to /chat).
  const urlThread =
    initialThreadId && view.kind === 'inbox'
      ? inbox.data?.find((t) => t.id === initialThreadId)
      : undefined
  const current: View = urlThread ? { kind: 'thread', thread: urlThread } : view

  const blocks = useQuery({ queryKey: ['chat-blocks'], queryFn: chatApi.blocks })
  const toggleBlock = useMutation({
    mutationFn: ({ peerId, blocked }: { peerId: string; blocked: boolean }) =>
      blocked ? chatApi.unblock(peerId) : chatApi.block(peerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-blocks'] })
      void queryClient.invalidateQueries({ queryKey: ['dm-inbox'] })
    },
  })

  function go(next: View) {
    setView(next)
    onThreadChange?.(next.kind === 'thread' ? next.thread.id : null)
  }

  if (!user) return null
  const unreadDm = inbox.data?.reduce((sum, t) => sum + t.unread, 0) ?? 0
  const tab = (active: boolean) =>
    `flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition ${active ? 'bg-primary/10 text-primary-dark' : 'text-muted hover:text-ink'}`

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {current.kind === 'thread' ? (
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <button
            type="button"
            onClick={() => go({ kind: 'inbox' })}
            aria-label="Quay lại danh sách"
            className="btn-ghost h-8 w-8 p-0"
          >
            ←
          </button>
          <Avatar user={current.thread.peer} size="h-8 w-8" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {current.thread.peer.name}
          </span>
          {(() => {
            const blocked = blocks.data?.includes(current.thread.peer.id) ?? false
            return (
              <button
                type="button"
                onClick={() => {
                  if (
                    blocked ||
                    window.confirm(
                      `Chặn ${current.thread.peer.name}? Người này sẽ không nhắn được cho bạn.`,
                    )
                  )
                    toggleBlock.mutate({ peerId: current.thread.peer.id, blocked })
                }}
                disabled={toggleBlock.isPending}
                className="text-xs font-semibold text-muted hover:text-danger"
              >
                {blocked ? 'Bỏ chặn' : 'Chặn'}
              </button>
            )
          })()}
        </div>
      ) : (
        <div className="flex items-center gap-1 border-b border-line px-3 py-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={current.kind === 'room'}
            className={tab(current.kind === 'room')}
            onClick={() => go({ kind: 'room' })}
          >
            Chung
            {online > 0 && (
              <span className="ml-1 text-xs font-normal text-muted">· {online} online</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={current.kind === 'inbox'}
            className={tab(current.kind === 'inbox')}
            onClick={() => go({ kind: 'inbox' })}
          >
            Riêng
            {unreadDm > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">
                {unreadDm}
              </span>
            )}
          </button>
        </div>
      )}
      {current.kind === 'room' && <ChatRoom threadId={null} className="flex-1" />}
      {current.kind === 'inbox' && <Inbox onOpen={(thread) => go({ kind: 'thread', thread })} />}
      {current.kind === 'thread' && (
        <ChatRoom key={current.thread.id} threadId={current.thread.id} className="flex-1" />
      )}
    </div>
  )
}
