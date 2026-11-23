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
      {heading ? (
        <h1 className="mb-8 text-3xl font-extrabold md:text-4xl">{heading}</h1>
      ) : (
        page === 1 && <Hero />
      )}
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data.items.length === 0 ? (
        <Empty>Chưa có bài viết nào.</Empty>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                featured={mode === 'all' && page === 1 && index === 0}
              />
            ))}
          </div>
          <Pagination page={data.page} total={data.total} limit={data.limit} onChange={goTo} />
        </>
      )}
    </section>
  )
}

function Hero() {
  return (
    <div className="relative mb-12 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-14 text-center sm:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -bottom-28 h-72 w-72 rounded-full bg-secondary/20 blur-3xl"
      />
      <p className="relative mb-4 inline-flex rounded-full bg-primary-soft px-4 py-1 text-xs font-bold tracking-wide text-primary-dark uppercase">
        Nhật ký &amp; chia sẻ
      </p>
      <h1 className="relative mx-auto max-w-3xl text-4xl leading-tight font-extrabold md:text-5xl">
        Viết lại những điều <span className="text-gradient">đáng nhớ</span>
      </h1>
      <p className="relative mx-auto mt-4 max-w-xl text-lg text-muted">
        Những câu chuyện, ghi chép và trải nghiệm — được kể theo cách gần gũi nhất.
      </p>
    </div>
  )
}
