import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../api/endpoints'
import type { PostStatus } from '../../api/types'
import { Pagination } from '../../components/Pagination'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { formatDate } from '../../lib/format'

export function PostsPage() {
  useDocumentTitle('Bài viết')
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<PostStatus | ''>('')
  const posts = useQuery({
    queryKey: ['admin-posts', page, status],
    queryFn: () => adminApi.posts({ page, status: status || undefined }),
    placeholderData: keepPreviousData,
  })
  const remove = useMutation({
    mutationFn: adminApi.deletePost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-posts'] }),
  })

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-extrabold">Bài viết</h1>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PostStatus | '')
            setPage(1)
          }}
          aria-label="Lọc trạng thái"
          className="input w-auto py-2 text-sm"
        >
          <option value="">Tất cả</option>
          <option value="DRAFT">Bản nháp</option>
          <option value="PUBLISHED">Đã xuất bản</option>
        </select>
        <Link to="/admin/posts/new" className="btn-primary">
          Viết bài mới
        </Link>
      </div>
      {remove.isError && <ErrorMessage error={remove.error} />}
      {posts.isPending ? (
        <Spinner />
      ) : posts.error ? (
        <ErrorMessage error={posts.error} />
      ) : posts.data.items.length === 0 ? (
        <Empty>Chưa có bài viết.</Empty>
      ) : (
        <>
          <div className="card overflow-x-auto px-6 py-2">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="py-2">Tiêu đề</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {posts.data.items.map((post) => (
                  <tr key={post.id} className="border-b border-line last:border-0">
                    <td className="py-2">
                      <Link
                        to={`/admin/posts/${post.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {post.title}
                      </Link>
                    </td>
                    <td>{post.status === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp'}</td>
                    <td>{formatDate(post.updatedAt)}</td>
                    <td className="text-right">
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => {
                          if (confirm(`Xoá bài “${post.title}”?`)) remove.mutate(post.id)
                        }}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={posts.data.page}
            total={posts.data.total}
            limit={posts.data.limit}
            onChange={setPage}
          />
        </>
      )}
    </section>
  )
}
