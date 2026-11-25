import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { chatApi } from '../../api/endpoints'
import type { Author, DmThread } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { formatTime } from '../../lib/format'
import { ErrorMessage, Spinner } from '../Status'
import { Avatar } from '../UserMenu'
import { useInbox } from './useInbox'

/** Private threads with unread counts, plus a member search to start a new one. */
export function Inbox({ onOpen }: { onOpen: (thread: DmThread) => void }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const inbox = useInbox()
  const [query, setQuery] = useState('')
  const members = useQuery({
    queryKey: ['chat-members', query],
    queryFn: () => chatApi.members(query, user?.id ?? ''),
    enabled: query.trim().length > 0,
  })
  const open = useMutation({
    mutationFn: async (member: Author): Promise<DmThread> => {
      const id = await chatApi.openDm(member.id)
      return { id, peer: member, lastMessageAt: null, unread: 0, blocked: false }
    },
    onSuccess: (thread) => {
      setQuery('')
      void queryClient.invalidateQueries({ queryKey: ['dm-inbox'] })
      onOpen(thread)
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nhắn cho… (tìm theo tên)"
          aria-label="Tìm thành viên"
          className="input py-2 text-sm"
        />
        {open.isError && <ErrorMessage error={open.error} />}
        {query.trim() && (
          <ul className="mt-2 max-h-48 overflow-y-auto">
            {members.isPending ? (
              <Spinner />
            ) : members.data?.length === 0 ? (
              <li className="px-2 py-1 text-sm text-muted">Không có thành viên nào tên như vậy.</li>
            ) : (
              members.data?.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => open.mutate(member)}
                    disabled={open.isPending}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-primary-soft"
                  >
                    <Avatar user={member} size="h-7 w-7" />
                    <span className="truncate">{member.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {inbox.isPending ? (
          <Spinner />
        ) : inbox.error ? (
          <div className="p-3">
            <ErrorMessage error={inbox.error} onRetry={() => void inbox.refetch()} />
          </div>
        ) : inbox.data.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Chưa có cuộc trò chuyện riêng. Tìm một thành viên ở trên để bắt đầu.
          </p>
        ) : (
          <ul>
            {inbox.data.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => onOpen(thread)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-primary-soft"
                >
                  <Avatar user={thread.peer} size="h-9 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {thread.peer.name}
                      {thread.blocked && (
                        <span className="ml-2 text-xs font-normal text-muted">(đã chặn)</span>
                      )}
                    </span>
                    {thread.lastMessageAt && (
                      <span className="block text-xs text-muted">
                        {formatTime(thread.lastMessageAt)}
                      </span>
                    )}
                  </span>
                  {thread.unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">
                      {thread.unread > 99 ? '99+' : thread.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
