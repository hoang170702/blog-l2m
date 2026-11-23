import { Link } from 'react-router'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Không tìm thấy')
  return (
    <div className="py-20 text-center">
      <h1 className="text-gradient text-7xl font-extrabold">404</h1>
      <p className="mt-4 text-lg text-muted">Trang bạn tìm không tồn tại.</p>
      <Link to="/" className="btn-primary mt-8">
        Về trang chủ
      </Link>
    </div>
  )
}
