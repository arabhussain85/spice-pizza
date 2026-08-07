// Signed, expiring counter-terminal session token (HMAC-SHA256).
//
// The counter portal has no Supabase login — just a PIN. To stop anyone from
// forging the access cookie by hand (e.g. `counter_pin=valid`), the server signs
// a short-lived token on correct PIN entry and the proxy verifies the signature
// on every counter/api request. Edge-runtime safe (Web Crypto, no Node Buffer).

const SECRET =
  process.env.COUNTER_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "spice-pizza-counter-dev-secret-change-me";

const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return b64url(new Uint8Array(sig));
}

/** Issue a signed token valid for 8 hours. Returns `"<expiry>.<signature>"`. */
export async function signCounterToken(): Promise<string> {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${await sign(exp)}`;
}

/** True only if the token is well-formed, unexpired, and correctly signed. */
export async function verifyCounterToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return (await sign(exp)) === sig;
}

export const COUNTER_TTL_MS = TTL_MS;
