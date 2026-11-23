import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { publicApi } from '../api/endpoints'
import { formatDate } from '../lib/format'
import { ErrorMessage } from '../components/Status'

export function CommentSection({ slug }: { slug: string }) {
  const comments = useQuery({
    queryKey: ['comments', slug],
    queryFn: () => publicApi.comments(slug),
  })
  const [authorName, setAuthorName] = useState('')
  const [content, setContent] = useState('')
  const submit = useMutation({
    mutationFn: () => publicApi.submitComment(slug, { authorName, content }),
    onSuccess: () => {
      setContent('')
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit.mutate()
  }

  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="mb-4 text-xl font-semibold">Bình luận</h2>
      {comments.data?.length ? (
        <ul className="space-y-4">
          {comments.data.map((comment) => (
            <li key={comment.id} className="rounded bg-slate-50 p-4">
              <p className="text-sm font-medium">
                {comment.authorName}{' '}
                <span className="font-normal text-slate-500">
                  · {formatDate(comment.createdAt)}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-line">{comment.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">Chưa có bình luận nào.</p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          required
          maxLength={60}
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Tên của bạn"
          aria-label="Tên của bạn"
          className="w-full rounded border px-3 py-2"
        />
        <textarea
          required
          maxLength={2000}
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nội dung bình luận"
          aria-label="Nội dung bình luận"
          className="w-full rounded border px-3 py-2"
        />
        {submit.isError && <ErrorMessage error={submit.error} />}
        {submit.isSuccess && (
          <p role="status" className="text-green-700">
            Cảm ơn bạn! Bình luận sẽ hiển thị sau khi được duyệt.
          </p>
        )}
        <button
          type="submit"
          disabled={submit.isPending}
          className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
        >
          Gửi bình luận
        </button>
      </form>
    </section>
  )
}
