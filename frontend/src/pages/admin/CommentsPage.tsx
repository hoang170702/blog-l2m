import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../api/endpoints'
import type { CommentStatus } from '../../api/types'
import { Pagination } from '../../components/Pagination'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { formatDate } from '../../lib/format'

const statusLabels: Record<CommentStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
}

export function CommentsPage() {
  useDocumentTitle('Bình luận')
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<CommentStatus | ''>('PENDING')
  const [page, setPage] = useState(1)
  const comments = useQuery({
    queryKey: ['admin-comments', status, page],
    queryFn: () => adminApi.comments({ page, status: status || undefined }),
    placeholderData: keepPreviousData,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-comments'] })
  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: CommentStatus }) =>
      adminApi.moderateComment(id, next),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: adminApi.deleteComment, onSuccess: refresh })

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="flex-1 text-3xl font-extrabold">Bình luận</h1>
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
                  <Link to={`/posts/${comment.post.slug}`} className="hover:underline">
                    {comment.post.title}
                  </Link>
                </p>
                <p className="mt-2 whitespace-pre-line">{comment.content}</p>
                <div className="mt-3 flex gap-3 text-sm">
                  {comment.status !== 'APPROVED' && (
                    <button
                      className="text-green-700 hover:underline"
                      onClick={() => moderate.mutate({ id: comment.id, next: 'APPROVED' })}
                    >
                      Duyệt
                    </button>
                  )}
                  {comment.status !== 'REJECTED' && (
                    <button
                      className="text-amber-700 hover:underline"
                      onClick={() => moderate.mutate({ id: comment.id, next: 'REJECTED' })}
                    >
                      Từ chối
                    </button>
                  )}
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => confirm('Xoá bình luận này?') && remove.mutate(comment.id)}
                  >
                    Xoá
                  </button>
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
