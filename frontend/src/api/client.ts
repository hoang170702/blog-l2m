/** Error type shared by the data layer; `status` follows HTTP semantics so pages can branch on 404. */

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface SupabaseLikeError {
  code?: string
  message?: string
  status?: number
}

// PostgreSQL / PostgREST codes raised by our schema and RPCs (see supabase/migrations).
const knownErrors: Record<string, [number, string]> = {
  P0429: [429, 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.'],
  P0002: [404, 'Không tìm thấy bài viết.'],
  P0403: [403, 'Bạn đã bị chặn: không thể bình luận hoặc nhắn tin ở đây.'],
  P0404: [404, 'Không tìm thấy thành viên.'],
  '23505': [409, 'Tên hoặc slug đã tồn tại.'],
  '23514': [400, 'Dữ liệu không hợp lệ.'],
  '42501': [403, 'Bạn không có quyền thực hiện thao tác này.'],
  PGRST116: [404, 'Không tìm thấy.'],
}

export function toApiError(error: SupabaseLikeError): ApiError {
  const known = error.code ? knownErrors[error.code] : undefined
  if (known) return new ApiError(known[0], known[1])
  // 22023 carries a readable validation message from submit_comment.
  if (error.code === '22023') return new ApiError(400, error.message ?? 'Dữ liệu không hợp lệ.')
  return new ApiError(error.status ?? 500, error.message || 'Đã có lỗi xảy ra')
}

/** Unwraps a Supabase response, throwing ApiError on failure. */
export function unwrap<T>(result: { data: T | null; error: SupabaseLikeError | null }): T {
  if (result.error) throw toApiError(result.error)
  return result.data as T
}
