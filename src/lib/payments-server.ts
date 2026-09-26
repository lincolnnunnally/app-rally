/**
 * Stripe Connect on the existing lesson, court, and league flows.
 * Players pay the posted price. Rally's platform fee is an application fee
 * on a destination charge — it comes out of the coach / organizer / court
 * owner side, not as an extra charge on the player.
 *
 * Keys absent → callers throw "Payments coming soon" and the UI hides buttons.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withTransaction, type Sql } from "@/lib/db";

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}
import {
  monthKey,
  platformFeeCents,
  readPlatformFeeConfig,
  type FeeSource,
  type PlatformFeeConfig,
} from "@/lib/platform-fee";
import {
  addLessonPlatformFee,
  prepareLessonFeeMonth,
  releaseExpiredLessonFees,
  subtractLessonPlatformFee,
} from "@/lib/platform-fee-reserve";

const CHECKOUT_TTL_MS = 35 * 60 * 1000;
const OWNER_DEFAULT = ["lincoln@unitedundergod.org"];
const sourceZ = z.enum(["lesson", "court", "league"]);

type StripeClient = import("stripe").Stripe;
type CheckoutSession = import("stripe").Stripe.Checkout.Session;
type StripeAccount = import("stripe").Stripe.Account;
type StripeCharge = import("stripe").Stripe.Charge;

let stripeSingleton: StripeClient | null = null;

export function paymentsConfigured(): boolean {
  return Boolean(env("STRIPE_SECRET_KEY") && env("STRIPE_WEBHOOK_SECRET"));
}

function num(v: unknown) {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function bool(v: unknown) {
  return v === true || v === "t" || v === "true";
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}

async function stripeClient(): Promise<StripeClient | null> {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) return null;
  if (!stripeSingleton) {
    const { default: Stripe } = await import("stripe");
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

function publicOrigin(): string {
  const request = getRequest();
  if (!request) return "https://rally.unitedundergod.org";
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) return `${forwardedProto || "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

function accountIsReady(row: {
  transfers_active?: unknown;
  charges_enabled?: unknown;
  payouts_enabled?: unknown;
} | undefined) {
  if (!row) return false;
  return bool(row.transfers_active) || (bool(row.charges_enabled) && bool(row.payouts_enabled));
}

export async function payeeCanReceive(sql: Sql, userId: string | null): Promise<boolean> {
  if (!userId || !paymentsConfigured()) return false;
  const rows = await sql`
    select transfers_active, charges_enabled, payouts_enabled
    from connect_accounts where user_id = ${userId} limit 1
  `;
  return accountIsReady(rows[0]);
}

async function writeAccount(sql: Sql, account: StripeAccount) {
  const transfers = account.capabilities?.transfers === "active";
  await sql`
    update connect_accounts
    set charges_enabled = ${Boolean(account.charges_enabled)},
        payouts_enabled = ${Boolean(account.payouts_enabled)},
        details_submitted = ${Boolean(account.details_submitted)},
        transfers_active = ${transfers},
        updated_at = now()
    where stripe_account_id = ${account.id}
  `;
}

async function syncConnectAccount(userId: string) {
  if (!paymentsConfigured()) return;
  const sql = await getSql();
  const rows = await sql`select stripe_account_id from connect_accounts where user_id = ${userId} limit 1`;
  const id = rows[0]?.stripe_account_id ? String(rows[0].stripe_account_id) : null;
  if (!id) return;
  const stripe = await stripeClient();
  if (!stripe) return;
  const account = await stripe.accounts.retrieve(id);
  await writeAccount(sql, account);
}

async function ensureConnectAccount(userId: string): Promise<string> {
  const stripe = await stripeClient();
  if (!stripe || !paymentsConfigured()) throw new Error("Payments coming soon");
  return withTransaction(async (sql) => {
    await sql`select pg_advisory_xact_lock(hashtext(${`connect:${userId}`}))`;
    const existing = await sql`select stripe_account_id from connect_accounts where user_id = ${userId} limit 1`;
    if (existing[0]?.stripe_account_id) return String(existing[0].stripe_account_id);
    let email: string | undefined;
    try {
      const emailRows = await sql`select email from "user" where id = ${userId} limit 1`;
      if (emailRows[0]?.email) email = String(emailRows[0].email);
    } catch {
      email = undefined;
    }
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { rally_user_id: userId },
    });
    await sql`
      insert into connect_accounts (user_id, stripe_account_id)
      values (${userId}, ${account.id})
    `;
    return account.id;
  });
}

type CheckoutTarget = {
  payerUserId: string;
  payeeUserId: string;
  grossCents: number;
  description: string;
};

async function checkoutTarget(sql: Sql, userId: string, source: FeeSource, relatedId: number): Promise<CheckoutTarget> {
  if (source === "lesson") {
    const rows = await sql`
      select l.player_user_id, l.coach_user_id, l.price_cents, l.status, l.sport,
             coalesce(sv.name, '') as service_name
      from lessons l
      left join coach_services sv on sv.id = l.service_id
      where l.id = ${relatedId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("Lesson not found.");
    if (String(row.player_user_id) !== userId) throw new Error("Only the player pays for this lesson.");
    if (row.status === "cancelled" || row.status === "declined") throw new Error("This lesson is not payable.");
    const gross = num(row.price_cents);
    if (gross <= 0) throw new Error("This lesson has no price.");
    const name = String(row.service_name || "").trim() || `${row.sport} lesson`;
    return {
      payerUserId: userId,
      payeeUserId: String(row.coach_user_id),
      grossCents: gross,
      description: name.slice(0, 120),
    };
  }
  if (source === "court") {
    const rows = await sql`
      select r.user_id, r.fee_cents, r.status, c.added_by, c.name
      from reservations r
      join courts c on c.id = r.court_id
      where r.id = ${relatedId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("Reservation not found.");
    if (String(row.user_id) !== userId) throw new Error("Only the player who reserved can pay.");
    if (row.status === "cancelled") throw new Error("That reservation was released.");
    const gross = num(row.fee_cents);
    if (gross <= 0) throw new Error("This court has no fee.");
    if (!row.added_by) throw new Error("This facility has no payout account.");
    return {
      payerUserId: userId,
      payeeUserId: String(row.added_by),
      grossCents: gross,
      description: `${String(row.name)} court time`.slice(0, 120),
    };
  }
  const rows = await sql`
    select owner_user_id, name, reg_fee_cents from leagues where id = ${relatedId} limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("League not found.");
  if (!row.owner_user_id) throw new Error("This league has no organizer.");
  if (String(row.owner_user_id) === userId) throw new Error("You organize this league.");
  const member = await sql`
    select 1 as n from league_members where league_id = ${relatedId} and user_id = ${userId} limit 1
  `;
  if (member[0]) throw new Error("You are already on this roster.");
  const paid = await sql`
    select id from payments
    where source = 'league' and related_id = ${relatedId} and payer_user_id = ${userId} and status = 'paid'
    limit 1
  `;
  if (paid[0]) throw new Error("This entry fee is already paid.");
  const gross = num(row.reg_fee_cents);
  if (gross <= 0) throw new Error("This league has no entry fee.");
  return {
    payerUserId: userId,
    payeeUserId: String(row.owner_user_id),
    grossCents: gross,
    description: `${String(row.name)} entry fee`.slice(0, 120),
  };
}

type PendingRow = {
  id: number | string;
  gross_cents: number | string;
  platform_fee_cents: number | string;
  stripe_checkout_session_id: string | null;
  expires_at: string | Date | null;
  fee_reserved: unknown;
  month_key: string | null;
  payee_user_id: string;
  source: string;
  status: string;
  payer_user_id: string;
  related_id: number | string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  platform_fee_refunded_cents: number | string;
};

async function lockPending(sql: Sql, source: FeeSource, relatedId: number, payer: string) {
  const rows = await sql<PendingRow>`
    select id, gross_cents, platform_fee_cents, stripe_checkout_session_id, expires_at,
           fee_reserved, month_key, payee_user_id, source, status, payer_user_id, related_id,
           stripe_payment_intent_id, stripe_charge_id, platform_fee_refunded_cents
    from payments
    where source = ${source} and related_id = ${relatedId} and payer_user_id = ${payer}
      and status = 'pending'
    for update
  `;
  return rows[0] ?? null;
}

async function expirePayment(sql: Sql, paymentId: number) {
  const peek = await sql<PendingRow>`
    select id, source, payee_user_id, month_key, fee_reserved, status
    from payments where id = ${paymentId}
  `;
  const preview = peek[0];
  if (!preview || preview.status !== "pending") return;
  // Month row first, then the payment row. reservePayment takes the locks in
  // that order; reversing it deadlocks a checkout against an expire.
  if (bool(preview.fee_reserved) && preview.source === "lesson" && preview.month_key) {
    await prepareLessonFeeMonth(sql, preview.payee_user_id, preview.month_key);
  }
  const rows = await sql<PendingRow>`
    select id, source, payee_user_id, platform_fee_cents, month_key, fee_reserved, status,
           gross_cents, stripe_checkout_session_id, expires_at, payer_user_id, related_id,
           stripe_payment_intent_id, stripe_charge_id, platform_fee_refunded_cents
    from payments where id = ${paymentId} for update
  `;
  const row = rows[0];
  if (!row || row.status !== "pending") return;
  if (bool(row.fee_reserved) && row.source === "lesson" && row.month_key) {
    await subtractLessonPlatformFee(sql, {
      payeeUserId: row.payee_user_id,
      monthKey: row.month_key,
      cents: num(row.platform_fee_cents),
    });
  }
  await sql`
    update payments set status = 'expired', fee_reserved = false
    where id = ${paymentId} and status = 'pending'
  `;
}

async function reservePayment(
  sql: Sql,
  input: CheckoutTarget & { source: FeeSource; relatedId: number; accountId: string; config: PlatformFeeConfig; month: string },
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHECKOUT_TTL_MS).toISOString();
  if (input.source === "lesson") {
    await prepareLessonFeeMonth(sql, input.payeeUserId, input.month);
    await releaseExpiredLessonFees(sql, input.payeeUserId, now.toISOString());
  }
  const existing = await lockPending(sql, input.source, input.relatedId, input.payerUserId);
  if (existing) {
    const exp = existing.expires_at ? new Date(existing.expires_at).getTime() : 0;
    const alive = exp > now.getTime();
    const same = num(existing.gross_cents) === input.grossCents;
    if (alive && same) {
      return {
        paymentId: num(existing.id),
        feeCents: num(existing.platform_fee_cents),
        sessionId: existing.stripe_checkout_session_id,
        expiresAt: new Date(exp).toISOString(),
      };
    }
    await expirePayment(sql, num(existing.id));
  }
  const fee =
    input.source === "lesson"
      ? await addLessonPlatformFee(sql, {
          payeeUserId: input.payeeUserId,
          monthKey: input.month,
          grossCents: input.grossCents,
          config: input.config,
        })
      : platformFeeCents({
          source: input.source,
          grossCents: input.grossCents,
          recordedLessonFeesCents: 0,
          config: input.config,
        }).feeCents;
  const inserted = await sql<{ id: number | string }>`
    insert into payments (
      source, related_id, payer_user_id, payee_user_id, gross_cents, platform_fee_cents,
      month_key, fee_reserved, status, stripe_account_id, expires_at
    ) values (
      ${input.source}, ${input.relatedId}, ${input.payerUserId}, ${input.payeeUserId},
      ${input.grossCents}, ${fee},
      ${input.source === "lesson" ? input.month : null},
      ${input.source === "lesson"},
      'pending', ${input.accountId}, ${expiresAt}::timestamptz
    )
    returning id
  `;
  return {
    paymentId: num(inserted[0]?.id),
    feeCents: fee,
    sessionId: null as string | null,
    expiresAt,
  };
}

async function recordPaid(sql: Sql, payment: PendingRow) {
  const source = payment.source;
  const related = num(payment.related_id);
  const fee = num(payment.platform_fee_cents);
  const payer = payment.payer_user_id;
  const gross = num(payment.gross_cents);
  if (fee > 0) {
    await sql`
      insert into platform_ledger (kind, amount_cents, source_user_id, related_id, note)
      values (${`stripe_${source}`}, ${fee}, ${payer}, ${related}, ${`Stripe platform fee · ${source}`})
    `;
  }
  if (source === "lesson") {
    await sql`update lessons set rally_take_cents = ${fee} where id = ${related}`;
    await sql`delete from coach_ledger where lesson_id = ${related} and category = 'rally_take'`;
    if (fee > 0) {
      await sql`
        insert into coach_ledger (coach_user_id, kind, category, amount_cents, note, lesson_id)
        values (${payment.payee_user_id}, 'expense', 'rally_fee', ${fee}, 'Rally platform fee', ${related})
      `;
    }
  } else if (source === "court") {
    const mode = await sql`
      select c.booking_mode from reservations r
      join courts c on c.id = r.court_id
      where r.id = ${related}
      limit 1
    `;
    const next = String(mode[0]?.booking_mode ?? "") === "call" ? "pending" : "confirmed";
    await sql`
      update reservations
      set status = case when status = 'pending_payment' then ${next} else status end,
          rally_take_cents = ${fee}
      where id = ${related}
    `;
  } else if (source === "league") {
    await sql`
      insert into league_members (league_id, user_id, fee_cents, rally_take_cents)
      values (${related}, ${payer}, ${gross}, ${fee})
      on conflict (league_id, user_id) do update
      set fee_cents = excluded.fee_cents,
          rally_take_cents = excluded.rally_take_cents
    `;
  }
}

async function applyCheckoutSession(session: CheckoutSession) {
  if (session.payment_status !== "paid") return;
  const stripe = await stripeClient();
  const piField = session.payment_intent;
  const piId = typeof piField === "string" ? piField : piField?.id ?? null;
  let chargeId: string | null = null;
  if (stripe && piId) {
    const pi = await stripe.paymentIntents.retrieve(piId);
    const latest = pi.latest_charge;
    chargeId = typeof latest === "string" ? latest : latest?.id ?? null;
  }
  await withTransaction(async (sql) => {
    const paymentId = session.metadata?.payment_id ? num(session.metadata.payment_id) : 0;
    const peek = await sql<PendingRow>`
      select id, source, payee_user_id, month_key, status
      from payments
      where stripe_checkout_session_id = ${session.id}
         or (${paymentId} > 0 and id = ${paymentId})
      limit 1
    `;
    const preview = peek[0];
    if (preview?.source === "lesson" && preview.month_key && preview.payee_user_id) {
      await prepareLessonFeeMonth(sql, preview.payee_user_id, preview.month_key);
    }
    const rows = await sql<PendingRow>`
      select id, gross_cents, platform_fee_cents, stripe_checkout_session_id, expires_at,
             fee_reserved, month_key, payee_user_id, source, status, payer_user_id, related_id,
             stripe_payment_intent_id, stripe_charge_id, platform_fee_refunded_cents
      from payments
      where id = ${preview ? num(preview.id) : 0}
      for update
    `;
    const payment = rows[0];
    if (!payment) return;
    if (payment.status === "paid" || payment.status === "refunded") {
      if (chargeId || piId) {
        await sql`
          update payments
          set stripe_charge_id = coalesce(stripe_charge_id, ${chargeId}),
              stripe_payment_intent_id = coalesce(stripe_payment_intent_id, ${piId})
          where id = ${num(payment.id)}
        `;
      }
      return;
    }
    if (payment.status === "expired" && payment.source === "lesson" && !bool(payment.fee_reserved) && payment.month_key) {
      await prepareLessonFeeMonth(sql, payment.payee_user_id, payment.month_key);
      await sql`
        update platform_fee_months
        set fee_cents = fee_cents + ${num(payment.platform_fee_cents)}
        where payee_user_id = ${payment.payee_user_id} and month_key = ${payment.month_key}
      `;
    }
    const updated = await sql`
      update payments
      set status = 'paid',
          paid_at = coalesce(paid_at, now()),
          fee_reserved = ${payment.source === "lesson"},
          stripe_checkout_session_id = coalesce(stripe_checkout_session_id, ${session.id}),
          stripe_payment_intent_id = ${piId},
          stripe_charge_id = ${chargeId}
      where id = ${num(payment.id)} and status in ('pending', 'expired')
      returning id
    `;
    if (!updated[0]) return;
    await recordPaid(sql, payment);
  });
}

async function applyChargeRefunded(charge: StripeCharge) {
  const piField = charge.payment_intent;
  const piId = typeof piField === "string" ? piField : piField?.id ?? null;
  await withTransaction(async (sql) => {
    const peek = await sql<PendingRow>`
      select id, source, payee_user_id, month_key
      from payments
      where stripe_charge_id = ${charge.id}
         or stripe_payment_intent_id = ${piId}
      limit 1
    `;
    if (peek[0]?.source === "lesson" && peek[0].month_key && peek[0].payee_user_id) {
      await prepareLessonFeeMonth(sql, peek[0].payee_user_id, peek[0].month_key);
    }
    const rows = await sql<PendingRow>`
      select id, gross_cents, platform_fee_cents, stripe_checkout_session_id, expires_at,
             fee_reserved, month_key, payee_user_id, source, status, payer_user_id, related_id,
             stripe_payment_intent_id, stripe_charge_id, platform_fee_refunded_cents
      from payments
      where id = ${peek[0] ? num(peek[0].id) : 0}
      for update
    `;
    const payment = rows[0];
    if (!payment) return;
    const fee = num(payment.platform_fee_cents);
    const full = charge.refunded || charge.amount_refunded >= charge.amount;
    const feeRefunded = full
      ? fee
      : charge.amount > 0
        ? Math.min(fee, Math.round((fee * charge.amount_refunded) / charge.amount))
        : num(payment.platform_fee_refunded_cents);
    const delta = feeRefunded - num(payment.platform_fee_refunded_cents);
    if (delta > 0 && payment.source === "lesson" && bool(payment.fee_reserved) && payment.month_key) {
      await prepareLessonFeeMonth(sql, payment.payee_user_id, payment.month_key);
      await subtractLessonPlatformFee(sql, {
        payeeUserId: payment.payee_user_id,
        monthKey: payment.month_key,
        cents: delta,
      });
    }
    await sql`
      update payments
      set refunded_cents = ${charge.amount_refunded},
          platform_fee_refunded_cents = ${feeRefunded},
          status = ${full ? "refunded" : payment.status === "pending" ? "pending" : "paid"},
          stripe_charge_id = coalesce(stripe_charge_id, ${charge.id})
      where id = ${num(payment.id)}
    `;
    if (delta > 0) {
      await sql`
        insert into platform_ledger (kind, amount_cents, source_user_id, related_id, note)
        values (
          ${`stripe_${payment.source}_refund`}, ${-delta}, ${payment.payer_user_id},
          ${num(payment.related_id)}, 'Stripe platform fee refunded'
        )
      `;
    }
  });
}

async function openCheckout(userId: string, source: FeeSource, relatedId: number): Promise<{ url: string }> {
  if (!paymentsConfigured()) throw new Error("Payments coming soon");
  const stripe = await stripeClient();
  if (!stripe) throw new Error("Payments coming soon");
  const sql = await getSql();
  const target = await checkoutTarget(sql, userId, source, relatedId);
  if (!(await payeeCanReceive(sql, target.payeeUserId))) {
    throw new Error(
      source === "lesson"
        ? "This coach hasn't finished payout setup."
        : source === "court"
          ? "This facility hasn't finished payout setup."
          : "The organizer hasn't finished payout setup.",
    );
  }
  const accountRows = await sql`
    select stripe_account_id from connect_accounts where user_id = ${target.payeeUserId} limit 1
  `;
  const accountId = String(accountRows[0]?.stripe_account_id ?? "");
  if (!accountId) throw new Error("Payments coming soon");
  const config = readPlatformFeeConfig();
  const month = monthKey(new Date(), config.timeZone);
  const reserveOnce = () =>
    withTransaction((tx) =>
      reservePayment(tx, { ...target, source, relatedId, accountId, config, month }),
    );
  let reserved: Awaited<ReturnType<typeof reservePayment>>;
  try {
    reserved = await reserveOnce();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    reserved = await reserveOnce();
  }
  if (reserved.sessionId) {
    const existing = await stripe.checkout.sessions.retrieve(reserved.sessionId);
    if (existing.status === "open" && existing.url) return { url: existing.url };
    if (existing.payment_status === "paid") {
      await applyCheckoutSession(existing);
      return { url: `${publicOrigin()}/app/payments/return?session_id=${existing.id}` };
    }
    await withTransaction((tx) => expirePayment(tx, reserved.paymentId));
    reserved = await reserveOnce();
  }
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        expires_at: Math.floor(new Date(reserved.expiresAt).getTime() / 1000),
        success_url: `${publicOrigin()}/app/payments/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicOrigin()}/app/payments/return?canceled=1`,
        client_reference_id: String(reserved.paymentId),
        metadata: {
          payment_id: String(reserved.paymentId),
          source,
          related_id: String(relatedId),
          payer_user_id: target.payerUserId,
          payee_user_id: target.payeeUserId,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: target.grossCents,
              product_data: { name: target.description },
            },
          },
        ],
        payment_intent_data: {
          ...(reserved.feeCents > 0 ? { application_fee_amount: reserved.feeCents } : {}),
          transfer_data: { destination: accountId },
          metadata: { payment_id: String(reserved.paymentId), source },
        },
      },
      { idempotencyKey: `rally-payment-${reserved.paymentId}` },
    );
    if (!session.url) throw new Error("Checkout did not return a URL.");
    await sql`
      update payments set stripe_checkout_session_id = ${session.id}
      where id = ${reserved.paymentId}
    `;
    return { url: session.url };
  } catch (err) {
    await withTransaction((tx) => expirePayment(tx, reserved.paymentId));
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    throw new Error(message);
  }
}

export async function abandonOpenPayment(
  source: FeeSource,
  relatedId: number,
  payerUserId: string,
) {
  if (!paymentsConfigured()) return;
  const pending = await withTransaction((sql) => lockPending(sql, source, relatedId, payerUserId));
  if (!pending) return;
  const sessionId = pending.stripe_checkout_session_id;
  await withTransaction((sql) => expirePayment(sql, num(pending.id)));
  if (!sessionId) return;
  const stripe = await stripeClient();
  if (!stripe) return;
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch {
    // The session may already be expired or paid.
  }
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret || !env("STRIPE_SECRET_KEY")) {
    return new Response("Payments coming soon", { status: 503 });
  }
  const stripe = await stripeClient();
  if (!stripe) return new Response("Payments coming soon", { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    if (event.type === "checkout.session.completed") {
      await applyCheckoutSession(event.data.object as CheckoutSession);
    } else if (event.type === "account.updated") {
      const account = event.data.object as StripeAccount;
      const full = await stripe.accounts.retrieve(account.id);
      await writeAccount(await getSql(), full);
    } else if (event.type === "charge.refunded") {
      await applyChargeRefunded(event.data.object as StripeCharge);
    }
    await (await getSql())`
      insert into stripe_events (id, type) values (${event.id}, ${event.type})
      on conflict do nothing
    `;
  } catch (err) {
    console.error("[stripe] webhook", event.type, err instanceof Error ? err.message : "failed");
    return new Response("Webhook failed", { status: 500 });
  }
  return new Response("ok");
}

function ownerEmails() {
  const raw = env("PLATFORM_OWNER_EMAILS");
  if (!raw) return OWNER_DEFAULT;
  const list = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : OWNER_DEFAULT;
}

export type PayOffer = {
  enabled: boolean;
  grossCents: number;
  status: "none" | "pending" | "paid" | "refunded";
  platformFeeCents: number | null;
  paymentId: number | null;
  canPay: boolean;
  canRefund: boolean;
  canRejoin: boolean;
  message: "none" | "coming_soon" | "payee_setup" | "ready" | "paid" | "refunded";
};

async function latestPayment(sql: Sql, source: FeeSource, relatedId: number, payerUserId: string) {
  const rows = await sql<PendingRow>`
    select id, status, platform_fee_cents, gross_cents, payer_user_id, payee_user_id, source,
           related_id, fee_reserved, month_key, stripe_checkout_session_id, expires_at,
           stripe_payment_intent_id, stripe_charge_id, platform_fee_refunded_cents
    from payments
    where source = ${source} and related_id = ${relatedId} and payer_user_id = ${payerUserId}
      and status in ('pending', 'paid', 'refunded')
    order by case status when 'paid' then 0 when 'pending' then 1 else 2 end, id desc
    limit 1
  `;
  return rows[0] ?? null;
}

export const getPaymentsConfig = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const config = readPlatformFeeConfig();
    return {
      enabled: paymentsConfigured(),
      lessonPct: config.lessonPct,
      lessonCapCents: config.lessonCapCents,
      courtPct: config.courtPct,
      leaguePct: config.leaguePct,
    };
  });

export const getConnectStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const config = readPlatformFeeConfig();
    const base = {
      enabled: paymentsConfigured(),
      ready: false,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      lessonPct: config.lessonPct,
      lessonCapCents: config.lessonCapCents,
      courtPct: config.courtPct,
      leaguePct: config.leaguePct,
    };
    if (!base.enabled) return base;
    try {
      await syncConnectAccount(context.userId);
    } catch (err) {
      console.error("[stripe] account sync", err instanceof Error ? err.message : "failed");
    }
    const rows = await (await getSql())`
      select transfers_active, charges_enabled, payouts_enabled, details_submitted
      from connect_accounts where user_id = ${context.userId} limit 1
    `;
    const row = rows[0];
    if (!row) return base;
    return {
      ...base,
      ready: accountIsReady(row),
      detailsSubmitted: bool(row.details_submitted),
      chargesEnabled: bool(row.charges_enabled),
      payoutsEnabled: bool(row.payouts_enabled),
    };
  });

export const startConnectOnboarding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!paymentsConfigured()) throw new Error("Payments coming soon");
    const stripe = await stripeClient();
    if (!stripe) throw new Error("Payments coming soon");
    const accountId = await ensureConnectAccount(context.userId);
    const origin = publicOrigin();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/app/payments/refresh`,
      return_url: `${origin}/app/payments/return?connect=1`,
      type: "account_onboarding",
    });
    if (!link.url) throw new Error("Payments coming soon");
    return { url: link.url };
  });

export const getPayOffer = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ source: sourceZ, relatedId: z.coerce.number() }))
  .handler(async ({ context, data }): Promise<PayOffer> => {
    const sql = await getSql();
    const enabled = paymentsConfigured();
    const empty: PayOffer = {
      enabled,
      grossCents: 0,
      status: "none",
      platformFeeCents: null,
      paymentId: null,
      canPay: false,
      canRefund: false,
      canRejoin: false,
      message: "none",
    };
    if (data.source === "lesson") {
      const rows = await sql`
        select player_user_id, coach_user_id, price_cents, status
        from lessons where id = ${data.relatedId} limit 1
      `;
      const row = rows[0];
      if (!row) return empty;
      if (context.userId !== String(row.player_user_id) && context.userId !== String(row.coach_user_id)) return empty;
      const gross = num(row.price_cents);
      if (gross <= 0) return empty;
      const payment = await latestPayment(sql, "lesson", data.relatedId, String(row.player_user_id));
      return offerFrom({
        enabled,
        gross,
        payment,
        viewerIsPayer: context.userId === String(row.player_user_id),
        viewerIsPayee: context.userId === String(row.coach_user_id),
        payable: row.status !== "cancelled" && row.status !== "declined",
        payeeReady: await payeeCanReceive(sql, String(row.coach_user_id)),
        canRejoin: false,
      });
    }
    if (data.source === "court") {
      const rows = await sql`
        select r.user_id, r.fee_cents, r.status, c.added_by
        from reservations r join courts c on c.id = r.court_id
        where r.id = ${data.relatedId} limit 1
      `;
      const row = rows[0];
      if (!row) return empty;
      const payer = String(row.user_id);
      const payee = row.added_by == null ? null : String(row.added_by);
      if (context.userId !== payer && context.userId !== payee) return empty;
      const gross = num(row.fee_cents);
      if (gross <= 0) return empty;
      const payment = await latestPayment(sql, "court", data.relatedId, payer);
      return offerFrom({
        enabled,
        gross,
        payment,
        viewerIsPayer: context.userId === payer,
        viewerIsPayee: payee != null && context.userId === payee,
        payable: row.status !== "cancelled",
        payeeReady: await payeeCanReceive(sql, payee),
        canRejoin: false,
      });
    }
    const rows = await sql`
      select owner_user_id, reg_fee_cents from leagues where id = ${data.relatedId} limit 1
    `;
    const row = rows[0];
    if (!row || !row.owner_user_id) return empty;
    const gross = num(row.reg_fee_cents);
    if (gross <= 0) return empty;
    const owner = String(row.owner_user_id);
    const member = await sql`
      select 1 as n from league_members where league_id = ${data.relatedId} and user_id = ${context.userId} limit 1
    `;
    const payment = await latestPayment(sql, "league", data.relatedId, context.userId);
    const joined = Boolean(member[0]);
    return offerFrom({
      enabled,
      gross,
      payment,
      viewerIsPayer: context.userId !== owner,
      viewerIsPayee: false,
      payable: !joined && context.userId !== owner,
      payeeReady: await payeeCanReceive(sql, owner),
      canRejoin: !joined && payment?.status === "paid",
    });
  });

function offerFrom(input: {
  enabled: boolean;
  gross: number;
  payment: PendingRow | null;
  viewerIsPayer: boolean;
  viewerIsPayee: boolean;
  payable: boolean;
  payeeReady: boolean;
  canRejoin: boolean;
}): PayOffer {
  const status = input.payment
    ? input.payment.status === "paid" || input.payment.status === "pending" || input.payment.status === "refunded"
      ? input.payment.status
      : "none"
    : "none";
  const paid = status === "paid";
  const canPay = input.enabled && input.payeeReady && input.payable && input.viewerIsPayer && !paid && !input.canRejoin;
  const canRefund = input.enabled && paid && input.viewerIsPayee && input.payment != null;
  let message: PayOffer["message"] = "none";
  if (paid) message = "paid";
  else if (status === "refunded" && canPay) message = "ready";
  else if (status === "refunded") message = "refunded";
  else if (!input.enabled) message = "coming_soon";
  else if (!input.payeeReady) message = "payee_setup";
  else if (canPay || status === "pending") message = "ready";
  return {
    enabled: input.enabled,
    grossCents: input.gross,
    status,
    platformFeeCents: input.payment ? num(input.payment.platform_fee_cents) : null,
    paymentId: input.payment ? num(input.payment.id) : null,
    canPay,
    canRefund,
    canRejoin: input.canRejoin,
    message,
  };
}

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ source: sourceZ, relatedId: z.coerce.number() }))
  .handler(async ({ context, data }) => openCheckout(context.userId, data.source, data.relatedId));

export const confirmCheckoutReturn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ sessionId: z.string().min(1).max(255) }))
  .handler(async ({ context, data }) => {
    if (!paymentsConfigured()) return { status: "unavailable" as const, grossCents: 0, platformFeeCents: 0, source: null as string | null };
    const stripe = await stripeClient();
    if (!stripe) return { status: "unavailable" as const, grossCents: 0, platformFeeCents: 0, source: null };
    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    const payer = session.metadata?.payer_user_id;
    if (payer && payer !== context.userId) throw new Error("That payment belongs to someone else.");
    if (session.payment_status === "paid") await applyCheckoutSession(session);
    const rows = await (await getSql())`
      select status, gross_cents, platform_fee_cents, source
      from payments
      where stripe_checkout_session_id = ${data.sessionId}
         or (${session.metadata?.payment_id ?? null}::text is not null and id = ${num(session.metadata?.payment_id)})
      limit 1
    `;
    const row = rows[0];
    return {
      status: row ? String(row.status) : session.payment_status === "paid" ? "paid" : "pending",
      grossCents: row ? num(row.gross_cents) : 0,
      platformFeeCents: row ? num(row.platform_fee_cents) : 0,
      source: row ? String(row.source) : (session.metadata?.source ?? null),
    };
  });

export const refundPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ paymentId: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    if (!paymentsConfigured()) throw new Error("Payments coming soon");
    const stripe = await stripeClient();
    if (!stripe) throw new Error("Payments coming soon");
    const sql = await getSql();
    const rows = await sql<PendingRow>`
      select id, status, payee_user_id, stripe_payment_intent_id, source, related_id, payer_user_id,
             gross_cents, platform_fee_cents, fee_reserved, month_key, stripe_checkout_session_id,
             expires_at, stripe_charge_id, platform_fee_refunded_cents
      from payments where id = ${data.paymentId} limit 1
    `;
    const payment = rows[0];
    if (!payment || payment.payee_user_id !== context.userId) throw new Error("Only the coach or organizer can refund this.");
    if (payment.status !== "paid") throw new Error("This payment is not refundable.");
    if (!payment.stripe_payment_intent_id) throw new Error("This payment cannot be refunded yet.");
    const refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        refund_application_fee: true,
        reverse_transfer: true,
      },
      { idempotencyKey: `rally-refund-${payment.id}` },
    );
    const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      await applyChargeRefunded(charge);
    }
    return { ok: true };
  });

export const listRefundablePayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ source: sourceZ, relatedId: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql`
      select p.id, p.payer_user_id, p.gross_cents, p.platform_fee_cents, p.status,
             pr.display_name as payer_name
      from payments p
      left join profiles pr on pr.user_id = p.payer_user_id
      where p.source = ${data.source}
        and p.related_id = ${data.relatedId}
        and p.payee_user_id = ${context.userId}
        and p.status = 'paid'
      order by p.paid_at desc nulls last, p.id desc
    `;
    return rows.map((row) => ({
      id: num(row.id),
      payerName: row.payer_name == null ? "Player" : String(row.payer_name),
      grossCents: num(row.gross_cents),
      platformFeeCents: num(row.platform_fee_cents),
    }));
  });

export const getPlatformFeesThisMonth = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    let email = "";
    try {
      const emailRows = await sql`select email from "user" where id = ${context.userId} limit 1`;
      if (emailRows[0]?.email) email = String(emailRows[0].email).toLowerCase();
    } catch {
      email = "";
    }
    if (!ownerEmails().includes(email)) return { owner: false as const };
    const config = readPlatformFeeConfig();
    const key = monthKey(new Date(), config.timeZone);
    const rows = await sql`
      select source,
        coalesce(sum(platform_fee_cents - platform_fee_refunded_cents), 0)::int as n
      from payments
      where status in ('paid', 'refunded')
        and paid_at is not null
        and to_char(paid_at at time zone ${config.timeZone}, 'YYYY-MM') = ${key}
      group by source
    `;
    const by = Object.fromEntries(rows.map((row) => [String(row.source), num(row.n)]));
    const lessons = by.lesson ?? 0;
    const courts = by.court ?? 0;
    const leagues = by.league ?? 0;
    return {
      owner: true as const,
      month: key,
      lessons,
      courts,
      leagues,
      total: lessons + courts + leagues,
    };
  });
