# Blog API

NestJS + Prisma (PostgreSQL) + Redis.

```bash
cp ../.env.example .env        # then adjust values
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build && npm run seed  # creates the admin account (SEED_SAMPLE_DATA=true adds a sample post)
npm run start:dev
```

| Script | Purpose |
| --- | --- |
| `npm run lint` | oxlint + Prettier check |
| `npm run typecheck` | TypeScript without emitting |
| `npm test` | Unit tests |
| `npm run test:e2e` | API tests against local PostgreSQL + Redis |
| `npm run build` / `npm run start:prod` | Production build and start |

See `AGENTS.md` for conventions and the API contract in `../docs/api.md`.
