import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './App'
import { AuthProvider } from './auth/AuthContext'
import { applyPrefs, getPrefs } from './lib/readingPrefs'
import { applyTheme, getTheme } from './lib/theme'
import './index.css'

// Before the first paint, so the page does not flash light or in the default font.
applyTheme(getTheme())
applyPrefs(getPrefs())

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

// A data router is required for the editor's unsaved-changes guard (useBlocker).
// BASE_URL is Vite's `base` ("/" locally, "/<repository>/" on GitHub Pages).
const router = createBrowserRouter(routes, {
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
