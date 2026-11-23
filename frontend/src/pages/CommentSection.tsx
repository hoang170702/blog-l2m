import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { publicApi } from '../api/endpoints'
import { formatDate } from '../lib/format'
import { ErrorMessage } from '../components/Status'

export function CommentSection({ slug }: { slug: string }) {
  const comments = useQuery({
    queryKey: ['comments', slug],
    queryFn: () => publicApi.comments(slug),
  })
  const queryClient = useQueryClient()
  const [authorName, setAuthorName] = useState('')
  const [content, setContent] = useState('')
  const submit = useMutation({
    mutationFn: () => publicApi.submitComment(slug, { authorName, content }),
    onSuccess: () => {
      setContent('')
      return queryClient.invalidateQueries({ queryKey: ['comments', slug] })
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit.mutate()
  }

  return (
    <section className="mt-12">
      <h2 className="mb-6 text-2xl font-extrabold">
        Bình luận
        {comments.data?.length ? (
          <span className="ml-2 text-primary">{comments.data.length}</span>
        ) : null}
      </h2>
      {comments.data?.length ? (
        <ul className="space-y-4">
          {comments.data.map((comment) => (
            <li key={comment.id} className="card flex gap-4 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary font-display font-bold text-white">
                {comment.authorName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {comment.authorName}{' '}
                  <span className="font-normal text-muted">· {formatDate(comment.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-line">{comment.content}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
      )}

      <form onSubmit={onSubmit} className="card mt-6 space-y-3 p-6">
        <h3 className="text-lg font-bold">Để lại bình luận</h3>
        <input
          required
          maxLength={60}
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Tên của bạn"
          aria-label="Tên của bạn"
          className="input"
        />
        <textarea
          required
          maxLength={2000}
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nội dung bình luận"
          aria-label="Nội dung bình luận"
          className="input resize-y"
        />
        {submit.isError && <ErrorMessage error={submit.error} />}
        {submit.isSuccess && (
          <p
            role="status"
            className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary-dark"
          >
            Cảm ơn bạn! Bình luận đã được đăng.
          </p>
        )}
        <button type="submit" disabled={submit.isPending} className="btn-primary">
          Gửi bình luận
        </button>
      </form>
    </section>
  )
}
