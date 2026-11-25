import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../api/endpoints'
import type { CommentStatus } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Pagination } from '../../components/Pagination'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { formatDate } from '../../lib/format'
import { describeUserAgent } from '../../lib/userAgent'

const statusLabels: Record<CommentStatus, string> = {
  APPROVED: 'Đang hiện',
  REJECTED: 'Đã ẩn',
}

export function CommentsPage() {
  useDocumentTitle('Bình luận')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  // Authors moderate comments on their own posts; admins see every post's comments.
  const postAuthorId = user?.isAdmin ? undefined : user?.id
  const [status, setStatus] = useState<CommentStatus | ''>('')
  const [page, setPage] = useState(1)
  const comments = useQuery({
    queryKey: ['admin-comments', status, page, postAuthorId],
    queryFn: () => adminApi.comments({ page, status: status || undefined, postAuthorId }),
    enabled: Boolean(user),
    placeholderData: keepPreviousData,
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    return queryClient.invalidateQueries({ queryKey: ['admin-comments'] })
  }
  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: CommentStatus }) =>
      adminApi.moderateComment(id, next),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: adminApi.deleteComment, onSuccess: refresh })

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="flex-1 text-3xl font-extrabold">
          {user?.isAdmin ? 'Bình luận' : 'Bình luận trên bài của tôi'}
        </h1>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CommentStatus | '')
            setPage(1)
          }}
          aria-label="Lọc trạng thái"
          className="input w-auto py-2 text-sm"
        >
          <option value="">Tất cả</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {(moderate.error ?? remove.error) && <ErrorMessage error={moderate.error ?? remove.error} />}
      {comments.isPending ? (
        <Spinner />
      ) : comments.error ? (
        <ErrorMessage error={comments.error} />
      ) : comments.data.items.length === 0 ? (
        <Empty>Không có bình luận.</Empty>
      ) : (
        <>
          <ul className="space-y-3">
            {comments.data.items.map((comment) => (
              <li key={comment.id} className="card p-5">
                <p className="text-sm text-muted">
                  <strong className="text-ink">{comment.authorName}</strong> ·{' '}
                  {formatDate(comment.createdAt)} · {statusLabels[comment.status]} ·{' '}
                  {comment.masked && (
                    <span
                      className="font-semibold text-amber-700"
                      title="Hệ thống đã che từ ngữ không phù hợp"
                    >
                      Đã che ·{' '}
                    </span>
                  )}
                  <Link to={`/posts/${comment.post.slug}`} className="hover:underline">
                    {comment.post.title}
                  </Link>
                </p>
                <p className="mt-2 whitespace-pre-line">{comment.content}</p>
                <div className="mt-3 flex gap-3 text-sm">
                  {comment.status === 'REJECTED' ? (
                    <button
                      className="text-green-700 hover:underline"
                      onClick={() => moderate.mutate({ id: comment.id, next: 'APPROVED' })}
                    >
                      Hiện lại
                    </button>
                  ) : (
                    <button
                      className="text-amber-700 hover:underline"
                      onClick={() => moderate.mutate({ id: comment.id, next: 'REJECTED' })}
                    >
                      Ẩn
                    </button>
                  )}
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => confirm('Xoá bình luận này?') && remove.mutate(comment.id)}
                  >
                    Xoá
                  </button>
                  <CommentClientInfo commentId={comment.id} isAdmin={Boolean(user?.isAdmin)} />
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={comments.data.page}
            total={comments.data.total}
            limit={comments.data.limit}
            onChange={setPage}
          />
        </>
      )}
    </section>
  )
}

/** "Xem IP": full address and device for admins and the post's author; admins can block it (D50). */
function CommentClientInfo({ commentId, isAdmin }: { commentId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const info = useQuery({
    queryKey: ['comment-client', commentId],
    queryFn: () => adminApi.commentClient(commentId),
    enabled: open,
  })
  const block = useMutation({
    mutationFn: (blocked: boolean) => adminApi.blockCommentClient(commentId, blocked),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['blocked-clients'] })
      return queryClient.invalidateQueries({ queryKey: ['comment-client'] })
    },
  })
  if (!open) {
    return (
      <button className="text-muted hover:underline" onClick={() => setOpen(true)}>
        Xem IP
      </button>
    )
  }
  if (info.isPending) return <span className="text-muted">…</span>
  if (info.error) return <span className="text-red-600">{info.error.message}</span>
  if (!info.data) return <span className="text-muted">Không có thông tin.</span>
  const device = describeUserAgent(info.data.userAgent)
  return (
    <span className="flex flex-wrap items-center gap-2 text-muted">
      <code className="font-bold text-ink">{info.data.client}</code>
      {device && <span title={info.data.userAgent ?? ''}>· {device}</span>}
      {isAdmin && info.data.client !== 'unknown' && (
        <button
          className={`font-semibold hover:underline ${info.data.blocked ? 'text-green-700' : 'text-red-600'}`}
          disabled={block.isPending}
          onClick={() => block.mutate(!info.data!.blocked)}
        >
          {info.data.blocked ? 'Bỏ chặn IP' : 'Chặn IP'}
        </button>
      )}
      {block.error && <span className="text-red-600">{block.error.message}</span>}
    </span>
  )
}
