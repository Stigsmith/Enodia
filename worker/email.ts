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

type Mail = {
  /** A secret, set with `wrangler secret put RESEND_API_KEY`. No default. */
  RESEND_API_KEY?: string
  /**
   * The From address, `Dora <dora@enodia.me>`.
   *
   * **A `var` in `wrangler.jsonc` rather than a secret**, because it is printed
   * on every letter it sends and is therefore not one. Keeping it in the config
   * means a fresh deploy describes its own sender, and there is one less thing
   * to remember to set. The domain still has to be verified with the provider.
   */
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
 * The reset letter, in Dora's voice.
 *
 * **Workshopped by the owner against her actual lines**, which is the reason it
 * reads the way it does. The transcript is every line of hers in the game,
 * `Content/Game/Text/en/_NPCData_Dora.en.sjson`, 278 of them. An earlier draft
 * written from an impression of her rather than from that file came out dry and
 * clipped, which is a butler. She is warm, casual, American, elided, and she
 * trails off constantly.
 *
 * **She does not scold, and the source is why.** A scolding letter was the
 * brief until her own line turned up: "Why else would I have forgotten
 * everything? Probably took a couple swigs from the River Lethe, and that was
 * that! Clean slate." She forgot her entire life. She has no standing to be
 * smug at anybody about a password, and sympathy from the least organised
 * character in the game is the better joke anyway.
 *
 * **The working half comes first and stays plain.** The person reading this is
 * locked out and irritated, so what happened, the link, and the expiry are the
 * first three things. Everything after them is optional and somebody who stops
 * reading has lost nothing.
 *
 * **The subject line stays boring.** It is what gets typed into a search box at
 * the worst moment, so it says what the letter is and nothing else.
 *
 * **Plain text, no image.** Every major client blocks remote images by default,
 * so a picture of her would be a blocked frame for most people rather than a
 * joke, and this is the one letter that has to clear every filter: it is the
 * only route back into an account.
 */
export const resetLetter = (url: string): Omit<Letter, 'to'> => ({
  subject: 'Reset your Enodia password',
  text: [
    'Hey. Somebody asked to reset the password on this Enodia account.',
    '',
    /* Four words, and they are the difference between a link and a bare link.
     * Somebody who did not ask for this meets the URL before the "wasn't you"
     * line further down, and an unqualified link at the top of an unexpected
     * email is the shape of every phishing message anybody has ever been sent.
     * This says what it is for before they reach it. */
    'If that was you, here:',
    '',
    url,
    '',
    "Link works once. Expires in an hour, so don't sit on it.",
    '',
    "Wasn't you? Then ignore this, nothing's changed. No harm done.",
    '',
    "I forgot my whole life, so, you know. A password's nothing.",
    '',
    'Anyway...',
    '',
    '',
    'Enodia is an unofficial fan project. Not affiliated with Supergiant Games.',
  ].join('\n'),
})
