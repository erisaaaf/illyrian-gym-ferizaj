import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

// Loopback and private-network (RFC 1918) origins, any port. Only used in development.
const PRIVATE_NETWORK_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

/**
 * CORS only concerns browsers (the admin dashboard, Expo web). The native mobile app
 * sends no Origin header and is never affected.
 *
 * - Every environment: the explicit CORS_ORIGINS allow-list.
 * - Development only: also loopback/private-network origins, because an Expo web page may be
 *   opened via the PC's LAN address (e.g. http://192.168.0.23:8082).
 * Anything else - in particular any public origin in staging/production unless listed - is refused.
 */
export function buildCorsOptions(allowList: string[], nodeEnv: string | undefined): CorsOptions {
  const isDev = nodeEnv === "development";
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true); // non-browser clients (mobile app, curl, server-to-server)
      if (allowList.includes(origin) || (isDev && PRIVATE_NETWORK_ORIGIN.test(origin))) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  };
}
