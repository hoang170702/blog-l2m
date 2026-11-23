import { Link } from 'react-router'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Không tìm thấy')
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-2 text-slate-600">Trang bạn tìm không tồn tại.</p>
      <Link to="/" className="mt-4 inline-block text-indigo-600 hover:underline">
        Về trang chủ
      </Link>
    </div>
  )
}
