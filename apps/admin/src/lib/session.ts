import { cookies } from "next/headers";
import { AuthUser } from "@illyrian/types";
import { ACCESS_COOKIE } from "./auth-cookies";
import { API_URL } from "./api-url";

/**
 * Server-only. Reads the access token cookie and asks the API who it
 * belongs to - the dashboard never decodes/trusts the JWT itself, the API
 * is always the authority on identity and role. Returns null if there is
 * no session or the API rejects the token (expired/invalid); middleware.ts
 * is responsible for refreshing a token before it lands here.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  const res = await fetch(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

// The web dashboard is the staff console: Admin/Owner, Receptionist and Trainer (each sees only their part of it).
// Members use the mobile app. The API enforces roles itself regardless of what the UI shows.
export const DASHBOARD_ROLES = ["ADMIN", "RECEPTIONIST", "COACH"] as const;
