/**
 * Sending email, and the one place a provider is named.
 *
 * **Swap point.** Everything else in `worker/` talks to `send()` and does not
 * know who delivers. Changing provider means rewriting the body of `send` and
 * nothing else: they are all "POST some JSON with an API key" and differ only
 * in the field names and the URL.
 *
 * Resend because it is an HTTP API rather than SMTP, which matters: Workers
 * cannot open a raw socket to port 25, so any provider here has to be one that
 * accepts a POST. Free tier is 3,000 a month and 100 a day, against a tool
 * whose entire mail volume is password resets.
 *
 * ## It is optional, and that is deliberate
 *
 * `RESEND_API_KEY` unset means `configured()` is false, and `worker/auth.ts`
 * then does not offer the flows that would need mail. **Nothing silently
 * pretends to have sent something.** An account system that shows a "check your
 * email" screen while sending nothing is worse than one that says it cannot.
 */

/** Both are set with `wrangler secret put`. Neither has a default. */
type Mail = {
  RESEND_API_KEY?: string
  /** eg "Enodia <noreply@enodia.me>". The domain has to be verified with the provider. */
  MAIL_FROM?: string
}

export const configured = (env: Mail): boolean =>
  Boolean(env.RESEND_API_KEY && env.MAIL_FROM)

export type Letter = {
  to: string
  subject: string
  /** Plain text on purpose. See the note below. */
  text: string
}

/**
 * Send one. Returns whether it went, and never throws.
 *
 * **Plain text, no HTML.** A password reset is four lines and a link. HTML buys
 * nothing here and costs a spam-score penalty, a rendering surface, and the
 * chance of putting a person's own name into markup.
 *
 * A caller that gets `false` should say so rather than claim success. The one
 * caller that matters, better-auth's reset flow, is deliberately not wired up
 * at all when `configured()` is false, so this returning false means the
 * provider broke rather than that it was never there.
 */
export async function send(env: Mail, letter: Letter): Promise<boolean> {
  if (!configured(env)) return false

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [letter.to],
        subject: letter.subject,
        text: letter.text,
      }),
    })
    if (!response.ok) {
      // The body carries the reason, and the reason is nearly always an
      // unverified sending domain. Worth logging, never worth showing.
      console.error('mail refused', response.status, await response.text().catch(() => ''))
      return false
    }
    return true
  } catch (error) {
    console.error('mail failed', error)
    return false
  }
}

/**
 * The reset letter.
 *
 * Written for somebody who is locked out and mildly annoyed, so it says what to
 * do first and explains second. No branding, no images, no "click here".
 */
export const resetLetter = (url: string): Omit<Letter, 'to'> => ({
  subject: 'Reset your Enodia password',
  text: [
    'Somebody asked to reset the password on this Enodia account.',
    '',
    'If it was you, open this and pick a new one:',
    url,
    '',
    'The link works once and expires in an hour.',
    '',
    'If it was not you, ignore this. Nothing has changed and your account is fine.',
    '',
    'Enodia is an unofficial fan project and is not affiliated with Supergiant Games.',
  ].join('\n'),
})
