"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

/**
 * Loads `path` (null = do not load yet) and reloads when it changes. A newer request always wins, so a slow
 * response for an old filter can never overwrite the results of the current one.
 */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(path);
      if (ticket === latest.current) setData(result);
    } catch (e) {
      if (ticket === latest.current) setError(e instanceof ApiError ? e.message : "Could not load this data.");
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

/** Downloads a binary API response (PDF / Excel / CSV) through the authenticated proxy. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`/api/proxy/${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body ?? { statusCode: res.status, message: "Download failed", requestId: "", timestamp: "", path });
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
