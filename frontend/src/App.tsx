import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Outlet, useRoutes, type RouteObject } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { Spinner } from './components/Status'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Markdown rendering and the signed-in area are loaded on demand so the home page stays light.
const PostPage = lazy(() => import('./pages/PostPage').then((m) => ({ default: m.PostPage })))
const AuthCallbackPage = lazy(() =>
  import('./pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })),
)
const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const CommentsPage = lazy(() =>
  import('./pages/admin/CommentsPage').then((m) => ({ default: m.CommentsPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })),
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

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>
}

const page = (node: ReactNode) => <Lazy>{node}</Lazy>

/**
 * Reading is public; writing needs any signed-in account (/write, /dashboard);
 * categories and tags management is admin-only.
 */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'category/:slug', element: <HomePage mode="category" /> },
      { path: 'tag/:slug', element: <HomePage mode="tag" /> },
      { path: 'search', element: <HomePage mode="search" /> },
      { path: 'posts/:slug', element: page(<PostPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: 'login', element: page(<LoginPage />) },
  { path: 'auth/callback', element: page(<AuthCallbackPage />) },
  {
    element: <RequireAuth>{page(<AdminLayout />)}</RequireAuth>,
    children: [
      { path: 'write', element: page(<PostEditorPage />) },
      { path: 'write/:id', element: page(<PostEditorPage />) },
      {
        path: 'dashboard',
        element: <Outlet />,
        children: [
          { index: true, element: page(<DashboardPage />) },
          { path: 'posts', element: page(<PostsPage />) },
          { path: 'comments', element: page(<CommentsPage />) },
          {
            element: (
              <RequireAuth admin>
                <Outlet />
              </RequireAuth>
            ),
            children: [
              {
                path: 'categories',
                element: page(<TermsPage key="categories" kind="categories" />),
              },
              { path: 'tags', element: page(<TermsPage key="tags" kind="tags" />) },
            ],
          },
        ],
      },
    ],
  },
  // Old admin links keep working.
  { path: 'admin/login', element: <Navigate to="/login" replace /> },
  { path: 'admin/*', element: <Navigate to="/dashboard" replace /> },
]

/** Route tree for a surrounding router (tests use MemoryRouter; the app uses a data router). */
export function App() {
  return useRoutes(routes)
}
