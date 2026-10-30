import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { apiClient, ApiError, SessionExpiredError } from "./api-client";
import { useAuth } from "./auth-context";

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.statusCode === 429) return "Too many requests right now. Please wait a moment and try again.";
    return e.message;
  }
  return "Could not reach the server. Check your connection and try again.";
}

/**
 * GET a path and keep it fresh: loads when the screen gains focus (so data is
 * current after booking on one tab and viewing on another) and on demand via reload().
 * Pass null to skip loading until a dependency (e.g. an id) is known.
 */
export function useApi<T>(path: string | null) {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    const mine = ++latest.current;
    setError(null);
    try {
      const result = await apiClient.get<T>(path);
      if (mine === latest.current) setData(result);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await refreshUser(); // clears the user, which sends the app back to the login screen
        return;
      }
      if (mine === latest.current) setError(errorMessage(e));
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [path, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, error, loading, reload: load };
}
