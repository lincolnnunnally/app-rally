/** Signed Better Auth session cookie (`token.signature`), `__Host-` safe. */
export async function buildSessionSetCookie(input: {
  name: string;
  token: string;
  secret: string;
  maxAge: number;
  sign: (value: string, secret: string) => Promise<string>;
}): Promise<{ header: string; value: string }> {
  const signature = await input.sign(input.token, input.secret);
  const value = `${input.token}.${signature}`;
  const maxAge = Math.floor(input.maxAge);
  const header =
    `${input.name}=${encodeURIComponent(value)}` +
    `; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  return { header, value };
}
