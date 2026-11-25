import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { adminApi, publicApi, type TermKind } from '../../api/endpoints'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const titles: Record<TermKind, string> = { categories: 'Chuyên mục', tags: 'Thẻ' }

export function TermsPage({ kind }: { kind: TermKind }) {
  useDocumentTitle(titles[kind])
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const terms = useQuery({ queryKey: ['terms', kind], queryFn: () => publicApi.terms(kind) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['terms', kind] })

  const create = useMutation({
    mutationFn: () => adminApi.createTerm(kind, name),
    onSuccess: () => {
      setName('')
      return refresh()
    },
  })
  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      adminApi.updateTerm(kind, id, value),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteTerm(kind, id),
    onSuccess: refresh,
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  const error = create.error ?? rename.error ?? remove.error

  return (
    <section className="max-w-xl">
      <h1 className="mb-4 text-3xl font-extrabold">{titles[kind]}</h1>
      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Tên ${titles[kind].toLowerCase()} mới`}
          aria-label="Tên"
          className="input flex-1 py-2"
        />
        <button type="submit" className="btn-primary">
          Thêm
        </button>
      </form>
      {error && <ErrorMessage error={error} />}
      {terms.isPending ? (
        <Spinner />
      ) : terms.error ? (
        <ErrorMessage error={terms.error} onRetry={() => void terms.refetch()} />
      ) : terms.data.length === 0 ? (
        <Empty>Chưa có mục nào.</Empty>
      ) : (
        <ul className="divide-y">
          {terms.data.map((term) => (
            <li key={term.id} className="flex items-center gap-3 py-2">
              <span className="flex-1">
                {term.name} <span className="text-xs text-muted">/{term.slug}</span>
              </span>
              <button
                className="text-sm text-muted hover:underline"
                onClick={() => {
                  const value = prompt('Tên mới', term.name)?.trim()
                  if (value && value !== term.name) rename.mutate({ id: term.id, value })
                }}
              >
                Đổi tên
              </button>
              <button
                className="text-sm text-danger hover:underline"
                onClick={() => confirm(`Xoá “${term.name}”?`) && remove.mutate(term.id)}
              >
                Xoá
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
