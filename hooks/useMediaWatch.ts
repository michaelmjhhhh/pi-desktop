"use client";

import { useEffect, useState } from "react";

export function useMediaWatch(metaUrl: string, watchUrl: string, watchEnabled: boolean, invalidate: () => void) {
  const [watching, setWatching] = useState(false);
  const [bust, setBust] = useState(0);
  const [size, setSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBust(0);
    setSize(null);
    invalidate();
    setError(null);
    setWatching(false);
  }, [metaUrl, watchUrl, invalidate]);

  useEffect(() => {
    setWatching(false);

    if (!watchEnabled) return;

    let active = true;
    let syncRequest = 0;
    const synchronize = () => {
      const requestId = ++syncRequest;
      fetch(metaUrl)
        .then((response) => response.json())
        .then((next: { size?: number; error?: string }) => {
          if (!active || requestId !== syncRequest) return;
          if (next.error) {
            setError(next.error);
            return;
          }
          if (typeof next.size === "number") setSize(next.size);
          invalidate();
          setError(null);
          setBust((value) => value + 1);
        })
        .catch((nextError) => {
          if (active && requestId === syncRequest) setError(String(nextError));
        });
    };

    const es = new EventSource(watchUrl);

    es.addEventListener("connected", () => {
      setWatching(true);
      synchronize();
    });
    es.addEventListener("change", (e) => {
      syncRequest += 1;
      try {
        const d = JSON.parse((e as MessageEvent).data) as { size?: number };
        if (typeof d.size === "number") setSize(d.size);
      } catch { /* ignore */ }
      invalidate();
      setError(null);
      setBust((b) => b + 1);
    });
    const markDisconnected = () => {
      setWatching(false);
    };
    es.addEventListener("error", markDisconnected);

    return () => {
      active = false;
      es.close();
    };
  }, [metaUrl, watchUrl, watchEnabled, invalidate]);

  return { watching, bust, size, error, setError };
}
