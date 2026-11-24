import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { adminApi, authApi } from '../../api/endpoints'
import type { User } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { ImageCropper } from '../../components/ImageCropper'
import { Avatar } from '../../components/UserMenu'
import { ErrorMessage } from '../../components/Status'
import type { CropRect } from '../../lib/image'
import { postImageUrl } from '../../lib/supabase'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const BIO_MAX = 500

export function ProfilePage() {
  useDocumentTitle('Hồ sơ')
  const { user } = useAuth()
  // Keyed so the form starts from the stored profile again after a save or an account switch.
  return user ? (
    <ProfileForm key={`${user.id}:${user.name}:${user.avatarPath}:${user.bio}`} user={user} />
  ) : null
}

function ProfileForm({ user }: { user: User }) {
  const { refreshUser } = useAuth()
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio ?? '')
  const [avatarPath, setAvatarPath] = useState(user.avatarPath)

  const [cropping, setCropping] = useState<File | null>(null)
  const upload = useMutation({
    mutationFn: ({ file, crop }: { file: File; crop?: CropRect }) =>
      adminApi.upload(file, 'avatar', crop),
    onSuccess: (result) => setAvatarPath(result.path),
  })
  const save = useMutation({
    mutationFn: () =>
      authApi.updateProfile(
        user.id,
        { name: name.trim(), bio: bio.trim() || null, avatarPath },
        user.avatarPath,
      ),
    onSuccess: refreshUser,
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  const avatarUrl = avatarPath ? postImageUrl(avatarPath) : user.providerAvatarUrl
  const dirty =
    name.trim() !== user.name || (bio.trim() || null) !== user.bio || avatarPath !== user.avatarPath

  return (
    <section className="max-w-xl">
      <h1 className="mb-6 text-3xl font-extrabold">Hồ sơ</h1>
      {cropping && (
        <ImageCropper
          file={cropping}
          shape="avatar"
          onCancel={() => setCropping(null)}
          onConfirm={(crop) => {
            setCropping(null)
            upload.mutate({ file: cropping, crop })
          }}
        />
      )}
      <form onSubmit={onSubmit} className="card space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={{ name: name || user.name, avatarUrl }} size="h-20 w-20" />
          <div className="space-y-2 text-sm">
            <label className="btn-ghost cursor-pointer px-3 py-1.5">
              {upload.isPending ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                aria-label="Ảnh đại diện"
                disabled={upload.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  // GIFs keep their animation, so they skip the crop step.
                  if (file?.type === 'image/gif') upload.mutate({ file })
                  else if (file) setCropping(file)
                  e.target.value = ''
                }}
              />
            </label>
            {avatarPath && (
              <button
                type="button"
                className="block font-semibold text-muted hover:text-red-600"
                onClick={() => setAvatarPath(null)}
              >
                {user.providerAvatarUrl ? 'Dùng ảnh từ Google/GitHub' : 'Bỏ ảnh đại diện'}
              </button>
            )}
            <p className="text-xs text-muted">Ảnh được cắt vuông ở giữa, tối đa 400×400.</p>
          </div>
        </div>
        {upload.isError && <ErrorMessage error={upload.error} />}

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
          Giới thiệu
          <textarea
            rows={4}
            maxLength={BIO_MAX}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Vài dòng về bạn, hiện trên trang tác giả"
            aria-label="Giới thiệu"
            className="input mt-2 resize-y font-normal"
          />
          <span className="mt-1 block text-right text-xs font-normal text-muted">
            {bio.length}/{BIO_MAX}
          </span>
        </label>

        <p className="text-sm text-muted">
          Email đăng nhập: {user.email} ·{' '}
          <Link to={`/u/${user.id}`} className="font-semibold text-primary hover:underline">
            Xem trang tác giả →
          </Link>
        </p>
        {save.isError && <ErrorMessage error={save.error} />}
        {save.isSuccess && !dirty && (
          <p role="status" className="text-sm font-semibold text-green-700">
            Đã lưu hồ sơ.
          </p>
        )}
        <button
          type="submit"
          disabled={save.isPending || upload.isPending || !dirty}
          className="btn-primary"
        >
          {save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
      </form>
    </section>
  )
}
