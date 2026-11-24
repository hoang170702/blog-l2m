import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../api/endpoints'
import type { Report, ReportStatus } from '../../api/types'
import { Pagination } from '../../components/Pagination'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { formatDate } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const statusLabels: Record<ReportStatus, string> = {
  OPEN: 'Chờ xử lý',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Đã bỏ qua',
}

/** Admin review queue for reported posts and comments. */
export function ReportsPage() {
  useDocumentTitle('Báo cáo vi phạm')
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ReportStatus | ''>('OPEN')
  const [page, setPage] = useState(1)
  const reports = useQuery({
    queryKey: ['admin-reports', status, page],
    queryFn: () => adminApi.reports({ page, status: status || undefined }),
    placeholderData: keepPreviousData,
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-comments'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-posts'] })
    return queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
  }
  const setReportStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ReportStatus }) =>
      adminApi.setReportStatus(id, next),
    onSuccess: refresh,
  })
  // Removing the content also removes its reports (foreign key cascade).
  const act = useMutation({
    mutationFn: async ({ report, action }: { report: Report; action: 'hide' | 'delete' }) => {
      if (report.comment) {
        if (action === 'hide') {
          await adminApi.moderateComment(report.comment.id, 'REJECTED')
          await adminApi.setReportStatus(report.id, 'RESOLVED')
        } else await adminApi.deleteComment(report.comment.id)
      } else if (report.post) await adminApi.deletePost(report.post.id)
    },
    onSuccess: refresh,
  })
  const error = setReportStatus.error ?? act.error

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="flex-1 text-3xl font-extrabold">Báo cáo vi phạm</h1>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ReportStatus | '')
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
      {error && <ErrorMessage error={error} />}
      {reports.isPending ? (
        <Spinner />
      ) : reports.error ? (
        <ErrorMessage error={reports.error} />
      ) : reports.data.items.length === 0 ? (
        <Empty>Không có báo cáo.</Empty>
      ) : (
        <>
          <ul className="space-y-3">
            {reports.data.items.map((report) => (
              <li key={report.id} className="card space-y-2 p-5">
                <p className="text-sm text-muted">
                  {formatDate(report.createdAt)} · {statusLabels[report.status]} ·{' '}
                  {report.comment ? 'Bình luận' : 'Bài viết'}
                </p>
                <p className="font-semibold">Lý do: {report.reason}</p>
                {report.post && (
                  <Link
                    to={`/posts/${report.post.slug}`}
                    className="block font-bold hover:text-primary"
                  >
                    {report.post.title}
                  </Link>
                )}
                {report.comment && (
                  <blockquote className="rounded-xl bg-canvas px-4 py-3 text-sm">
                    <strong>{report.comment.authorName}</strong>
                    {report.comment.status === 'REJECTED' && (
                      <span className="text-muted"> (đã ẩn)</span>
                    )}
                    <p className="mt-1 whitespace-pre-line">{report.comment.content}</p>
                    {report.comment.post && (
                      <Link
                        to={`/posts/${report.comment.post.slug}`}
                        className="mt-2 block text-xs text-muted hover:underline"
                      >
                        trên bài “{report.comment.post.title}”
                      </Link>
                    )}
                  </blockquote>
                )}
                <div className="flex flex-wrap gap-3 pt-1 text-sm font-semibold">
                  {report.comment && report.comment.status !== 'REJECTED' && (
                    <button
                      className="text-amber-700 hover:underline"
                      onClick={() => act.mutate({ report, action: 'hide' })}
                    >
                      Ẩn bình luận
                    </button>
                  )}
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() =>
                      confirm(report.comment ? 'Xoá bình luận này?' : 'Xoá bài viết này?') &&
                      act.mutate({ report, action: 'delete' })
                    }
                  >
                    {report.comment ? 'Xoá bình luận' : 'Xoá bài viết'}
                  </button>
                  {report.status === 'OPEN' ? (
                    <>
                      <button
                        className="text-green-700 hover:underline"
                        onClick={() => setReportStatus.mutate({ id: report.id, next: 'RESOLVED' })}
                      >
                        Đã xử lý
                      </button>
                      <button
                        className="text-muted hover:underline"
                        onClick={() => setReportStatus.mutate({ id: report.id, next: 'DISMISSED' })}
                      >
                        Bỏ qua
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-muted hover:underline"
                      onClick={() => setReportStatus.mutate({ id: report.id, next: 'OPEN' })}
                    >
                      Mở lại
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={reports.data.page}
            total={reports.data.total}
            limit={reports.data.limit}
            onChange={setPage}
          />
        </>
      )}
    </section>
  )
}
