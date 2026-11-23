import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router'
import { adminApi, publicApi } from '../../api/endpoints'
import type { AdminPost, PostInput, PostStatus } from '../../api/types'
import { MarkdownToolbar } from '../../components/MarkdownToolbar'
import { Markdown } from '../../components/Markdown'
import { ErrorMessage, Spinner } from '../../components/Status'
import { applyAction, shortcuts } from '../../lib/markdownEdit'
import { postImageUrl } from '../../lib/supabase'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const emptyPost: PostInput = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImagePath: '',
  status: 'PUBLISHED',
  categoryId: null,
  tagIds: [],
}

function toInput(post: AdminPost): PostInput {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    content: post.content,
    coverImagePath: post.coverImagePath ?? '',
    status: post.status,
    categoryId: post.category?.id ?? null,
    tagIds: post.tags.map((tag) => tag.id),
  }
}

const sameInput = (a: PostInput, b: PostInput) => JSON.stringify(a) === JSON.stringify(b)

function imageFiles(list: FileList | null | undefined) {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
}

export function PostEditorPage() {
  const { id } = useParams()
  const existing = useQuery({
    queryKey: ['admin-post', id],
    queryFn: () => adminApi.post(id!),
    enabled: Boolean(id),
  })
  useDocumentTitle(id ? 'Sửa bài viết' : 'Viết bài mới')

  if (id && existing.isPending) return <Spinner />
  if (existing.error) return <ErrorMessage error={existing.error} />

  const initial = existing.data ? toInput(existing.data) : emptyPost
  return (
    <PostForm
      key={id ?? 'new'}
      id={id}
      initial={initial}
      wasPublished={existing.data?.status === 'PUBLISHED'}
      slug={existing.data?.slug}
    />
  )
}

function PostForm({
  id,
  initial,
  wasPublished,
  slug,
}: {
  id?: string
  initial: PostInput
  wasPublished: boolean
  slug?: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [post, setPost] = useState(initial)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState(0)
  const [uploadError, setUploadError] = useState<unknown>(null)
  const [newTag, setNewTag] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const saved = useRef(false)

  const categories = useQuery({
    queryKey: ['terms', 'categories'],
    queryFn: () => publicApi.terms('categories'),
  })
  const tags = useQuery({ queryKey: ['terms', 'tags'], queryFn: () => publicApi.terms('tags') })

  // Unsaved-changes guard: in-app navigation asks first, tab close/reload gets the browser prompt.
  const dirty = !sameInput(post, initial)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !saved.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useBeforeUnload((event) => {
    if (dirty && !saved.current) event.preventDefault()
  })
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (confirm('Bài viết có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  const save = useMutation({
    mutationFn: (status: PostStatus) => {
      const body: PostInput = {
        ...post,
        status,
        excerpt: post.excerpt || undefined,
        coverImagePath: post.coverImagePath || undefined,
        slug: post.slug || undefined,
      }
      return id ? adminApi.updatePost(id, body) : adminApi.createPost(body)
    },
    onSuccess: async (result) => {
      saved.current = true
      queryClient.setQueryData(['admin-post', result.id], result)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-posts'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['posts'] }),
        queryClient.invalidateQueries({ queryKey: ['post', result.slug] }),
      ])
      navigate(result.status === 'PUBLISHED' ? `/posts/${result.slug}` : '/dashboard/posts')
    },
  })

  const createTag = useMutation({
    mutationFn: (name: string) => adminApi.createTerm('tags', name),
    onSuccess: async (tag) => {
      setNewTag('')
      update('tagIds', [...post.tagIds, tag.id])
      await queryClient.invalidateQueries({ queryKey: ['terms', 'tags'] })
    },
  })

  function update<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setPost((current) => ({ ...current, [key]: value }))
  }

  async function upload(file: File) {
    setUploads((n) => n + 1)
    setUploadError(null)
    try {
      return await adminApi.upload(file)
    } catch (error) {
      setUploadError(error)
      return null
    } finally {
      setUploads((n) => n - 1)
    }
  }

  // The content is read when the upload finishes, so text typed meanwhile is kept.
  async function insertImages(files: File[]) {
    for (const file of files) {
      const result = await upload(file)
      if (!result) continue
      setPost((current) => {
        const at = contentRef.current?.selectionStart ?? current.content.length
        const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '')
        const snippet = `\n![${alt}](${result.url})\n`
        return {
          ...current,
          content: current.content.slice(0, at) + snippet + current.content.slice(at),
        }
      })
    }
  }

  async function setCover(file: File) {
    const result = await upload(file)
    if (result) update('coverImagePath', result.path)
  }

  function onContentDrop(event: DragEvent) {
    const files = imageFiles(event.dataTransfer.files)
    setDragging(false)
    if (files.length === 0) return
    event.preventDefault()
    void insertImages(files)
  }

  function onContentKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey)) return
    const action = shortcuts[event.key.toLowerCase()]
    if (!action) return
    event.preventDefault()
    applyAction(event.currentTarget, action, (text) => update('content', text))
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate('PUBLISHED')
  }

  const words = post.content.trim() ? post.content.trim().split(/\s+/).length : 0
  const coverUrl = post.coverImagePath ? postImageUrl(post.coverImagePath) : null

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-extrabold">{id ? 'Sửa bài viết' : 'Viết bài mới'}</h1>
        {dirty && !save.isPending && (
          <span className="rounded-full bg-secondary-soft px-3 py-1 text-xs font-bold text-secondary-dark">
            Chưa lưu
          </span>
        )}
        {wasPublished && slug && (
          <Link
            to={`/posts/${slug}`}
            className="text-sm font-semibold text-muted hover:text-primary"
          >
            Xem bài ↗
          </Link>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <input
            required
            maxLength={200}
            value={post.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Tiêu đề bài viết"
            aria-label="Tiêu đề"
            className="w-full border-0 bg-transparent font-display text-3xl font-extrabold outline-none placeholder:text-muted/60 md:text-4xl"
          />
          <textarea
            maxLength={500}
            rows={2}
            value={post.excerpt ?? ''}
            onChange={(e) => update('excerpt', e.target.value)}
            placeholder="Tóm tắt ngắn (hiện ở trang chủ)"
            aria-label="Tóm tắt"
            className="input resize-none"
          />

          <div className="card overflow-hidden">
            <div className="flex items-center border-b border-line lg:hidden">
              {(['write', 'preview'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`flex-1 py-2 text-sm font-semibold ${
                    tab === value ? 'border-b-2 border-primary text-primary' : 'text-muted'
                  }`}
                >
                  {value === 'write' ? 'Soạn thảo' : 'Xem trước'}
                </button>
              ))}
            </div>
            <div className="grid lg:grid-cols-2">
              <div
                className={`flex flex-col lg:border-r lg:border-line ${tab === 'write' ? '' : 'hidden lg:flex'}`}
              >
                <MarkdownToolbar
                  textareaRef={contentRef}
                  onChange={(text) => update('content', text)}
                  onPickImage={(file) => void insertImages([file])}
                  uploading={uploads > 0}
                />
                <div
                  className="relative flex-1"
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes('Files')) {
                      e.preventDefault()
                      setDragging(true)
                    }
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onContentDrop}
                >
                  <textarea
                    ref={contentRef}
                    required
                    value={post.content}
                    onChange={(e) => update('content', e.target.value)}
                    onKeyDown={onContentKeyDown}
                    onPaste={(e) => {
                      const files = imageFiles(e.clipboardData.files)
                      if (files.length > 0) {
                        e.preventDefault()
                        void insertImages(files)
                      }
                    }}
                    placeholder={
                      'Viết nội dung bằng Markdown…\n\nKéo thả hoặc dán ảnh vào đây để chèn.'
                    }
                    aria-label="Nội dung"
                    className="block h-[60vh] min-h-80 w-full resize-y bg-transparent p-5 font-mono text-sm leading-relaxed outline-none"
                  />
                  {dragging && (
                    <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary-soft/80 font-semibold text-primary-dark">
                      Thả ảnh để chèn vào bài
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-xs text-muted">
                  <span>{words} từ</span>
                  {uploads > 0 && (
                    <span className="font-semibold text-primary">Đang tải {uploads} ảnh…</span>
                  )}
                </div>
              </div>
              <div
                className={`h-[calc(60vh+5.5rem)] min-h-96 overflow-y-auto bg-surface p-6 ${tab === 'preview' ? '' : 'hidden lg:block'}`}
                aria-label="Xem trước"
              >
                {post.content.trim() ? (
                  <Markdown>{post.content}</Markdown>
                ) : (
                  <p className="text-muted">Bản xem trước sẽ hiện ở đây khi bạn gõ.</p>
                )}
              </div>
            </div>
          </div>
          {uploadError !== null && <ErrorMessage error={uploadError} />}
        </div>

        <aside className="space-y-4">
          <div className="card space-y-3 p-5">
            <p className="text-sm font-bold">Ảnh bìa</p>
            <label
              className="group relative block aspect-video cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-line bg-canvas transition hover:border-primary"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const file = imageFiles(e.dataTransfer.files)[0]
                if (file) {
                  e.preventDefault()
                  void setCover(file)
                }
              }}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="Ảnh bìa" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center px-4 text-center text-sm text-muted group-hover:text-primary">
                  Bấm hoặc kéo thả ảnh vào đây
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void setCover(file)
                  e.target.value = ''
                }}
              />
            </label>
            {coverUrl && (
              <button
                type="button"
                className="text-sm font-semibold text-red-600 hover:underline"
                onClick={() => update('coverImagePath', '')}
              >
                Bỏ ảnh bìa
              </button>
            )}
          </div>

          <div className="card space-y-3 p-5">
            <label className="block text-sm font-bold">
              Chuyên mục
              <select
                value={post.categoryId ?? ''}
                onChange={(e) => update('categoryId', e.target.value || null)}
                className="input mt-2 py-2 font-normal"
              >
                <option value="">— Không có —</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-bold">Thẻ</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.data?.map((tag) => {
                  const on = post.tagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        update(
                          'tagIds',
                          on ? post.tagIds.filter((t) => t !== tag.id) : [...post.tagIds, tag.id],
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        on
                          ? 'bg-primary text-white'
                          : 'bg-primary-soft text-primary-dark hover:bg-primary/20'
                      }`}
                    >
                      #{tag.name}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newTag}
                  maxLength={60}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (newTag.trim()) createTag.mutate(newTag.trim())
                    }
                  }}
                  placeholder="Thẻ mới"
                  aria-label="Thẻ mới"
                  className="input py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={!newTag.trim() || createTag.isPending}
                  onClick={() => createTag.mutate(newTag.trim())}
                  className="btn-ghost px-3 py-1.5"
                >
                  Thêm
                </button>
              </div>
              {createTag.isError && (
                <div className="mt-2">
                  <ErrorMessage error={createTag.error} />
                </div>
              )}
            </fieldset>

            <details className="text-sm">
              <summary className="cursor-pointer font-bold">Tuỳ chọn nâng cao</summary>
              <label className="mt-2 block text-muted">
                Đường dẫn (slug)
                <input
                  value={post.slug ?? ''}
                  onChange={(e) => update('slug', e.target.value)}
                  placeholder="để trống để tự tạo từ tiêu đề"
                  aria-label="Slug"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  className="input mt-1 py-2 text-sm"
                />
              </label>
            </details>
          </div>

          <div className="card space-y-3 p-5">
            {save.isError && <ErrorMessage error={save.error} />}
            <button
              type="submit"
              disabled={save.isPending || uploads > 0}
              className="btn-primary w-full py-3"
            >
              {save.isPending ? 'Đang lưu…' : wasPublished ? 'Cập nhật bài' : '🚀 Đăng bài'}
            </button>
            <button
              type="button"
              disabled={save.isPending || uploads > 0}
              onClick={() => {
                // Native validation still applies to the draft (title and content are required).
                if (contentRef.current?.form?.reportValidity()) save.mutate('DRAFT')
              }}
              className="btn-ghost w-full"
            >
              {wasPublished ? 'Chuyển về nháp' : 'Lưu nháp'}
            </button>
            <p className="text-center text-xs text-muted">
              Bấm đăng là bài hiện ngay cho mọi người đọc.
            </p>
          </div>
        </aside>
      </div>
    </form>
  )
}
