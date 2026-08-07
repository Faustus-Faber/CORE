import { useEffect, useState } from "react";

/**
 * Fetches an image with credentials (cookies) and returns an object URL.
 * This is needed because the backend now requires authentication for /uploads/* files,
 * and plain <img src> tags cannot send cookies.
 */
export function useAuthenticatedImageUrl(url: string | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) return null;
        return res.blob();
      })
      .then((blob) => {
        if (cancelled || !blob) {
          if (!cancelled) setObjectUrl(null);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setObjectUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return objectUrl;
}
