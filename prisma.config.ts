import { config as loadEnv } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// Next.js loads .env.local automatically, but the Prisma CLI does not — load it here.
loadEnv({ path: '.env.local' })
loadEnv() // fall back to .env if present

// Prisma 7 moved the datasource connection URL out of schema.prisma.
// This config is used by the Prisma CLI (migrate, db push, introspect, generate).
// The runtime PrismaClient uses a driver adapter — see src/lib/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
