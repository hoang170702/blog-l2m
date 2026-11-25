import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { adminApi } from '../../api/endpoints'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { formatDate } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

type Tab = 'words' | 'clients'

/** Admin tools for comments (D50): the banned-word list and blocked addresses. */
export function ModerationPage() {
  useDocumentTitle('Kiểm duyệt')
  const [tab, setTab] = useState<Tab>('words')
  return (
    <section className="max-w-2xl">
      <h1 className="mb-4 text-3xl font-extrabold">Kiểm duyệt bình luận</h1>
      <div
        role="tablist"
        className="mb-4 flex gap-1 rounded-full bg-surface p-1 text-sm font-semibold"
      >
        {(
          [
            ['words', 'Từ cấm'],
            ['clients', 'IP bị chặn'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-full px-4 py-2 transition ${tab === value ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'words' ? <BannedWords /> : <BlockedClients />}
    </section>
  )
}

function BannedWords() {
  const queryClient = useQueryClient()
  const [word, setWord] = useState('')
  const words = useQuery({ queryKey: ['banned-words'], queryFn: adminApi.bannedWords })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['banned-words'] })
  const add = useMutation({
    mutationFn: () => adminApi.addBannedWord(word),
    onSuccess: () => {
      setWord('')
      return refresh()
    },
  })
  const remove = useMutation({ mutationFn: adminApi.removeBannedWord, onSuccess: refresh })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (word.trim()) add.mutate()
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted">
        Từ trong danh sách bị thay bằng dấu * khi xuất hiện nguyên vẹn trong bình luận mới, không
        phân biệt hoa thường hay dấu. Bình luận cũ không đổi.
      </p>
      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input
          required
          maxLength={40}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Từ hoặc cụm từ cần che"
          aria-label="Từ cấm mới"
          className="input flex-1 py-2"
        />
        <button type="submit" className="btn-primary">
          Thêm
        </button>
      </form>
      {(add.error ?? remove.error) && <ErrorMessage error={add.error ?? remove.error} />}
      {words.isPending ? (
        <Spinner />
      ) : words.error ? (
        <ErrorMessage error={words.error} />
      ) : words.data.length === 0 ? (
        <Empty>Danh sách trống.</Empty>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {words.data.map((item) => (
            <li key={item} className="pill gap-2 hover:bg-primary-soft hover:text-primary-dark">
              {item}
              <button
                type="button"
                aria-label={`Xoá từ ${item}`}
                onClick={() => remove.mutate(item)}
                className="text-muted hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function BlockedClients() {
  const queryClient = useQueryClient()
  const clients = useQuery({ queryKey: ['blocked-clients'], queryFn: adminApi.blockedClients })
  const unblock = useMutation({
    mutationFn: adminApi.unblockClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocked-clients'] }),
  })
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        Địa chỉ bị chặn không gửi được bình luận. Chặn từ trang Bình luận, bằng nút “Chặn IP” dưới
        một bình luận. Địa chỉ đổi theo mạng, nên đây chỉ là biện pháp tạm.
      </p>
      {unblock.error && <ErrorMessage error={unblock.error} />}
      {clients.isPending ? (
        <Spinner />
      ) : clients.error ? (
        <ErrorMessage error={clients.error} />
      ) : clients.data.length === 0 ? (
        <Empty>Chưa chặn địa chỉ nào.</Empty>
      ) : (
        <ul className="space-y-2">
          {clients.data.map((item) => (
            <li
              key={item.client}
              className="card flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <code className="font-bold">{item.client}</code>
              <span className="text-muted">
                {formatDate(item.blockedAt)} · {item.commentCount} bình luận
                {item.reason && <> · {item.reason}</>}
              </span>
              <button
                type="button"
                onClick={() => unblock.mutate(item.client)}
                className="ml-auto font-semibold text-primary hover:underline"
              >
                Bỏ chặn
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
