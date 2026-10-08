import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "../../../../lib/auth-cookies";
import { API_URL } from "../../../../lib/api-url";

// Generic authenticated proxy: browser -> this route -> backend API. Tokens
// never reach client JS (httpOnly cookie, read only here, server-side) -
// see docs/architecture.md#authentication. proxy.ts (the Next middleware)
// already refreshes an expired access token before a request reaches here,
// so a 401 at this point means the session is genuinely gone.
async function forward(req: NextRequest, path: string[]) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ statusCode: 401, message: "Not authenticated" }, { status: 401 });
  }

  const search = req.nextUrl.search;
  const target = `${API_URL}/${path.join("/")}${search}`;

  const hasBody = req.method !== "GET" && req.method !== "DELETE" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  const res = await fetch(target, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(hasBody && body ? { "Content-Type": "application/json" } : {}),
    },
    body: body && body.length > 0 ? body : undefined,
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path);
}
