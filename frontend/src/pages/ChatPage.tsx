import { useNavigate, useParams } from 'react-router'
import { ChatPanel } from '../components/chat/ChatPanel'

/** Full-page chat at /chat and /chat/:threadId (same panel as the floating dock). */
export function ChatPage() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-3xl font-extrabold">Trò chuyện</h1>
      <div className="card flex h-[70vh] min-h-[480px] flex-col overflow-hidden">
        <ChatPanel
          key={threadId ?? 'root'}
          initialThreadId={threadId ?? null}
          onThreadChange={(id) => navigate(id ? `/chat/${id}` : '/chat', { replace: true })}
          className="flex-1"
        />
      </div>
    </div>
  )
}
