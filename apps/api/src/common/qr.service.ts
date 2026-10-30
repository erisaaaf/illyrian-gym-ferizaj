import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "IGM1";

/**
 * Member QR codes. The code is a signed, self-verifying token - `IGM1.<userId>.<version>.<signature>` - so it
 * cannot be forged or guessed from a member number, and nothing secret is printed in it. The check-in endpoint
 * always re-checks the member and membership in the database; the signature only proves the code was issued by
 * this system. Bumping `User.qrVersion` invalidates a lost or shared card.
 */
@Injectable()
export class QrService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    // Derived from an existing secret with a context label, so no extra environment variable is required.
    this.key = createHmac("sha256", config.get<string>("JWT_REFRESH_SECRET")!).update("illyrian-qr-v1").digest();
  }

  private signature(userId: string, version: number): string {
    return createHmac("sha256", this.key).update(`${userId}.${version}`).digest("hex").slice(0, 24);
  }

  issue(userId: string, version: number): string {
    return `${PREFIX}.${userId}.${version}.${this.signature(userId, version)}`;
  }

  /** Returns the member the code was issued for, or null if it is malformed or the signature does not match. */
  parse(token: string): { userId: string; version: number } | null {
    const parts = token.trim().split(".");
    if (parts.length !== 4 || parts[0] !== PREFIX) return null;
    const [, userId, versionText, signature] = parts;
    const version = Number(versionText);
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !Number.isInteger(version) || version < 1) return null;

    const expected = Buffer.from(this.signature(userId, version));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return { userId, version };
  }
}
