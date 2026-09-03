/**
 * Makes the `cloudflare:test` module visible to the type checker.
 *
 * **The reference path is load bearing, and it is not the package root.**
 * `@cloudflare/vitest-pool-workers` points its top-level `types` at the pool's
 * config types; the `cloudflare:test` module is declared under the `./types`
 * subpath. Reference the root instead and `SELF`, `env` and
 * `applyD1Migrations` are all undeclared, with an error that reads as though
 * the package were broken.
 *
 * `tsconfig.worker.json` sets `types: []` to keep the DOM and node globals out,
 * which also switches off automatic inclusion, so this reference is the only
 * thing pulling those declarations in.
 *
 * **Deliberately no `declare module` here.** The test binding is narrowed in
 * `test-setup.ts` instead: augmenting `Cloudflare.Env` would put a test-only
 * binding on the type that `worker/index.ts` uses in production.
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />
