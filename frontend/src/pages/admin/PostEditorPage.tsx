import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { adminApi, publicApi } from '../../api/endpoints'
import type { PostInput } from '../../api/types'
import { Markdown } from '../../components/Markdown'
import { ErrorMessage, Spinner } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const emptyPost: PostInput = {
  title: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
  status: 'DRAFT',
  categoryId: null,
  tagIds: [],
}

export function PostEditorPage() {
  const { id } = useParams()
  const existing = useQuery({
    queryKey: ['admin-post', id],
    queryFn: () => adminApi.post(id!),
    enabled: Boolean(id),
  })
  useDocumentTitle(id ? 'Sửa bài viết' : 'Bài viết mới')

  if (id && existing.isPending) return <Spinner />
  if (existing.error) return <ErrorMessage error={existing.error} />

  const initial: PostInput = existing.data
    ? {
        title: existing.data.title,
        slug: existing.data.slug,
        excerpt: existing.data.excerpt ?? '',
        content: existing.data.content,
        coverImageUrl: existing.data.coverImageUrl ?? '',
        status: existing.data.status,
        categoryId: existing.data.category?.id ?? null,
        tagIds: existing.data.tags.map((tag) => tag.id),
      }
    : emptyPost
  return <PostForm key={id ?? 'new'} id={id} initial={initial} />
}

function PostForm({ id, initial }: { id?: string; initial: PostInput }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [post, setPost] = useState(initial)
  const [preview, setPreview] = useState(false)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const categories = useQuery({
    queryKey: ['terms', 'categories'],
    queryFn: () => publicApi.terms('categories'),
  })
  const tags = useQuery({ queryKey: ['terms', 'tags'], queryFn: () => publicApi.terms('tags') })

  const save = useMutation({
    mutationFn: () => {
      const body: PostInput = {
        ...post,
        excerpt: post.excerpt || undefined,
        coverImageUrl: post.coverImageUrl || undefined,
        slug: post.slug || undefined,
      }
      return id ? adminApi.updatePost(id, body) : adminApi.createPost(body)
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-posts'] })
      queryClient.setQueryData(['admin-post', saved.id], saved)
      navigate('/admin/posts')
    },
  })

  const upload = useMutation({ mutationFn: adminApi.upload })

  function update<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setPost((current) => ({ ...current, [key]: value }))
  }

  async function insertImage(file: File) {
    const { url } = await upload.mutateAsync(file)
    const textarea = contentRef.current
    const at = textarea?.selectionStart ?? post.content.length
    update('content', `${post.content.slice(0, at)}\n![](${url})\n${post.content.slice(at)}`)
  }

  async function setCover(file: File) {
    const { url } = await upload.mutateAsync(file)
    update('coverImageUrl', url)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold">{id ? 'Sửa bài viết' : 'Bài viết mới'}</h1>
      <input
        required
        maxLength={200}
        value={post.title}
        onChange={(e) => update('title', e.target.value)}
        placeholder="Tiêu đề"
        aria-label="Tiêu đề"
        className="w-full rounded border px-3 py-2 text-lg"
      />
      <input
        value={post.slug ?? ''}
        onChange={(e) => update('slug', e.target.value)}
        placeholder="Slug (để trống để tự tạo)"
        aria-label="Slug"
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <textarea
        maxLength={500}
        rows={2}
        value={post.excerpt ?? ''}
        onChange={(e) => update('excerpt', e.target.value)}
        placeholder="Tóm tắt"
        aria-label="Tóm tắt"
        className="w-full rounded border px-3 py-2"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          Chuyên mục
          <select
            value={post.categoryId ?? ''}
            onChange={(e) => update('categoryId', e.target.value || null)}
            className="mt-1 w-full rounded border px-2 py-1.5"
          >
            <option value="">— Không có —</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Trạng thái
          <select
            value={post.status}
            onChange={(e) => update('status', e.target.value as PostInput['status'])}
            className="mt-1 w-full rounded border px-2 py-1.5"
          >
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Xuất bản</option>
          </select>
        </label>
        <label className="text-sm">
          Ảnh bìa
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => e.target.files?.[0] && setCover(e.target.files[0])}
            className="mt-1 block w-full text-xs"
          />
          {post.coverImageUrl && (
            <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              {post.coverImageUrl}
              <button
                type="button"
                className="text-red-600"
                onClick={() => update('coverImageUrl', '')}
              >
                bỏ
              </button>
            </span>
          )}
        </label>
      </div>

      <fieldset className="text-sm">
        <legend>Thẻ</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {tags.data?.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={post.tagIds.includes(tag.id)}
                onChange={(e) =>
                  update(
                    'tagIds',
                    e.target.checked
                      ? [...post.tagIds, tag.id]
                      : post.tagIds.filter((t) => t !== tag.id),
                  )
                }
              />
              {tag.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-4 text-sm">
        <button type="button" className="underline" onClick={() => setPreview((p) => !p)}>
          {preview ? 'Soạn thảo' : 'Xem trước'}
        </button>
        <label className="cursor-pointer underline">
          Chèn ảnh
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && insertImage(e.target.files[0])}
          />
        </label>
        {upload.isPending && <span className="text-slate-500">Đang tải ảnh…</span>}
      </div>
      {upload.isError && <ErrorMessage error={upload.error} />}

      {preview ? (
        <div className="min-h-64 rounded border p-4">
          <Markdown>{post.content}</Markdown>
        </div>
      ) : (
        <textarea
          ref={contentRef}
          required
          rows={20}
          value={post.content}
          onChange={(e) => update('content', e.target.value)}
          placeholder="Nội dung (Markdown)"
          aria-label="Nội dung"
          className="w-full rounded border px-3 py-2 font-mono text-sm"
        />
      )}

      {save.isError && <ErrorMessage error={save.error} />}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
        >
          Lưu
        </button>
        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={() => navigate('/admin/posts')}
        >
          Huỷ
        </button>
      </div>
    </form>
  )
}
