import { createHash, randomBytes } from "crypto";

/**
 * Opaque, single-use tokens (refresh tokens, password reset, email
 * verification) are generated as random bytes and only their SHA-256 hash
 * is persisted. A database leak alone can never be used to impersonate a
 * user or reset a password - the raw token is only ever shown once, at
 * issuance time.
 */
export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
