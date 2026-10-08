import { randomInt } from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";

/**
 * Generates a random temporary password for staff-created accounts
 * (coaches, members added via the admin dashboard). No email provider is
 * configured yet (see MailerService), so this is returned once in the API
 * response for the admin to relay to the new user, who should change it on
 * first login. Meets the same complexity rule enforced by RegisterDto.
 */
export function generateTempPassword(): string {
  const pick = (chars: string) => chars[randomInt(chars.length)];
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  const all = UPPER + LOWER + DIGITS;
  const rest = Array.from({ length: 9 }, () => pick(all));
  const combined = [...required, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}
