/**
 * Better Auth already returns a specific message ("Invalid email or password",
 * "Email not verified"). Some client errors only fill `code` or put a generic
 * HTTP status in `message`. Prefer the specific reason.
 */
const GENERIC = new Set([
  "unauthorized",
  "forbidden",
  "bad request",
  "internal server error",
  "could not sign in",
  "could not create account",
  "sign-in failed",
]);

const CODE_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
  EMAIL_NOT_VERIFIED: "Email not verified",
  INVALID_EMAIL: "Invalid email",
  USER_EMAIL_NOT_FOUND: "User email not found",
  USER_ALREADY_EXISTS: "User already exists.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "User already exists. Use another email.",
  PASSWORD_TOO_SHORT: "Password too short",
  PASSWORD_TOO_LONG: "Password too long",
  INVALID_TOKEN: "Invalid token",
  FAILED_TO_CREATE_SESSION: "Failed to create session",
};

export type AuthErrorLike = {
  message?: string | null;
  code?: string | null;
  statusText?: string | null;
};

export function authErrorMessage(error: AuthErrorLike | null | undefined, fallback: string): string {
  const message = specific(error?.message);
  if (message) return message;
  const code = error?.code?.trim();
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  const statusText = specific(error?.statusText);
  if (statusText) return statusText;
  if (code) return code;
  return fallback;
}

function specific(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (GENERIC.has(text.toLowerCase())) return null;
  return text;
}
