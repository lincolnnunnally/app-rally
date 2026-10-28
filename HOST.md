Host: https://rally.unitedundergod.org
CNAME rally -> cname.vercel-dns.com

## Database

Production data lives in the shared **LPL Supabase** project (`uqhqulrqcygsmmzdzemx`),
schema `rally`, alongside the rest of the ecosystem.

- `DATABASE_URL` (Vercel, sensitive) = session pooler
  `aws-1-us-east-2.pooler.supabase.com:5432`, login `rally_app.uqhqulrqcygsmmzdzemx`.
- `rally_app` owns schema `rally` and its default `search_path` is `rally, public`.
  Use the session pooler (5432), not the transaction pooler (6543): the app sets
  `search_path` per connection.
- The `rally` schema is closed to the Supabase API roles (`anon`, `authenticated`).
  Rally talks to it only from the server.
- Moved from Neon (project "Apps", database `rally`) on 2026-10-28. All 44 tables and 278 rows
  were verified identical. The Neon copy is untouched and is the rollback.
