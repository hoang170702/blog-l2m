import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { authApi } from '../../api/endpoints'
import type { User } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Avatar } from '../../components/UserMenu'
import { ErrorMessage } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export function ProfilePage() {
  useDocumentTitle('Hồ sơ')
  const { user } = useAuth()
  // Keyed so the form starts from the stored profile again after a save or account switch.
  return user ? <ProfileForm key={`${user.id}:${user.name}:${user.avatarUrl}`} user={user} /> : null
}

function ProfileForm({ user }: { user: User }) {
  const { refreshUser } = useAuth()
  const [name, setName] = useState(user.name)
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')
  const save = useMutation({
    mutationFn: () =>
      authApi.updateProfile(user.id, { name: name.trim(), avatarUrl: avatarUrl.trim() || null }),
    onSuccess: refreshUser,
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <section className="max-w-xl">
      <h1 className="mb-6 text-3xl font-extrabold">Hồ sơ</h1>
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <div className="flex items-center gap-4">
          <Avatar
            user={{ name: name || user.name, avatarUrl: avatarUrl.trim() || null }}
            size="h-16 w-16"
          />
          <div className="text-sm text-muted">
            <p>{user.email}</p>
            <Link to={`/u/${user.id}`} className="font-semibold text-primary hover:underline">
              Xem trang tác giả →
            </Link>
          </div>
        </div>
        <label className="block text-sm font-bold">
          Tên hiển thị
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input mt-2 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Ảnh đại diện (URL https)
          <input
            type="url"
            pattern="https://.*"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            className="input mt-2 font-normal"
          />
        </label>
        {save.isError && <ErrorMessage error={save.error} />}
        {save.isSuccess && (
          <p role="status" className="text-sm font-semibold text-green-700">
            Đã lưu hồ sơ.
          </p>
        )}
        <button type="submit" disabled={save.isPending} className="btn-primary">
          {save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
      </form>
    </section>
  )
}
