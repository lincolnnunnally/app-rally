import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

/**
 * Owner-only free-access admin over the comped-coach list (migration 0019).
 * Gated server-side on the verified owner email (context.isOwner); never a DB role.
 */
function assertOwner(context: { isOwner?: boolean }) {
  if (!context.isOwner) throw new Error("Not found");
}

export type CompedCoach = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  note: string | null;
  created_at: string;
};

export const listCompedCoaches = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CompedCoach[]> => {
    assertOwner(context);
    const rows = await (await getSql())`
      select c.user_id, u.email, p.display_name, c.note, c.created_at::text as created_at
      from rally_comped_coaches c
      left join "user" u on u.id = c.user_id
      left join profiles p on p.user_id = c.user_id
      order by c.created_at desc
    `;
    return rows.map((r) => ({
      user_id: String(r.user_id),
      email: r.email == null ? null : String(r.email),
      display_name: r.display_name == null ? null : String(r.display_name),
      note: r.note == null ? null : String(r.note),
      created_at: String(r.created_at),
    }));
  });

export const grantFreeAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ email: z.string().trim().email().max(200), note: z.string().max(200).optional() }))
  .handler(async ({ context, data }) => {
    assertOwner(context);
    const sql = await getSql();
    const user = (await sql`select id from "user" where lower(email) = ${data.email.toLowerCase()} limit 1`)[0];
    if (!user) throw new Error("No Rally account with that email.");
    await sql`
      insert into rally_comped_coaches (user_id, note)
      values (${String(user.id)}, ${(data.note ?? "").trim() || "Free access (owner grant)"})
      on conflict (user_id) do update set note = excluded.note
    `;
    return { ok: true };
  });

export const revokeFreeAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ user_id: z.string().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    assertOwner(context);
    await (await getSql())`delete from rally_comped_coaches where user_id = ${data.user_id}`;
    return { ok: true };
  });
