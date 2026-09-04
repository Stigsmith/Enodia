import { join } from 'node:path'

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

/**
 * The backend's tests, and a separate project on purpose.
 *
 * `vite.config.ts` runs `src/` and `scripts/` under node and jsdom. None of
 * that can host a Worker: there is no D1 binding, no `cf-connecting-ip`, and no
 * workerd. This config runs `worker/` **inside workerd itself**, against a real
 * local D1, which is the only place the things worth testing are true.
 *
 * That matters more than it sounds. Every bug found in this backend by hand was
 * invisible to a type check and to a green build:
 *
 * - rate limiting silently off, because better-auth defaults it to
 *   `NODE_ENV === 'production'` and Workers sets no `NODE_ENV`
 * - the client IP read from a header a caller can supply
 * - a generated schema missing a `NOT NULL` column, which fails only on insert
 *
 * None of those are catchable in node. All of them are catchable here.
 *
 *   npm run test:worker      just these
 *   npm test                 these and the other 420
 *
 * **Note for whoever upgrades this.** `@cloudflare/vitest-pool-workers` 0.22
 * dropped `defineWorkersConfig` and the `./config` subpath: it is a Vite plugin
 * now, and `singleWorker` and `isolatedStorage` are gone from the schema. The
 * package ships a codemod at `./codemods/vitest-v3-to-v4` for the older shape.
 */
export default defineConfig(async () => {
  /**
   * The real migration files, applied to the test database by `test-setup.ts`.
   *
   * Read from `migrations/` rather than restated here, so a schema change that
   * was never migrated fails these tests instead of passing them against a
   * schema that only ever existed in a fixture.
   */
  const migrations = await readD1Migrations(join(import.meta.dirname, 'migrations'))

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          /**
           * **Pinned, and not the same date as production.**
           *
           * `wrangler.jsonc` says 2026-09-02. The workerd binary this test pool
           * ships refuses anything past 2026-08-22 and fails to start rather
           * than warning, so the choice is to pin here or to lower production
           * to match a test runner, which is backwards.
           *
           * Safe because the only dated behaviour this project relies on is
           * `assets_navigation_prefers_asset_serving`, which needs 2025-04-01
           * or later. Both dates clear it by well over a year.
           *
           * Raise this when the pool ships a newer runtime. If a test ever
           * disagrees with production, this eleven day gap is the first thing
           * to suspect.
           */
          compatibilityDate: '2026-08-22',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            /** Handed to `applyD1Migrations` in the setup file. */
            TEST_MIGRATIONS: migrations,
            /**
             * Fixed, because these tests assert on behaviour rather than on
             * opacity. It never leaves the test runner and is not a secret.
             */
            BETTER_AUTH_SECRET: 'test-secret-not-used-anywhere-else-000000',
            /**
             * **Stated, not inherited.** Without this the tests read whatever
             * `.dev.vars` happens to hold, which is gitignored and which a
             * developer sets to their own account id to try the curator path in
             * a browser. A suite that passes or fails on the contents of an
             * untracked file is not a suite.
             *
             * Empty, because that is the state every deployment except this one
             * is in and the one worth pinning: nobody can curate. The admitting
             * half is covered by calling `pick` directly, since this binding is
             * fixed before any account exists and account ids are not.
             */
            CURATOR_USER_ID: '',
          },
        },
      }),
    ],
    test: {
      include: ['worker/**/*.test.ts'],
      setupFiles: ['./worker/test-setup.ts'],
    },
  }
})
