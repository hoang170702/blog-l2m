/**
 * Chat helpers (PLAN-20261125-chat): the realtime subscription, presence, the shared-room read
 * mark and message grouping. Everything that talks to Supabase takes the client as a parameter so
 * tests can pass a fake.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage } from '../api/types'

type MinimalClient = Pick<SupabaseClient, 'channel' | 'removeChannel'>

/** Messages per page when loading a conversation. */
export const CHAT_PAGE = 50

export interface MessageEvents {
  /** A row the current member may see was inserted; `threadId` null is the shared room. */
  onInsert: (id: string, threadId: string | null) => void
  onDelete: (id: string) => void
}

/**
 * One channel for every message the member is allowed to see (row-level security filters on the
 * server). Returns an unsubscribe function.
 */
export function subscribeMessages(client: MinimalClient, events: MessageEvents): () => void {
  const channel: RealtimeChannel = client
    .channel('messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const row = payload.new as { id: string; thread_id: string | null }
      events.onInsert(row.id, row.thread_id)
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) =>
      events.onDelete((payload.old as { id: string }).id),
    )
    .subscribe()
  return () => void client.removeChannel(channel)
}

/** Presence in the shared room: calls `onCount` with the number of distinct members online. */
export function trackPresence(
  client: MinimalClient,
  userId: string,
  onCount: (count: number) => void,
): () => void {
  const channel: RealtimeChannel = client.channel('room-presence', {
    config: { presence: { key: userId } },
  })
  channel
    .on('presence', { event: 'sync' }, () => {
      onCount(Object.keys(channel.presenceState()).length)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track({ at: Date.now() })
    })
  return () => void client.removeChannel(channel)
}

const ROOM_READ_KEY = 'chat-read-room'

/** When the member last looked at the shared room (ISO string), or null. */
export function getRoomReadMark(storage: Pick<Storage, 'getItem'> = localStorage): string | null {
  return storage.getItem(ROOM_READ_KEY)
}

export function setRoomReadMark(
  at: string = new Date().toISOString(),
  storage: Pick<Storage, 'setItem'> = localStorage,
) {
  storage.setItem(ROOM_READ_KEY, at)
}

/** Room messages from others newer than the read mark. */
export function countUnreadRoom(messages: ChatMessage[], userId: string, readMark: string | null) {
  return messages.filter((m) => m.userId !== userId && (!readMark || m.createdAt > readMark)).length
}

export interface MessageGroup {
  author: ChatMessage['author']
  userId: string
  startedAt: string
  messages: ChatMessage[]
}

/** Consecutive messages by the same member within five minutes share one avatar and name. */
export function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const message of messages) {
    const last = groups.at(-1)
    const close =
      last &&
      last.userId === message.userId &&
      Date.parse(message.createdAt) - Date.parse(last.messages.at(-1)!.createdAt) < 5 * 60_000
    if (close) last.messages.push(message)
    else
      groups.push({
        author: message.author,
        userId: message.userId,
        startedAt: message.createdAt,
        messages: [message],
      })
  }
  return groups
}

/** Inserts a message keeping chronological order and dropping duplicates (realtime + own send). */
export function mergeMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  if (messages.some((m) => m.id === incoming.id)) return messages
  const next = [...messages, incoming]
  next.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return next
}
