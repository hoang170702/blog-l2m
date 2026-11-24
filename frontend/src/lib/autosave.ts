/** Editor autosave keys in localStorage: one per user and post ("new" for an unsaved post). */
const PREFIX = 'l2m:autosave:'

export const autosaveKey = (userId: string, postId: string | undefined) =>
  `${PREFIX}${userId}:${postId ?? 'new'}`

/** Drops every autosaved draft, so nothing stays on a shared computer after signing out. */
export function clearAutosaves() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(PREFIX))
    .forEach((key) => localStorage.removeItem(key))
}
