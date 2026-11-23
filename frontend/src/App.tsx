import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { Spinner } from './components/Status'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Markdown rendering and admin screens are loaded on demand so the home page stays light.
const PostPage = lazy(() => import('./pages/PostPage').then((m) => ({ default: m.PostPage })))
const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const CommentsPage = lazy(() =>
  import('./pages/admin/CommentsPage').then((m) => ({ default: m.CommentsPage })),
)
const LoginPage = lazy(() =>
  import('./pages/admin/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const PostEditorPage = lazy(() =>
  import('./pages/admin/PostEditorPage').then((m) => ({ default: m.PostEditorPage })),
)
const PostsPage = lazy(() =>
  import('./pages/admin/PostsPage').then((m) => ({ default: m.PostsPage })),
)
const TermsPage = lazy(() =>
  import('./pages/admin/TermsPage').then((m) => ({ default: m.TermsPage })),
)

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="category/:slug" element={<HomePage mode="category" />} />
          <Route path="tag/:slug" element={<HomePage mode="tag" />} />
          <Route path="search" element={<HomePage mode="search" />} />
          <Route path="posts/:slug" element={<PostPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="admin/login" element={<LoginPage />} />
        <Route
          path="admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="posts" replace />} />
          <Route path="posts" element={<PostsPage />} />
          <Route path="posts/new" element={<PostEditorPage />} />
          <Route path="posts/:id/edit" element={<PostEditorPage />} />
          <Route path="categories" element={<TermsPage key="categories" kind="categories" />} />
          <Route path="tags" element={<TermsPage key="tags" kind="tags" />} />
          <Route path="comments" element={<CommentsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
