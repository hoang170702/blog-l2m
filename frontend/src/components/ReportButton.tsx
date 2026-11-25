import { useMutation } from '@tanstack/react-query'
import { publicApi } from '../api/endpoints'
import type { ReportTarget } from '../api/types'

/** Asks for a reason, then files a report for the admins' review queue. */
export function ReportButton({
  target,
  label = 'Báo cáo',
}: {
  target: ReportTarget
  label?: string
}) {
  const report = useMutation({
    mutationFn: (reason: string) => publicApi.report(target, reason),
    onError: (error) => alert(error instanceof Error ? error.message : 'Gửi báo cáo thất bại'),
  })

  if (report.isSuccess) {
    return <span className="text-xs font-semibold text-muted">Đã gửi báo cáo</span>
  }
  return (
    <button
      type="button"
      disabled={report.isPending}
      onClick={() => {
        const reason = prompt('Lý do báo cáo (spam, xúc phạm, vi phạm bản quyền…)')?.trim()
        if (reason) report.mutate(reason.slice(0, 500))
      }}
      className="text-xs font-semibold text-muted transition hover:text-danger"
    >
      ⚑ {label}
    </button>
  )
}
