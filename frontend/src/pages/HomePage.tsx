import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { publicApi } from '../api/endpoints'
import { Pagination } from '../components/Pagination'
import { PostCard } from '../components/PostCard'
import { Avatar } from '../components/UserMenu'
import { FollowButton } from '../components/FollowButton'
import { Empty, ErrorMessage, Spinner } from '../components/Status'
import { useDocumentTitle } from '../lib/useDocumentTitle'

type Mode = 'all' | 'category' | 'tag' | 'search' | 'author' | 'following' | 'series'

export function HomePage({ mode = 'all' }: { mode?: Mode }) {
  const { slug, id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? '1') || 1
  const q = mode === 'search' ? (searchParams.get('q') ?? '') : undefined
  const series = useQuery({
    queryKey: ['series', slug],
    queryFn: () => publicApi.series(slug!),
    enabled: mode === 'series' && Boolean(slug),
  })
  const filters = {
    page,
    category: mode === 'category' ? slug : undefined,
    tag: mode === 'tag' ? slug : undefined,
    author: mode === 'author' ? id : undefined,
    following: mode === 'following' || undefined,
    series: mode === 'series' ? series.data?.id : undefined,
    q,
  }
  const author = useQuery({
    queryKey: ['author', id],
    queryFn: () => publicApi.author(id!),
    enabled: mode === 'author' && Boolean(id),
  })

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['posts', filters],
    queryFn: () => publicApi.posts(filters),
    placeholderData: keepPreviousData,
    // The series page needs the series id first.
    enabled: mode !== 'series' || Boolean(series.data),
  })

  const headings: Record<Mode, string | undefined> = {
    all: undefined,
    category: `Chuyên mục: ${data?.items[0]?.category?.name ?? slug}`,
    tag: `Thẻ: #${slug}`,
    search: `Kết quả cho “${q}”`,
    author: author.data ? `Bài viết của ${author.data.name}` : author.isPending ? '…' : 'Tác giả',
    following: 'Đang theo dõi',
    series: series.data ? `Series: ${series.data.title}` : series.isPending ? '…' : 'Series',
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
      {mode === 'author' && author.data ? (
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <Avatar user={author.data} size="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted">
              Tác giả · {author.data.followers ?? 0} người theo dõi
            </p>
            <h1 className="text-3xl font-extrabold md:text-4xl">{author.data.name}</h1>
            {author.data.bio && (
              <p className="mt-2 max-w-2xl whitespace-pre-line text-muted">{author.data.bio}</p>
            )}
          </div>
          <FollowButton authorId={author.data.id} />
        </div>
      ) : mode === 'author' && author.isSuccess ? (
        <h1 className="mb-8 text-3xl font-extrabold md:text-4xl">Không tìm thấy tác giả</h1>
      ) : mode === 'series' && series.isSuccess && !series.data ? (
        <h1 className="mb-8 text-3xl font-extrabold md:text-4xl">Không tìm thấy series</h1>
      ) : mode === 'series' && series.data ? (
        <div className="mb-8">
          <p className="text-sm font-semibold text-muted">Series</p>
          <h1 className="text-3xl font-extrabold md:text-4xl">{series.data.title}</h1>
          {series.data.description && (
            <p className="mt-2 max-w-2xl whitespace-pre-line text-muted">
              {series.data.description}
            </p>
          )}
        </div>
      ) : heading ? (
        <h1 className="mb-8 text-3xl font-extrabold md:text-4xl">{heading}</h1>
      ) : (
        page === 1 && <Hero />
      )}
      {mode === 'series' && series.isSuccess && !series.data ? null : isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <Empty>
          {mode === 'following'
            ? 'Bạn chưa theo dõi ai, hoặc những người bạn theo dõi chưa đăng bài. Mở trang một tác giả và bấm “+ Theo dõi”.'
            : 'Chưa có bài viết nào.'}
        </Empty>
      ) : (
        <>
          {/* Newest first; two columns from lg so a 1280px screen shows four posts (UI review row 8). */}
          <div className="grid gap-6 lg:grid-cols-2">
            {data.items.map((post) => (
              <PostCard key={post.id} post={post} />
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
    <div className="relative mb-10 overflow-hidden rounded-3xl bg-surface px-6 py-10 text-center sm:px-12">
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
        Viết lại những điều <span className="text-primary">đáng nhớ</span>
      </h1>
      <p className="relative mx-auto mt-4 max-w-xl text-lg text-muted">
        Những câu chuyện, ghi chép và trải nghiệm — được kể theo cách gần gũi nhất.
      </p>
    </div>
  )
}
