import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "../../../../lib/auth-cookies";
import { API_URL } from "../../../../lib/api-url";
import { DASHBOARD_ROLES } from "../../../../lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const apiRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await apiRes.json();

  if (!apiRes.ok) {
    return NextResponse.json(data, { status: apiRes.status });
  }

  // The API doesn't know which client is calling it (members sign in to the mobile app through the
  // same /auth/login), so "staff only" for this dashboard is enforced here, server-side, before any
  // cookie is ever set.
  if (!(DASHBOARD_ROLES as readonly string[]).includes(data.user.role)) {
    return NextResponse.json(
      { statusCode: 403, message: "This dashboard is for gym staff. Members use the mobile app." },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ user: data.user });
  setAuthCookies(response, data.tokens);
  return response;
}
