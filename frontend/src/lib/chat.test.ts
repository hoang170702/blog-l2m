import type { ChatMessage } from '../api/types'
import { countUnreadRoom, groupMessages, mergeMessage, subscribeMessages } from './chat'

function msg(id: string, userId: string, createdAt: string): ChatMessage {
  return {
    id,
    threadId: null,
    userId,
    content: id,
    masked: false,
    createdAt,
    author: { id: userId, name: userId, avatarUrl: null },
  }
}

describe('chat helpers', () => {
  it('groups consecutive messages of one member within five minutes', () => {
    const groups = groupMessages([
      msg('a', 'u1', '2026-11-25T10:00:00Z'),
      msg('b', 'u1', '2026-11-25T10:03:00Z'),
      msg('c', 'u1', '2026-11-25T10:09:00Z'), // 6 min after b → new group
      msg('d', 'u2', '2026-11-25T10:09:30Z'),
    ])
    expect(groups.map((g) => g.messages.map((m) => m.id))).toEqual([['a', 'b'], ['c'], ['d']])
  })

  it('merges a message in order and ignores a duplicate', () => {
    const list = [msg('a', 'u1', '2026-11-25T10:00:00Z'), msg('c', 'u1', '2026-11-25T10:02:00Z')]
    const merged = mergeMessage(list, msg('b', 'u2', '2026-11-25T10:01:00Z'))
    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(mergeMessage(merged, msg('b', 'u2', '2026-11-25T10:01:00Z'))).toBe(merged)
  })

  it('counts unread room messages from others after the read mark', () => {
    const list = [
      msg('a', 'u2', '2026-11-25T10:00:00Z'),
      msg('b', 'u1', '2026-11-25T10:05:00Z'),
      msg('c', 'u2', '2026-11-25T10:06:00Z'),
    ]
    expect(countUnreadRoom(list, 'u1', null)).toBe(2)
    expect(countUnreadRoom(list, 'u1', '2026-11-25T10:01:00Z')).toBe(1)
  })

  it('routes realtime inserts and deletes and unsubscribes', () => {
    const handlers: Record<string, (payload: unknown) => void> = {}
    const channel = {
      on: vi.fn((_: string, filter: { event: string }, cb: (p: unknown) => void) => {
        handlers[filter.event] = cb
        return channel
      }),
      subscribe: vi.fn(() => channel),
    }
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() }
    const onInsert = vi.fn()
    const onDelete = vi.fn()
    const off = subscribeMessages(client as never, { onInsert, onDelete })
    handlers.INSERT({ new: { id: 'm1', thread_id: 't1' } })
    handlers.DELETE({ old: { id: 'm0' } })
    expect(onInsert).toHaveBeenCalledWith('m1', 't1')
    expect(onDelete).toHaveBeenCalledWith('m0')
    off()
    expect(client.removeChannel).toHaveBeenCalledWith(channel)
  })
})
