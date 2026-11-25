import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { publicApi } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'

/** Follow / unfollow an author (D43); hidden on your own page, a login link when signed out. */
export function FollowButton({ authorId }: { authorId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = ['following', authorId, user?.id]
  const following = useQuery({
    queryKey: key,
    queryFn: () => publicApi.following(authorId),
    enabled: Boolean(user) && user?.id !== authorId,
  })
  const toggle = useMutation({
    mutationFn: (next: boolean) => publicApi.setFollowing(authorId, next),
    onSuccess: (_, next) => {
      queryClient.setQueryData(key, next)
      void queryClient.invalidateQueries({ queryKey: ['author', authorId] })
      return queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
  const className =
    'inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary'

  if (user?.id === authorId) return null
  if (!user) {
    return (
      <Link to="/login" state={{ from: `/u/${authorId}` }} className={className}>
        + Theo dõi
      </Link>
    )
  }
  const on = following.data === true
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        aria-pressed={on}
        disabled={following.isPending || toggle.isPending}
        onClick={() => toggle.mutate(!on)}
        className={`${className} ${on ? 'border-primary bg-primary-soft text-primary-dark' : ''}`}
      >
        {on ? '✓ Đang theo dõi' : '+ Theo dõi'}
      </button>
      {toggle.isError && <span className="text-sm text-danger">{toggle.error.message}</span>}
    </span>
  )
}
