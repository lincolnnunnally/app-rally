/**
 * Transactional email for THIS app (Better Auth password reset).
 * Uses the existing ecosystem Resend account when RESEND_API_KEY is set.
 * Fail loud: callers get { sent: false, error } — never claim an email went out.
 */

const FROM =
  process.env.RESEND_FROM?.trim() ||
  "United Under God <no-reply@emails.unitedundergod.org>";
const REPLY_TO =
  process.env.RESEND_REPLY_TO?.trim() || "lincoln@unitedundergod.org";

export function resetEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error: string | null }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return {
      sent: false,
      error: "RESEND_API_KEY is not set on this deployment.",
    };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        reply_to: REPLY_TO,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        sent: false,
        error: `Resend ${res.status}: ${body.slice(0, 240)}`,
      };
    }
    return { sent: true, error: null };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}
