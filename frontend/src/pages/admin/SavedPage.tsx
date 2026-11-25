import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { publicApi } from '../../api/endpoints'
import { Pagination } from '../../components/Pagination'
import { PostCard } from '../../components/PostCard'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

/** Posts the signed-in reader bookmarked (D42), newest bookmark first. */
export function SavedPage() {
  useDocumentTitle('Đã lưu')
  const [page, setPage] = useState(1)
  const posts = useQuery({
    queryKey: ['bookmarks', page],
    queryFn: () => publicApi.bookmarks(page),
    placeholderData: keepPreviousData,
  })

  return (
    <section>
      <h1 className="mb-4 text-3xl font-extrabold">Bài viết đã lưu</h1>
      {posts.isPending ? (
        <Spinner />
      ) : posts.error ? (
        <ErrorMessage error={posts.error} onRetry={() => void posts.refetch()} />
      ) : posts.data.items.length === 0 ? (
        <Empty>
          Chưa có bài nào. Bấm “🔖 Lưu” dưới một bài viết để đọc lại sau.{' '}
          <Link to="/" className="font-semibold text-primary hover:underline">
            Về trang chủ
          </Link>
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-6">
            {posts.data.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
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
