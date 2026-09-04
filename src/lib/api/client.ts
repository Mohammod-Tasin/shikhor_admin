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
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
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

async function doFetch(path: string, options: FetchOptions, token: string | null): Promise<Response> {
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
    return await fetch(`${API_URL}${path}`, {
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

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data ? String(data.error) : null) ?? res.statusText;
    throw new ApiError(res.status, message);
  }

  return data as T;
}
