import type { EnvLike } from "../owner.ts";

const URL_KEYS = ["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const;
const ANON_KEYS = [
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export const OWNER_SIGN_IN_UNAVAILABLE =
  "Owner sign-in is unavailable. Set SUPABASE_URL and SUPABASE_ANON_KEY.";

export const OWNER_SIGN_IN_NETWORK = "Network error";

export type SupabaseAnonConfig = { url: string; anonKey: string };

function first(env: EnvLike, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return null;
}

/** Public anon config only. Never reads a service-role key. */
export function readSupabaseAnonConfig(env: EnvLike = process.env): SupabaseAnonConfig | null {
  const url = first(env, URL_KEYS);
  const anonKey = first(env, ANON_KEYS);
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ""), anonKey };
}

export type GoTruePasswordResult =
  | { ok: true; name?: string }
  | { ok: false; reason: "rejected" | "network"; message: string };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Password grant against LPL GoTrue. The submitted password is sent once and
 * never stored. A non-200 is a normal rejection (caller keeps "Invalid email
 * or password").
 */
export async function verifyGoTruePassword(
  config: SupabaseAnonConfig,
  email: string,
  password: string,
  fetchImpl: FetchLike = fetch,
): Promise<GoTruePasswordResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, reason: "network", message: OWNER_SIGN_IN_NETWORK };
  }

  if (!response.ok) {
    return { ok: false, reason: "rejected", message: "Invalid email or password" };
  }

  const body = (await response.json().catch(() => null)) as {
    user?: { user_metadata?: { name?: unknown; full_name?: unknown } };
  } | null;
  const meta = body?.user?.user_metadata;
  const name =
    typeof meta?.name === "string"
      ? meta.name
      : typeof meta?.full_name === "string"
        ? meta.full_name
        : undefined;
  return { ok: true, name: name?.trim() || undefined };
}
