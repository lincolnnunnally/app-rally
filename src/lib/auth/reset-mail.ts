import { resetEmailConfigured, sendTransactionalEmail } from "@/lib/mail";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

/**
 * Better Auth calls this only when the email exists. Never throw — a throw
 * would 500 existing users and enumerate accounts against the 200 for missing
 * emails. Log loud so Lincoln can finish a reset if Resend is missing.
 */
export async function sendRallyResetMail(opts: {
  email: string;
  name?: string;
  url: string;
}): Promise<void> {
  const emailed = await sendTransactionalEmail({
    to: opts.email,
    subject: "Reset your Rally password",
    html: `<!doctype html><html><body style="margin:0;background:#0c0e0d;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8ebe6">
<div style="max-width:480px;margin:0 auto;background:#141716;border-radius:14px;padding:32px;border:1px solid #2a302c">
<h1 style="font-size:20px;margin:0 0 8px;color:#e8ebe6">Reset your Rally password</h1>
<p style="color:#a8b0aa;font-size:15px;line-height:1.6;margin:0 0 20px">Hi ${esc(opts.name || "there")}, we received a request to reset the password for this Rally account. This link expires in one hour.</p>
<a href="${esc(opts.url)}" style="display:inline-block;background:#c5e86a;color:#0c0e0d;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Set a new password</a>
<p style="color:#7a847e;font-size:13px;line-height:1.6;margin:22px 0 0">If you didn't request this, ignore this email — your password will not change. Rally is a United Under God tennis and pickleball board. Questions: lincoln@unitedundergod.org</p>
</div></body></html>`,
  });

  if (!emailed.sent) {
    console.error("[reset-mail] password reset email not sent", emailed.error);
    if (!resetEmailConfigured()) {
      console.error("[reset-mail] RESEND_API_KEY is not on the Rally deployment.");
    }
    console.error("[reset-mail] owner fallback link for", opts.email, opts.url);
  }
}
