import { getDeviceFingerprint } from "../utils/fingerprint";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type TokenGetter = () => string | null;
type RefreshHandler = () => Promise<string | null>;
type AuthFailureHandler = () => void;

let getAccessToken: TokenGetter = () => null;
let refreshAccessToken: RefreshHandler = async () => null;
let onAuthFailure: AuthFailureHandler = () => {};
let refreshPromise: Promise<string | null> | null = null;

/**
 * Wires the client to the app's auth state. Called once by AuthProvider on
 * mount so every apiFetch call can attach the current access token and
 * recover from a 401 without any component owning fetch/refresh logic.
 */
export function configureApiClient(config: {
  getAccessToken: TokenGetter;
  refreshAccessToken: RefreshHandler;
  onAuthFailure: AuthFailureHandler;
}) {
  getAccessToken = config.getAccessToken;
  refreshAccessToken = config.refreshAccessToken;
  onAuthFailure = config.onAuthFailure;
}

/**
 * The current in-memory access token, or `null` when no session is active.
 * Exposed for the handful of call sites that must issue an authenticated
 * request outside of `apiFetch` — e.g. fetching an auth-gated media file as
 * a Blob, where the browser cannot attach a Bearer header to an `<img>` or
 * `<iframe>` request on its own.
 */
export function getCurrentAccessToken(): string | null {
  return getAccessToken();
}

/**
 * Coalesces every refresh trigger (401 retry, AuthProvider's proactive
 * timer, and its mount bootstrap) onto a single in-flight refresh call, so
 * concurrent triggers never race two refresh requests against the backend.
 */
export function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    const p: Promise<string | null> = refreshAccessToken().finally(() => {
      // Only clear the slot if it still holds *this* call — `resetRefresh`
      // (invoked right after an interactive login) may already have made
      // room for a newer one that must not be wiped out from under it.
      if (refreshPromise === p) refreshPromise = null;
    });
    refreshPromise = p;
  }
  return refreshPromise;
}

/**
 * Detaches any in-flight shared refresh. Called right after an interactive
 * login: a refresh that started before the login carried the pre-login
 * cookie state (often none at all), so its result is moot and must not be
 * handed to a post-login caller — the next `refreshOnce` starts clean
 * against the freshly issued cookie.
 */
export function resetRefresh(): void {
  refreshPromise = null;
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  /** Skip attaching the access token and skip 401 retry — for endpoints
   * that run before a session exists (login, refresh, logout). */
  skipAuth?: boolean;
  /** Override the default request timeout (e.g. for file uploads). */
  timeoutMs?: number;
}

const REQUEST_TIMEOUT_MS = 12_000;
// Large multipart uploads on slow connections need a generous ceiling so
// the AbortController never cuts off an in-progress upload.
const UPLOAD_TIMEOUT_MS = 300_000;

interface RawResult {
  status: number;
  ok: boolean;
  data: unknown;
}

async function doFetch(path: string, options: FetchOptions, token: string | null): Promise<RawResult> {
  const deviceFingerprint = await getDeviceFingerprint();

  // A FormData body is sent as multipart so the browser can set the
  // Content-Type header (with its boundary) itself — we must not set it.
  const isMultipart = options.body instanceof FormData;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? (isMultipart ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS),
  );

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      signal: controller.signal,
      headers: {
        ...(options.body && !isMultipart ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(deviceFingerprint ? { "X-Device-Fingerprint": deviceFingerprint } : {}),
      },
      body: isMultipart
        ? (options.body as FormData)
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });

    // Read the body here, still inside the abort window. fetch() resolves
    // as soon as the response headers land, so a stalled or half-open body
    // stream would hang res.json() forever if it ran after the timer was
    // cleared — that was the "Signing in…" hang.
    const data = res.status === 204 ? undefined : await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Every request includes credentials so the browser attaches/receives the
 * HttpOnly refresh-token cookie. The access token, when present, is sent
 * as a Bearer header rather than a cookie so it is never persisted by the
 * browser. A 401 on an authenticated request triggers one shared silent
 * refresh; the failed request is retried once with the new token.
 */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const token = options.skipAuth ? null : getAccessToken();
  let res = await doFetch(path, options, token);

  if (res.status === 401 && !options.skipAuth) {
    const newToken = await refreshOnce();
    if (newToken) {
      res = await doFetch(path, options, newToken);
      if (res.status === 401) {
        onAuthFailure();
      }
    } else {
      onAuthFailure();
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const message =
      (res.data && typeof res.data === "object" && "error" in res.data
        ? String((res.data as { error: unknown }).error)
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return res.data as T;
}
