import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { publicApi } from '../api/endpoints'
import type { Comment } from '../api/types'
import { formatDate } from '../lib/format'
import { ReportButton } from '../components/ReportButton'
import { ErrorMessage } from '../components/Status'

export function CommentSection({ slug }: { slug: string }) {
  const comments = useQuery({
    queryKey: ['comments', slug],
    queryFn: () => publicApi.comments(slug),
  })
  const [replyTo, setReplyTo] = useState<string | null>(null)

  // Replies are one level deep; a reply whose parent is hidden is not shown.
  const topLevel: Comment[] = []
  const replies = new Map<string, Comment[]>()
  for (const comment of comments.data ?? []) {
    if (comment.parentId === null) topLevel.push(comment)
    else replies.set(comment.parentId, [...(replies.get(comment.parentId) ?? []), comment])
  }
  const repliesOf = (id: string) => replies.get(id) ?? []
  const shown = topLevel.reduce((n, comment) => n + 1 + repliesOf(comment.id).length, 0)

  return (
    <section className="mt-12">
      <h2 className="mb-6 text-2xl font-extrabold">
        Bình luận
        {shown ? <span className="ml-2 text-primary">{shown}</span> : null}
      </h2>
      {topLevel.length ? (
        <ul className="space-y-4">
          {topLevel.map((comment) => (
            <li key={comment.id} className="card p-5">
              <CommentBody comment={comment} />
              <div className="mt-2 pl-14">
                <button
                  type="button"
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {replyTo === comment.id ? 'Huỷ trả lời' : 'Trả lời'}
                </button>
              </div>
              {(repliesOf(comment.id).length > 0 || replyTo === comment.id) && (
                <div className="mt-4 space-y-4 border-l-2 border-line pl-4 sm:ml-14">
                  {repliesOf(comment.id).map((reply) => (
                    <CommentBody key={reply.id} comment={reply} />
                  ))}
                  {replyTo === comment.id && (
                    <CommentForm
                      slug={slug}
                      parentId={comment.id}
                      title={`Trả lời ${comment.authorName}`}
                      onDone={() => setReplyTo(null)}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
      )}

      <div className="mt-6">
        <CommentForm slug={slug} title="Để lại bình luận" />
      </div>
    </section>
  )
}

function CommentBody({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary font-display font-bold text-white">
        {comment.authorName.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold">
          {comment.authorName}
          <span className="font-normal text-muted">· {formatDate(comment.createdAt)}</span>
          <span className="ml-auto">
            <ReportButton target={{ commentId: comment.id }} />
          </span>
        </p>
        <p className="mt-1 whitespace-pre-line">{comment.content}</p>
      </div>
    </div>
  )
}

function CommentForm({
  slug,
  parentId,
  title,
  onDone,
}: {
  slug: string
  parentId?: string
  title: string
  onDone?: () => void
}) {
  const queryClient = useQueryClient()
  const [authorName, setAuthorName] = useState('')
  const [content, setContent] = useState('')
  const submit = useMutation({
    mutationFn: () => publicApi.submitComment(slug, { authorName, content, parentId }),
    onSuccess: async () => {
      setContent('')
      await queryClient.invalidateQueries({ queryKey: ['comments', slug] })
      onDone?.()
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit.mutate()
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-3 ${parentId ? '' : 'card p-6'}`}>
      <h3 className={parentId ? 'text-sm font-bold' : 'text-lg font-bold'}>{title}</h3>
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
        rows={parentId ? 3 : 4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Nội dung bình luận"
        aria-label="Nội dung bình luận"
        className="input resize-y"
      />
      {submit.isError && <ErrorMessage error={submit.error} />}
      {submit.isSuccess && !parentId && (
        <p
          role="status"
          className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary-dark"
        >
          Cảm ơn bạn! Bình luận đã được đăng.
        </p>
      )}
      <button type="submit" disabled={submit.isPending} className="btn-primary">
        {parentId ? 'Gửi trả lời' : 'Gửi bình luận'}
      </button>
    </form>
  )
}
