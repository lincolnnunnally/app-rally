/**
 * Email copies of lesson confirm, reschedule, and cancel.
 * Uses the existing Resend helper. A failed send never throws.
 */

import { sendTransactionalEmail } from "@/lib/mail";

export type LessonMailKind = "confirm" | "reschedule" | "cancel";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[ch] ?? ch;
  });
}

export function lessonMail(opts: { kind: LessonMailKind; whenLabel: string; detail: string }): {
  subject: string;
  html: string;
} {
  const subject =
    opts.kind === "confirm"
      ? "Lesson confirmed"
      : opts.kind === "reschedule"
        ? "Lesson rescheduled"
        : "Lesson canceled";
  const html = `<!doctype html><html><body style="margin:0;background:#0c0e0d;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8ebe6">
<div style="max-width:480px;margin:0 auto;background:#141716;border-radius:14px;padding:32px;border:1px solid #2a302c">
<h1 style="font-size:20px;margin:0 0 8px;color:#e8ebe6">${esc(subject)}</h1>
<p style="color:#e8ebe6;font-size:15px;line-height:1.6;margin:0 0 8px">${esc(opts.whenLabel)}</p>
<p style="color:#a8b0aa;font-size:15px;line-height:1.6;margin:0">${esc(opts.detail)}</p>
<p style="color:#7a847e;font-size:13px;line-height:1.6;margin:22px 0 0">This is a copy of the notice on your Rally board. Rally is a United Under God tennis and pickleball board.</p>
</div></body></html>`;
  return { subject, html };
}

/** Never throws. Scheduling still succeeds when Resend is down or the address is missing. */
export async function sendLessonCopy(opts: {
  to: string | null | undefined;
  kind: LessonMailKind;
  whenLabel: string;
  detail: string;
}): Promise<void> {
  try {
    const to = (opts.to ?? "").trim();
    if (!to.includes("@")) return;
    const mail = lessonMail(opts);
    const sent = await sendTransactionalEmail({ to, subject: mail.subject, html: mail.html });
    if (!sent.sent) console.error("[lesson-mail]", sent.error);
  } catch (err) {
    console.error("[lesson-mail]", err instanceof Error ? err.message : "email failed");
  }
}
