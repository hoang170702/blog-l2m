# AGENTS.md — backend

NestJS 12 API for the blog. Read the root README for the overall architecture.

## Conventions

- ESM only: relative imports end in `.js`, use `import.meta.dirname` instead of `__dirname`.
- Tests run on Vitest (`vi.fn()`, not `jest.fn()`): unit tests sit beside the code as `*.spec.ts`; e2e tests live in `test/` and need a local PostgreSQL + Redis (they truncate every table and refuse non-local database hosts).
- Lint is oxlint plus Prettier (`npm run lint`).
- Validation uses `class-validator` DTOs with the global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`).
- Admin routes use `AdminGuard`; public routes need no guard. Rate limits come from `@nestjs/throttler` backed by Redis.

## Prisma 7

- Schema: `prisma/schema.prisma`; generated client: `src/generated/prisma` (git-ignored, run `npx prisma generate`).
- Connection URLs are not in the schema: the CLI reads `DIRECT_URL` from `prisma.config.ts`; the app connects through `@prisma/adapter-pg` with `DATABASE_URL`. On Supabase, `DATABASE_URL` is the transaction pooler and `DIRECT_URL` the session pooler.
- Create migrations with `npx prisma migrate dev --name <name>`; deployments run `npx prisma migrate deploy`. Never run migrations on app start.

## npm

`npm ci` works with any npm. Adding or updating dependencies needs npm 11 (`npx npm@11 install <pkg>`): npm 10.9 fails with `Cannot read properties of null (reading 'edgesOut')`. npm 11 only runs install scripts listed in `allowScripts` in `package.json`.
