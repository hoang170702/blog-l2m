import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { chatApi } from '../../api/endpoints'
import type { ChatMessage } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import {
  CHAT_PAGE,
  groupMessages,
  mergeMessage,
  setRoomReadMark,
  subscribeMessages,
} from '../../lib/chat'
import { formatTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Empty, ErrorMessage, Spinner } from '../Status'
import { Avatar } from '../UserMenu'

const MAX = 1000

/**
 * One conversation: the shared room (`threadId` null) or a private thread. Loads the newest page,
 * pages upwards on demand, appends live inserts, and lets the author (or an admin in the room)
 * delete a message.
 */
export function ChatRoom({
  threadId,
  className = '',
}: {
  threadId: string | null
  className?: string
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = ['chat', threadId ?? 'room']
  const list = useQuery({ queryKey: key, queryFn: () => chatApi.messages(threadId) })
  const [hasMore, setHasMore] = useState(true)
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // Live inserts and deletes for this conversation (RLS already limits what arrives).
  useEffect(() => {
    return subscribeMessages(supabase, {
      onInsert: (id, incomingThread) => {
        if (incomingThread !== threadId) return
        void chatApi.message(id).then((message) => {
          if (message)
            queryClient.setQueryData<ChatMessage[]>(key, (old = []) => mergeMessage(old, message))
        })
      },
      onDelete: (id) =>
        queryClient.setQueryData<ChatMessage[]>(key, (old = []) => old.filter((m) => m.id !== id)),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  // Keep the newest message in view unless the reader scrolled up; mark as read when viewing.
  useEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
    if (list.data) {
      if (threadId === null) setRoomReadMark()
      else
        void chatApi
          .markRead(threadId)
          .then(() => queryClient.invalidateQueries({ queryKey: ['dm-inbox'] }))
    }
  }, [list.data, threadId, queryClient])

  const send = useMutation({
    mutationFn: (content: string) => chatApi.send(threadId, content),
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(key, (old = []) => mergeMessage(old, message))
      setDraft('')
      stickToBottom.current = true
    },
  })
  const remove = useMutation({
    mutationFn: chatApi.remove,
    onSuccess: (_, id) =>
      queryClient.setQueryData<ChatMessage[]>(key, (old = []) => old.filter((m) => m.id !== id)),
  })

  async function loadOlder() {
    const oldest = list.data?.[0]
    if (!oldest) return
    const older = await chatApi.messages(threadId, oldest.createdAt)
    if (older.length < CHAT_PAGE) setHasMore(false)
    stickToBottom.current = false
    queryClient.setQueryData<ChatMessage[]>(key, (old = []) => [...older, ...old])
  }

  function submit(event?: FormEvent) {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || content.length > MAX || send.isPending) return
    send.mutate(content)
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }
  function onScroll() {
    const el = scroller.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  if (!user) return null

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
        data-testid="chat-scroll"
      >
        {list.isPending ? (
          <Spinner />
        ) : list.error ? (
          <ErrorMessage error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <Empty>Chưa có tin nhắn nào. Mở lời đi!</Empty>
        ) : (
          <>
            {hasMore && list.data.length >= CHAT_PAGE && (
              <button
                type="button"
                onClick={() => void loadOlder()}
                className="mx-auto mb-3 block text-xs font-semibold text-muted hover:text-primary"
              >
                Tải tin cũ hơn
              </button>
            )}
            <ol className="space-y-4">
              {groupMessages(list.data).map((group) => {
                const own = group.userId === user.id
                return (
                  <li
                    key={group.messages[0].id}
                    className={`flex gap-2 ${own ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar
                      user={{
                        name: group.author?.name ?? 'Thành viên',
                        avatarUrl: group.author?.avatarUrl ?? null,
                      }}
                      size="h-8 w-8"
                    />
                    <div className={`min-w-0 max-w-[80%] ${own ? 'items-end text-right' : ''}`}>
                      <div className="mb-1 text-xs text-muted">
                        <span className="font-semibold text-ink">
                          {own ? 'Bạn' : (group.author?.name ?? 'Thành viên')}
                        </span>{' '}
                        · {formatTime(group.startedAt)}
                      </div>
                      <ul className="space-y-1">
                        {group.messages.map((message) => (
                          <li key={message.id} className="group/msg relative">
                            <p
                              className={`reader-text inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-left ${own ? 'bg-primary text-on-primary' : 'bg-canvas'}`}
                            >
                              {message.content}
                            </p>
                            {message.masked && (
                              <p className="mt-0.5 text-[11px] text-warning">
                                ⚠ Đã che từ ngữ không phù hợp.
                              </p>
                            )}
                            {(own || (threadId === null && user.isAdmin)) && (
                              <button
                                type="button"
                                onClick={() => remove.mutate(message.id)}
                                aria-label="Xoá tin nhắn"
                                title="Xoá"
                                className="ml-1 text-xs text-muted opacity-0 transition group-hover/msg:opacity-100 hover:text-danger focus:opacity-100"
                              >
                                ✕
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>
      <form onSubmit={submit} className="border-t border-line p-3">
        {send.isError && <ErrorMessage error={send.error} />}
        <div className="mt-2 flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX}
            placeholder={
              user.suspended
                ? 'Tài khoản đang bị khoá'
                : 'Nhắn gì đó… (Enter gửi, Shift+Enter xuống dòng)'
            }
            aria-label="Tin nhắn"
            disabled={user.suspended}
            className="input max-h-32 min-h-10 flex-1 resize-y py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending || user.suspended}
            className="btn-primary py-2"
          >
            Gửi
          </button>
        </div>
        {draft.length > MAX - 100 && (
          <p className="mt-1 text-right text-xs text-muted">
            {draft.length}/{MAX}
          </p>
        )}
      </form>
    </div>
  )
}
