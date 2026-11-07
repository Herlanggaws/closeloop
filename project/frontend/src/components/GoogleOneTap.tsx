"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { API_URL, setAccessToken } from "@/lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (listener?: (moment: { isNotDisplayed: () => boolean; getNotDisplayedReason: () => string }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export function GoogleOneTap() {
  const [clientId, setClientId] = useState<string | null>(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null
  );
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // If user already logged in, do not show One Tap prompt
    if (typeof window !== "undefined" && localStorage.getItem("closeloop_access")) {
      return;
    }

    if (!clientId) {
      fetch(`${API_URL}/api/auth/google/config`)
        .then((res) => res.json())
        .then((data: { client_id?: string }) => {
          if (data.client_id) {
            setClientId(data.client_id);
          }
        })
        .catch(() => {
          // Ignore network errors if backend is unavailable or not configured
        });
    }
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !scriptLoaded || !window.google?.accounts?.id) {
      return;
    }

    // Do not show if user already has an active access token
    if (localStorage.getItem("closeloop_access")) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const res = await fetch(`${API_URL}/api/auth/google/one-tap`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: response.credential }),
              credentials: "include",
            });
            const data = await res.json();
            if (!res.ok || !data.access_token) {
              console.error("One Tap login failed:", data.error?.message);
              return;
            }
            setAccessToken(data.access_token);
            window.location.href = data.is_new ? "/app/onboarding" : "/app/inbox";
          } catch (err) {
            console.error("One Tap network error:", err);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: false,
      });

      window.google.accounts.id.prompt();
    } catch (err) {
      console.error("Failed to initialize Google One Tap:", err);
    }
  }, [clientId, scriptLoaded]);

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => setScriptLoaded(true)}
    />
  );
}
