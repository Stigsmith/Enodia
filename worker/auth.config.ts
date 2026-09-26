/**
 * FOR THE BETTER AUTH CLI ONLY. Nothing at runtime imports this.
 *
 * `npm run db:schema` runs `auth generate`, which has to load the auth options
 * to know what tables to emit, and it cannot: a D1 binding only exists inside a
 * request, so there is nothing to hand `createAuth` outside one. The CLI never queries,
 * only reads the options, so a stand-in satisfies it.
 *
 * Importing the real `createAuth` rather than restating the options is the
 * point. A second copy of the config would drift, and the schema would then be
 * generated from options the Worker does not use.
 */
import { createAuth } from './auth.ts'

export const auth = createAuth({} as never, 'cli-only-never-used', 'http://localhost')
