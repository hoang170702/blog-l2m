import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// The Prisma CLI (migrations) connects through DIRECT_URL. On Supabase this is
// the session pooler; the app itself uses DATABASE_URL (transaction pooler).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
