import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies, clearAuthCookies } from "./lib/auth-cookies";
import { API_URL } from "./lib/api-url";

const PUBLIC_PATHS = ["/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    return NextResponse.next();
  }

  // Access token missing/expired - try to silently rotate using the
  // refresh token before bouncing the user to /login. Mirrors the same
  // rotation contract as the API (see docs/architecture.md#authentication):
  // the presented refresh token is revoked and replaced on every use.
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.ok) {
        const tokens = await res.json();
        const response = NextResponse.next();
        setAuthCookies(response, tokens);
        return response;
      }
    } catch {
      // Backend unreachable - fall through to redirect to login.
    }
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  const redirect = NextResponse.redirect(loginUrl);
  clearAuthCookies(redirect);
  return redirect;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
