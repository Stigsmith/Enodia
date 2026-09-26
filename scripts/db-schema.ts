/**
 * Generate `worker/schema.ts` from better-auth's own options.
 *
 *   npm run db:schema
 *
 * Runs the `auth` CLI **at the version of better-auth that is installed**,
 * never `@latest`. That is the whole reason this is a script and not a one
 * line npm script.
 *
 * The CLI generates from the `@better-auth/core` bundled with it, not the one
 * in `node_modules`, so a CLI at any other version describes a different
 * library. On 25 September 2026 `auth@latest` was 1.7.6 and the installed
 * better-auth 1.7.2. 1.7.6 emits an `account` table with no `issuer` column
 * and no `account_issuer_accountId_uidx`; 1.7.2 declares that column
 * `NOT NULL` and writes it on every sign-up (`createLocalAccountIssuer` in
 * better-auth's `sign-up` route). Nothing would have failed until the first
 * person made an account. The deprecated `@better-auth/cli` failed the same
 * way from the other side, by lagging behind.
 *
 * Measured on 26 September 2026: `auth@1.7.2` reproduces the committed
 * `worker/schema.ts` byte for byte, and `auth@1.7.6` drops the column.
 * Found while porting this backend to D.D.S., which carries the same fix.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const installed = (
  JSON.parse(readFileSync(join(ROOT, 'node_modules', 'better-auth', 'package.json'), 'utf8')) as {
    version: string
  }
).version

console.log(`better-auth ${installed} is installed, so running auth@${installed}`)
// One string rather than an argument list: `npx` is a .cmd on Windows and
// needs a shell, and node warns about an argument list handed to one.
execSync(
  `npx --yes auth@${installed} generate --config worker/auth.config.ts --output worker/schema.ts -y`,
  { cwd: ROOT, stdio: 'inherit' },
)
