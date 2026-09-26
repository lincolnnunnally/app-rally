import { authErrorMessage, type AuthErrorLike } from "./auth-error.ts";

export type SignInClientResult = {
  error?: (AuthErrorLike & { error?: AuthErrorLike | null }) | null;
  data?: { token?: string | null; user?: unknown; url?: string | null } | null;
};

export type SignInOutcome = { ok: true; dest: string } | { ok: false; message: string };

const NETWORK = "Network error";

export function signInOutcome(
  result: SignInClientResult | null | undefined,
  fallback: string,
  dest: string,
): SignInOutcome {
  if (result?.error) {
    return { ok: false, message: authErrorMessage(result.error, fallback) };
  }
  const token = result?.data?.token;
  const user = result?.data?.user;
  if (!token && !user) {
    return { ok: false, message: fallback };
  }
  return { ok: true, dest };
}

export function thrownAuthMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    if (err.name === "TypeError" || /failed to fetch|network/i.test(err.message)) return NETWORK;
    return err.message.trim();
  }
  return fallback;
}

/**
 * Settle an email sign-in. A thrown error, an `{ error }` result, or a body
 * with no session all become a message. The caller clears its loading flag
 * after this promise settles (including the timeout).
 */
export async function runEmailSignIn(input: {
  request: () => Promise<SignInClientResult>;
  dest: string;
  fallback: string;
  timeoutMs?: number;
}): Promise<{ error: string | null; navigateTo: string | null }> {
  const timeoutMs = input.timeoutMs ?? 20_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      input.request(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(NETWORK)), timeoutMs);
      }),
    ]);
    const outcome = signInOutcome(result, input.fallback, input.dest);
    if (!outcome.ok) return { error: outcome.message, navigateTo: null };
    return { error: null, navigateTo: outcome.dest };
  } catch (err) {
    return { error: thrownAuthMessage(err, input.fallback), navigateTo: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
