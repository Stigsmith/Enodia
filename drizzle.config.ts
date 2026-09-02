import { defineConfig } from 'drizzle-kit'

/**
 * Turns `worker/schema.ts` into SQL in `migrations/`.
 *
 *   npm run db:generate     schema -> a numbered .sql file
 *   npm run db:migrate      apply them to the local D1
 *
 * `dialect: 'sqlite'` and no `dbCredentials` on purpose. D1 is SQLite, and
 * generating a migration only needs the schema file, not a database: drizzle-kit
 * diffs against its own journal in `migrations/meta/`. Applying is wrangler's
 * job, because only wrangler can reach a D1 binding.
 *
 * The schema itself is generated too, by `npm run db:schema`, and is not hand
 * written. Use the CLI that matches the installed better-auth: `npx auth@latest`
 * and NOT the deprecated `@better-auth/cli`, which is pinned three minors behind
 * and emits an `account` table with no `issuer` column. That column is NOT NULL,
 * so the mismatch does not surface until the first sign-up fails.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/schema.ts',
  out: './migrations',
})
