// Minimal, dependency-free admin auth for the MVP.
//
// A successful password login mints a signed session token (HMAC-SHA256 over a
// JSON payload) stored in an httpOnly cookie. Verification uses the Web Crypto
// API so it runs in BOTH the Node.js route handlers and the Edge middleware.
//
// Configure via env:
//   ADMIN_PASSWORD        - the shared admin password
//   ADMIN_SESSION_SECRET  - long random string used to sign session tokens
//
// If either is unset the admin area is "unconfigured": open in development,
// locked in production (fail-closed).

export const SESSION_COOKIE = "wh_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

export function isAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Verify a submitted password against ADMIN_PASSWORD (constant-time). */
export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return timingSafeEqual(password, expected);
}

export async function createSessionToken(): Promise<string> {
  const body = encodeBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ sub: "admin", exp: Date.now() + SESSION_TTL_MS }),
    ),
  );
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;

  const expected = await hmac(body);
  if (!timingSafeEqual(sig, expected)) return false;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(body)),
    ) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

// --- internals ---

async function hmac(data: string): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return encodeBase64Url(new Uint8Array(sig));
}

function encodeBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
