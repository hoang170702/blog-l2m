import { useQuery } from '@tanstack/react-query'
import { chatApi } from '../../api/endpoints'

/** The inbox query is shared by the dock badge and the Riêng tab. */
export function useInbox(enabled = true) {
  return useQuery({
    queryKey: ['dm-inbox'],
    queryFn: chatApi.inbox,
    enabled,
    refetchInterval: 30_000,
  })
}
