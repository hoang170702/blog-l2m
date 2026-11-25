import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../api/endpoints'
import { Pagination } from '../../components/Pagination'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { Avatar } from '../../components/UserMenu'
import { formatDate } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

/** Admin member list: suspend or restore accounts (admins themselves cannot be suspended). */
export function MembersPage() {
  useDocumentTitle('Thành viên')
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const members = useQuery({
    queryKey: ['admin-members', q, page],
    queryFn: () => adminApi.members({ page, q }),
    placeholderData: keepPreviousData,
  })
  const suspend = useMutation({
    mutationFn: ({ id, on, reason }: { id: string; on: boolean; reason?: string }) =>
      adminApi.setSuspended(id, on, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-members'] }),
  })

  function onSearch(event: FormEvent) {
    event.preventDefault()
    setQ(search)
    setPage(1)
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-extrabold">Thành viên</h1>
        <form onSubmit={onSearch} role="search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên hoặc email…"
            aria-label="Tìm thành viên"
            className="input py-2 text-sm"
          />
        </form>
      </div>
      {suspend.isError && <ErrorMessage error={suspend.error} />}
      {members.isPending ? (
        <Spinner />
      ) : members.error ? (
        <ErrorMessage error={members.error} onRetry={() => void members.refetch()} />
      ) : members.data.items.length === 0 ? (
        <Empty>Không có thành viên.</Empty>
      ) : (
        <>
          <ul className="card divide-y divide-line">
            {members.data.items.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Avatar user={member} />
                <div className="min-w-0 flex-1">
                  <Link to={`/u/${member.id}`} className="font-bold hover:text-primary">
                    {member.name}
                  </Link>
                  {member.isAdmin && (
                    <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary-dark">
                      Quản trị
                    </span>
                  )}
                  <p className="text-xs break-words text-muted">
                    {member.email} · tham gia {formatDate(member.createdAt)} · {member.postCount}{' '}
                    bài
                  </p>
                  {member.suspendedAt && (
                    <p className="text-xs font-semibold text-danger">
                      Bị khoá từ {formatDate(member.suspendedAt)}
                      {member.suspendedReason && <> · {member.suspendedReason}</>}
                    </p>
                  )}
                </div>
                {!member.isAdmin &&
                  (member.suspendedAt ? (
                    <button
                      className="text-sm font-semibold text-success hover:underline"
                      onClick={() => suspend.mutate({ id: member.id, on: false })}
                    >
                      Mở khoá
                    </button>
                  ) : (
                    <button
                      className="text-sm font-semibold text-danger hover:underline"
                      onClick={() => {
                        const reason = prompt(`Lý do khoá ${member.name}?`)
                        if (reason !== null) {
                          suspend.mutate({ id: member.id, on: true, reason: reason.slice(0, 500) })
                        }
                      }}
                    >
                      Khoá tài khoản
                    </button>
                  ))}
              </li>
            ))}
          </ul>
          <Pagination
            page={members.data.page}
            total={members.data.total}
            limit={members.data.limit}
            onChange={setPage}
          />
        </>
      )}
    </section>
  )
}
