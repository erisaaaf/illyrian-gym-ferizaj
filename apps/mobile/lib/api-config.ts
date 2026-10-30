import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Where the API lives, per run target.
 *
 * `localhost` only means "the development PC" when the app runs in a browser on
 * that PC (or in the iOS simulator). On a physical phone it is the phone itself;
 * in the Android emulator it is the emulator. So:
 *
 * 1. EXPO_PUBLIC_API_URL, when set, is honoured - but if it points at loopback and
 *    the app runs on a device/emulator, the loopback host is swapped for the PC that
 *    is serving the JS bundle (Metro), which is the machine running the API.
 * 2. Otherwise the URL is derived: Metro's host on a device, the page's own host on
 *    web, 10.0.2.2 (the emulator's alias for the PC) as a last resort on Android.
 *
 * The API port comes from EXPO_PUBLIC_API_PORT (default 3010, the API's dev port).
 * A production build must set EXPO_PUBLIC_API_URL explicitly.
 */
const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? "3010";

const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "::1";

/** Host of the dev machine serving the bundle, e.g. "192.168.0.23" (native dev builds only). */
function metroHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra?.expoGo?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  return host || null;
}

export interface ApiTarget {
  url: string;
  /** Human-readable reason, for development diagnostics only. */
  source: string;
}

export function resolveApiTarget(): ApiTarget {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  const metro = metroHost();

  if (explicit) {
    try {
      const u = new URL(explicit);
      if (Platform.OS !== "web" && isLoopback(u.hostname)) {
        const host = metro ?? (Platform.OS === "android" ? "10.0.2.2" : null);
        if (host && !isLoopback(host)) {
          u.hostname = host;
          return { url: u.toString().replace(/\/+$/, ""), source: `EXPO_PUBLIC_API_URL with loopback host replaced by the dev PC (${host})` };
        }
      }
    } catch {
      // not a valid URL: use it verbatim and let the request fail visibly
    }
    return { url: explicit, source: "EXPO_PUBLIC_API_URL" };
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return { url: `${window.location.protocol}//${window.location.hostname}:${API_PORT}`, source: "derived from the page host" };
  }
  if (metro && !isLoopback(metro)) return { url: `http://${metro}:${API_PORT}`, source: `derived from the Metro host (${metro})` };
  if (Platform.OS === "android") return { url: `http://10.0.2.2:${API_PORT}`, source: "Android emulator alias for the dev PC" };
  return { url: `http://localhost:${API_PORT}`, source: "default" };
}

export const API_TARGET = resolveApiTarget();
export const API_URL = API_TARGET.url;
