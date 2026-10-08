import { NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE, clearAuthCookies } from "../../../../lib/auth-cookies";
import { API_URL } from "../../../../lib/api-url";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
