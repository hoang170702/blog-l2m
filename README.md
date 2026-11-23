# Blog

A blog built as a monorepo:

- `frontend/` — Vite + React + TypeScript single-page app, served by Nginx
- `backend/` — NestJS + Prisma REST API
- `deploy/` — production Docker Compose file and deploy scripts
- PostgreSQL (local container in development, Supabase in production) and Redis

Setup, development, and deployment instructions are added as the project takes shape.

## Secret scanning

Install the pre-commit hook once per clone so secrets are blocked before they are committed:

```bash
pipx install pre-commit
pre-commit install
```
