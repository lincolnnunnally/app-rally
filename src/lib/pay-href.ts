/**
 * ChurchConnect Give `type: "link"` class — handles to Cash App / Venmo hrefs.
 * No Stripe, no OAuth, no in-app checkout.
 */

export function cleanCashAppHandle(raw: string): string {
  let h = (raw || "").trim();
  h = h.replace(/^https?:\/\/(www\.)?cash\.app\/\$?/i, "");
  h = h.split("/")[0]?.split("?")[0] ?? "";
  h = h.replace(/^\$/, "");
  return h.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
}

export function cleanVenmoHandle(raw: string): string {
  let h = (raw || "").trim();
  h = h.replace(/^https?:\/\/(www\.)?venmo\.com\//i, "");
  h = h.split("/")[0]?.split("?")[0] ?? "";
  h = h.replace(/^@/, "");
  return h.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30);
}

export function cashAppDisplay(handle: string): string {
  const tag = cleanCashAppHandle(handle);
  return tag ? `$${tag}` : "";
}

export function venmoDisplay(handle: string): string {
  const tag = cleanVenmoHandle(handle);
  return tag ? `@${tag}` : "";
}

export function payAmount(raw?: string | number | null): string {
  if (raw == null || raw === "") return "";
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,]/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return "";
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/** Cash App web / deep link. Optional amount is a path segment when set. */
export function cashAppHref(handle: string, amount?: string | number | null): string | null {
  const tag = cleanCashAppHandle(handle);
  if (!tag) return null;
  const cashtag = `$${tag}`;
  const amt = payAmount(amount);
  return amt ? `https://cash.app/${cashtag}/${amt}` : `https://cash.app/${cashtag}`;
}

export function venmoWebHref(handle: string): string | null {
  const tag = cleanVenmoHandle(handle);
  return tag ? `https://venmo.com/${tag}` : null;
}

/** Venmo app deep link. QR and cameras should use `venmoWebHref`. */
export function venmoDeepHref(
  handle: string,
  opts?: { amount?: string | number | null; note?: string | null },
): string | null {
  const tag = cleanVenmoHandle(handle);
  if (!tag) return null;
  const params = new URLSearchParams({ txn: "pay", recipients: tag });
  const amt = payAmount(opts?.amount);
  if (amt) params.set("amount", amt);
  const note = (opts?.note ?? "").trim();
  if (note) params.set("note", note);
  return `venmo://paycharge?${params.toString()}`;
}

/** Same renderer CoachInvite already uses. */
export function rallyQrSrc(data: string, size = 480): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&ecc=M&data=${encodeURIComponent(data)}`;
}
