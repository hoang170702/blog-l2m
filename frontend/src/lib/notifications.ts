import type { Notification } from '../api/types'

/** One Vietnamese sentence per notification kind (D44). */
export function notificationText(item: Notification) {
  const title = item.post ? `“${item.post.title}”` : 'một bài viết'
  switch (item.kind) {
    case 'comment':
      return `${item.actorName} đã bình luận bài ${title}`
    case 'like':
      return `${item.actorName} đã thích bài ${title}`
    case 'new_post':
      return `${item.actorName} đã đăng bài mới: ${title}`
  }
}
