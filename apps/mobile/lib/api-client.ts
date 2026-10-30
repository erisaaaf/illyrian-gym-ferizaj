import { ApiErrorResponse, AuthResponse, AuthTokens } from "@illyrian/types";
import { tokenStorage } from "./token-storage";
import { API_TARGET, API_URL } from "./api-config";

const devLog = (message: string) => {
  if (__DEV__) console.warn(`[api] ${message}`);
};

if (__DEV__) console.log(`[api] base URL ${API_URL} (${API_TARGET.source})`);

/** The request never got an HTTP response: server down, wrong address, blocked by a firewall/CORS, offline. */
export class NetworkError extends Error {
  constructor(
    public method: string,
    public url: string,
    public cause?: unknown,
  ) {
    super("Could not reach the server. Please try again.");
    this.name = "NetworkError";
  }
}

/**
 * fetch() that reports transport failures with enough context to debug them in
 * development - method, URL (path only, no query/body), error type - and never
 * touches headers, bodies or tokens.
 */
async function send(path: string, init: RequestInit & { method: string }): Promise<Response> {
  const url = `${API_URL}${path}`;
  try {
    const res = await fetch(url, init);
    if (!res.ok) devLog(`${init.method} ${path.split("?")[0]} -> HTTP ${res.status}`);
    return res;
  } catch (e) {
    devLog(`${init.method} ${url.split("?")[0]} failed before any response (${(e as Error)?.name ?? "error"}: ${(e as Error)?.message ?? "unknown"}). Is the API running and reachable from this device at ${API_URL}?`);
    throw new NetworkError(init.method, url.split("?")[0], e);
  }
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: Record<string, string[]>,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown when the refresh token itself is invalid/expired - callers should route to /login. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired. Please log in again.");
    this.name = "SessionExpiredError";
  }
}

let refreshInFlight: Promise<void> | null = null;

async function refreshTokens(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) throw new SessionExpiredError();

  const res = await send("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await tokenStorage.clear();
    throw new SessionExpiredError();
  }

  const tokens: AuthTokens = await res.json();
  await tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean; // defaults to true
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  async function doFetch(): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) {
      const accessToken = await tokenStorage.getAccessToken();
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    }
    return send(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  let res = await doFetch();

  // One transparent retry after a token refresh - mirrors the rotation
  // contract in docs/architecture.md#authentication.
  if (res.status === 401 && auth) {
    if (!refreshInFlight) {
      refreshInFlight = refreshTokens().finally(() => {
        refreshInFlight = null;
      });
    }
    await refreshInFlight;
    res = await doFetch();
  }

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiError(res.status, errorBody?.message ?? "Request failed", errorBody?.errors, errorBody?.code);
  }

  // Some endpoints legitimately return an empty 200 body (e.g. "no WOD today"); treat it as null.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, opts?: Partial<RequestOptions>) =>
    request<T>(path, { method: "POST", body, ...opts }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function login(email: string, password: string): Promise<AuthResponse> {
  const result = await request<AuthResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false });
  await tokenStorage.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
  return result;
}

export async function logout(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();
  await tokenStorage.clear();
  if (refreshToken) {
    await send("/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
}
