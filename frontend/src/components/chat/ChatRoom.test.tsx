import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { ChatMessage, User } from '../../api/types'
import { renderWithProviders } from '../../test/render'
import { ChatRoom } from './ChatRoom'

const api = vi.hoisted(() => ({ currentUser: vi.fn() }))

vi.mock('../../api/endpoints', async () => ({
  chatApi: (await import('../../test/chat')).chatApiMock,
  authApi: { currentUser: api.currentUser },
}))
vi.mock('../../lib/supabase', async () => ({
  supabase: {
    ...(await import('../../test/chat')).realtimeMock,
    auth: {
      onAuthStateChange: (callback: (event: string) => void) => {
        setTimeout(() => callback('INITIAL_SESSION'), 0)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  },
}))

const me: User = {
  id: 'u1',
  email: 'me@x.y',
  name: 'Tôi',
  avatarUrl: null,
  isAdmin: false,
  suspended: false,
  bio: null,
  avatarPath: null,
  providerAvatarUrl: null,
}
const other: ChatMessage = {
  id: 'm1',
  threadId: null,
  userId: 'u2',
  content: 'Chào cả nhà',
  masked: false,
  createdAt: '2026-11-25T10:00:00Z',
  author: { id: 'u2', name: 'Lan', avatarUrl: null },
}

describe('ChatRoom', () => {
  beforeEach(async () => {
    const { chatApiMock } = await import('../../test/chat')
    chatApiMock.messages.mockResolvedValue([other])
    chatApiMock.send.mockImplementation(async (threadId: string | null, content: string) => ({
      id: 'm2',
      threadId,
      userId: me.id,
      content,
      masked: false,
      createdAt: '2026-11-25T10:01:00Z',
      author: { id: me.id, name: me.name, avatarUrl: null },
    }))
    api.currentUser.mockResolvedValue(me)
    localStorage.clear()
  })

  it('shows the room, sends with Enter and marks the room read', async () => {
    const { chatApiMock } = await import('../../test/chat')
    renderWithProviders(<ChatRoom threadId={null} />)
    expect(await screen.findByText('Chào cả nhà')).toBeInTheDocument()
    expect(screen.getByText('Lan')).toBeInTheDocument()
    expect(localStorage.getItem('chat-read-room')).not.toBeNull()

    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Tin nhắn' }), 'Hello{Enter}')
    await waitFor(() => expect(chatApiMock.send).toHaveBeenCalledWith(null, 'Hello'))
    expect(await screen.findByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Bạn')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toHaveValue('')
    // Only the own message has a delete button.
    expect(screen.getAllByRole('button', { name: 'Xoá tin nhắn' })).toHaveLength(1)
  })

  it('does not send blank text and disables the composer for a suspended member', async () => {
    const { chatApiMock } = await import('../../test/chat')
    api.currentUser.mockResolvedValue({ ...me, suspended: true })
    renderWithProviders(<ChatRoom threadId={null} />)
    await screen.findByText('Chào cả nhà')
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled()
    expect(chatApiMock.send).not.toHaveBeenCalled()
  })

  it('marks a private thread read through the API', async () => {
    const { chatApiMock } = await import('../../test/chat')
    renderWithProviders(<ChatRoom threadId="t1" />)
    await screen.findByText('Chào cả nhà')
    await waitFor(() => expect(chatApiMock.markRead).toHaveBeenCalledWith('t1'))
  })
})
