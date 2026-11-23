# Blog frontend

Vite + React + TypeScript single-page app. Public pages: post list, category/tag/search filters, post detail with Markdown and moderated comments. Admin (`/admin`): login, posts with Markdown editor and image upload, categories, tags, comment moderation.

```bash
npm ci
npm run dev        # http://localhost:5173, proxies /api and /uploads to http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm run lint` | oxlint + Prettier check |
| `npm test` | Vitest + Testing Library + MSW |
| `npm run build` | Type-check and production build to `dist/` |

The production image (`Dockerfile`) serves `dist/` with Nginx (`nginx/default.conf`), proxies `/api/` to the `backend` container and serves uploaded files from `/usr/share/nginx/uploads`. It listens on plain HTTP; TLS is terminated by the edge proxy.

Build uses TypeScript 7 (native binary), which needs a glibc image (`node:22-slim`), not Alpine.
