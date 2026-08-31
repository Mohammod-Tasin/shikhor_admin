"use client";

import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as authApi from "@/lib/api/authApi";
import { ApiError, configureApiClient, refreshOnce } from "@/lib/api/client";
import type { AdminUser, AuthStatus } from "@/types/auth";

interface AuthContextValue {
  status: AuthStatus;
  user: AdminUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// Refresh a little before actual expiry so an in-flight request never
// races an access token that just died.
const REFRESH_SKEW_MS = 30_000;

// The access token itself is never persisted, so cross-tab sync broadcasts
// a small sentinel instead: other tabs react to it by re-deriving their
// own session from the shared HttpOnly refresh-token cookie rather than by
// reading a token out of storage.
const AUTH_STATUS_KEY = "admin_auth_status";

function broadcastAuthStatus(kind: "in" | "out") {
  try {
    localStorage.setItem(AUTH_STATUS_KEY, `${kind}:${Date.now()}`);
  } catch {
    // Storage can be unavailable (private browsing, disabled) — cross-tab
    // sync is a nicety, not a requirement for this tab to work.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // The API client reads this ref (not React state) so a token set moments
  // ago is visible to the very next fetch, without waiting on a re-render.
  const accessTokenRef = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledRefresh = () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  };

  const clearSession = useCallback(() => {
    clearScheduledRefresh();
    accessTokenRef.current = null;
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Stores the token (ref + state) and schedules the next proactive
  // refresh just before it expires.
  const applyToken = useCallback((token: string, expiresAt: string) => {
    accessTokenRef.current = token;
    setAccessToken(token);

    clearScheduledRefresh();
    const delay = Math.max(new Date(expiresAt).getTime() - Date.now() - REFRESH_SKEW_MS, 0);
    refreshTimer.current = setTimeout(() => {
      void refreshOnce();
    }, delay);
  }, []);

  const syncIdentity = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      setStatus("authenticated");
    } catch (err) {
      // Only a genuine 401 means the session itself is invalid (by this
      // point apiFetch has already tried a silent refresh and lost). A
      // network error, timeout, or 5xx from a flaky backend doesn't mean
      // the admin is logged out — preserve `authenticated` so the caller
      // isn't kicked out mid-flow and can just retry.
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
      }
      throw err;
    }
  }, [clearSession]);

  const applySession = useCallback(
    async (token: string, expiresAt: string) => {
      applyToken(token, expiresAt);
      await syncIdentity();
      broadcastAuthStatus("in");
    },
    [applyToken, syncIdentity],
  );

  // The underlying refresh call. Never invoke this directly outside of
  // configureApiClient's wiring below — every actual refresh trigger goes
  // through the client's `refreshOnce` singleton instead, so concurrent
  // triggers coalesce onto one in-flight request.
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await authApi.refresh();
      applyToken(res.access_token, res.access_token_expires_at);
      return res.access_token;
    } catch {
      clearSession();
      broadcastAuthStatus("out");
      return null;
    }
  }, [applyToken, clearSession]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessTokenRef.current,
      refreshAccessToken,
      onAuthFailure: clearSession,
    });

    void (async () => {
      const token = await refreshOnce();
      if (!token) {
        setStatus("unauthenticated");
        return;
      }
      try {
        await syncIdentity();
      } catch {
        // Bootstrap has no prior authenticated state to preserve — it must
        // still resolve `status` out of "loading" or the app spins forever
        // on a flaky first request.
        clearSession();
      }
    })();

    return clearScheduledRefresh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-tab sync: a "logged out" broadcast clears this tab's session
  // immediately; a "logged in" broadcast makes this tab pull a fresh
  // session over the shared refresh-token cookie.
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== AUTH_STATUS_KEY || !e.newValue) return;
      const kind = e.newValue.split(":")[0];
      if (kind === "out") {
        clearSession();
      } else if (kind === "in") {
        void refreshOnce().then((token) => {
          if (token) void syncIdentity();
        });
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearSession, syncIdentity]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      await applySession(res.access_token, res.access_token_expires_at);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      clearSession();
      broadcastAuthStatus("out");
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{ status, user, accessToken, login, logout, refreshUser: syncIdentity }}
    >
      {children}
    </AuthContext.Provider>
  );
}
