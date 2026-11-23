import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { publicApi } from '../api/endpoints'
import { Pagination } from '../components/Pagination'
import { PostCard } from '../components/PostCard'
import { Empty, ErrorMessage, Spinner } from '../components/Status'
import { useDocumentTitle } from '../lib/useDocumentTitle'

type Mode = 'all' | 'category' | 'tag' | 'search'

export function HomePage({ mode = 'all' }: { mode?: Mode }) {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? '1') || 1
  const q = mode === 'search' ? (searchParams.get('q') ?? '') : undefined
  const filters = {
    page,
    category: mode === 'category' ? slug : undefined,
    tag: mode === 'tag' ? slug : undefined,
    q,
  }

  const { data, error, isPending } = useQuery({
    queryKey: ['posts', filters],
    queryFn: () => publicApi.posts(filters),
    placeholderData: keepPreviousData,
  })

  const headings: Record<Mode, string | undefined> = {
    all: undefined,
    category: `Chuyên mục: ${data?.items[0]?.category?.name ?? slug}`,
    tag: `Thẻ: #${slug}`,
    search: `Kết quả cho “${q}”`,
  }
  const heading = headings[mode]
  useDocumentTitle(heading)

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
    window.scrollTo({ top: 0 })
  }

  return (
    <section>
      {heading && <h1 className="mb-2 text-2xl font-semibold">{heading}</h1>}
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data.items.length === 0 ? (
        <Empty>Chưa có bài viết nào.</Empty>
      ) : (
        <>
          {data.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <Pagination page={data.page} total={data.total} limit={data.limit} onChange={goTo} />
        </>
      )}
    </section>
  )
}
