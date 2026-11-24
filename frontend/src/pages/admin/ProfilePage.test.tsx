import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { User } from '../../api/types'
import { renderWithProviders } from '../../test/render'
import { ProfilePage } from './ProfilePage'

const api = vi.hoisted(() => ({
  currentUser: vi.fn(),
  updateProfile: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('../../api/endpoints', () => ({
  authApi: { currentUser: api.currentUser, updateProfile: api.updateProfile },
  adminApi: { upload: api.upload },
}))
vi.mock('../../lib/supabase', () => ({
  postImageUrl: (path: string) => `https://db.example/storage/${path}`,
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string) => void) => {
        setTimeout(() => callback('INITIAL_SESSION'), 0)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  },
}))

const lan: User = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'lan@test.local',
  name: 'Lan from GitHub',
  avatarUrl: 'https://avatars.example/lan.png',
  isAdmin: false,
  suspended: false,
  bio: null,
  avatarPath: '22222222-2222-4222-8222-222222222222/old.webp',
  providerAvatarUrl: 'https://avatars.example/lan.png',
}

describe('ProfilePage', () => {
  it('saves a new name, bio and uploaded avatar, replacing the old avatar', async () => {
    api.currentUser.mockResolvedValue(lan)
    api.updateProfile.mockResolvedValue(undefined)
    api.upload.mockResolvedValue({
      path: '22222222-2222-4222-8222-222222222222/new.webp',
      url: 'https://db.example/storage/new.webp',
    })
    renderWithProviders(<ProfilePage />)
    const user = userEvent.setup()

    const name = await screen.findByLabelText('Tên hiển thị')
    await user.clear(name)
    await user.type(name, 'Lan')
    await user.type(screen.getByLabelText('Giới thiệu'), '  Viết về Đà Lạt  ')
    await user.upload(
      screen.getByLabelText('Ảnh đại diện'),
      new File(['x'], 'me.png', { type: 'image/png' }),
    )
    // The crop dialog opens first; jsdom loads no pixels, so give the image a size.
    const dialog = await screen.findByRole('dialog', { name: 'Chọn vùng ảnh' })
    const img = dialog.querySelector('img')!
    Object.defineProperty(img, 'naturalWidth', { value: 1200 })
    Object.defineProperty(img, 'naturalHeight', { value: 800 })
    fireEvent.load(img)
    await user.click(within(dialog).getByRole('button', { name: 'Dùng ảnh này' }))
    await waitFor(() =>
      expect(api.upload).toHaveBeenCalledWith(expect.any(File), 'avatar', {
        sx: 200,
        sy: 0,
        sw: 800,
        sh: 800,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))

    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith(
        lan.id,
        {
          name: 'Lan',
          bio: 'Viết về Đà Lạt',
          avatarPath: '22222222-2222-4222-8222-222222222222/new.webp',
        },
        '22222222-2222-4222-8222-222222222222/old.webp',
      ),
    )
  })

  it('can go back to the sign-in provider picture', async () => {
    api.currentUser.mockResolvedValue(lan)
    api.updateProfile.mockResolvedValue(undefined)
    renderWithProviders(<ProfilePage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Dùng ảnh từ Google/GitHub' }))
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))

    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith(
        lan.id,
        { name: 'Lan from GitHub', bio: null, avatarPath: null },
        lan.avatarPath,
      ),
    )
  })
})
