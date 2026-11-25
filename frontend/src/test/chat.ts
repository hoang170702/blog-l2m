import { vi } from 'vitest'

/** Empty chat API for tests that render the Layout (the dock loads the room and the inbox). */
export const chatApiMock = {
  messages: vi.fn().mockResolvedValue([]),
  message: vi.fn().mockResolvedValue(null),
  send: vi.fn(),
  remove: vi.fn(),
  openDm: vi.fn(),
  markRead: vi.fn().mockResolvedValue(undefined),
  inbox: vi.fn().mockResolvedValue([]),
  members: vi.fn().mockResolvedValue([]),
  blocks: vi.fn().mockResolvedValue([]),
  block: vi.fn(),
  unblock: vi.fn(),
}

/** A realtime channel that never fires; `subscribe` callbacks get SUBSCRIBED. */
export function fakeChannel() {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED')
      return channel
    }),
    track: vi.fn().mockResolvedValue('ok'),
    presenceState: vi.fn(() => ({})),
  }
  return channel
}

export const realtimeMock = {
  channel: vi.fn(() => fakeChannel()),
  removeChannel: vi.fn().mockResolvedValue('ok'),
}
