import {
  ApiError,
  API_URL,
  apiFetch,
  getCurrentAccessToken,
  refreshOnce,
} from "./client";
import type { PendingUser, VerificationDecision } from "@/types/verification";

/**
 * `GET /api/admin/users?status=pending` — the accounts that have uploaded a
 * KYC document and are waiting on a manual admin decision. The Bearer token
 * is attached automatically by `apiFetch`; the route is gated server-side
 * by `RequireAccessToken` + `RequireAdmin`.
 *
 * The backend may return a bare array or wrap it in `{ users }` / `{ data }`;
 * all three are normalised to a plain `PendingUser[]`.
 */
export async function getPendingUsers(): Promise<PendingUser[]> {
  const res = await apiFetch<
    PendingUser[] | { users?: PendingUser[]; data?: PendingUser[] } | null
  >("/api/admin/users?status=pending");

  if (Array.isArray(res)) return res;
  return res?.users ?? res?.data ?? [];
}

/**
 * `PUT /api/admin/users/{userId}/verify` with body `{ status }` — approves
 * (`"verified"`) or rejects (`"rejected"`) a pending user. Bearer token
 * attached automatically.
 */
export function verifyUser(userId: string, status: VerificationDecision) {
  return apiFetch<void>(`/api/admin/users/${encodeURIComponent(userId)}/verify`, {
    method: "PUT",
    body: { status },
  });
}

/**
 * Fetches an auth-gated media file (image or PDF) as a Blob and returns an
 * object URL suitable for `<img src>` / `<iframe src>`.
 *
 * A plain `<img src="/api/admin/media/…">` cannot carry the
 * `Authorization: Bearer` header the backend requires, so the file has to
 * be pulled with `fetch` first. On a 401 we run one shared silent refresh
 * and retry once, mirroring `apiFetch`'s recovery behaviour.
 *
 * The returned string must be released with `URL.revokeObjectURL` by the
 * caller once the media is no longer displayed.
 */
export async function fetchAuthGatedMedia(url: string): Promise<string> {
  const target = /^https?:\/\//i.test(url)
    ? url
    : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;

  const request = (token: string | null) =>
    fetch(target, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let res = await request(getCurrentAccessToken());

  if (res.status === 401) {
    const newToken = await refreshOnce();
    if (newToken) {
      res = await request(newToken);
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Could not load the document (${res.status}).`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
