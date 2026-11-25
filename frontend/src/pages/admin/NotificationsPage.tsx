import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { publicApi } from '../../api/endpoints'
import { notificationText } from '../../lib/notifications'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { formatDate } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

/** The 50 newest notifications (D44); opening the page marks them all read. */
export function NotificationsPage() {
  useDocumentTitle('Thông báo')
  const queryClient = useQueryClient()
  const list = useQuery({ queryKey: ['notifications'], queryFn: publicApi.notifications })

  useEffect(() => {
    if (!list.data?.some((item) => !item.readAt)) return
    void publicApi.markNotificationsRead().then(() => {
      void queryClient.invalidateQueries({ queryKey: ['unread-notifications'] })
    })
  }, [list.data, queryClient])

  return (
    <section className="max-w-2xl">
      <h1 className="mb-4 text-3xl font-extrabold">Thông báo</h1>
      {list.isPending ? (
        <Spinner />
      ) : list.error ? (
        <ErrorMessage error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <Empty>Chưa có thông báo nào.</Empty>
      ) : (
        <ul className="space-y-2">
          {list.data.map((item) => (
            <li
              key={item.id}
              className={`card flex items-center gap-3 px-4 py-3 text-sm ${item.readAt ? '' : 'border-primary/40 bg-primary-soft/40'}`}
            >
              <span aria-hidden="true">
                {item.kind === 'comment' ? '💬' : item.kind === 'like' ? '♥' : '✍'}
              </span>
              <span className="min-w-0 flex-1">
                {item.post ? (
                  <Link to={`/posts/${item.post.slug}`} className="hover:text-primary">
                    {notificationText(item)}
                  </Link>
                ) : (
                  notificationText(item)
                )}
                <span className="block text-xs text-muted">{formatDate(item.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
