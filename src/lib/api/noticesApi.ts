import { apiFetch } from "./client";
import type { NoticeRequest, NoticeResponse } from "@/types/notice";

/**
 * `GET /api/admin/notices` — every notice, active and inactive. The
 * `Authorization: Bearer <token>` header is attached automatically by
 * `apiFetch`; the route is gated by the backend's admin middleware.
 *
 * Tolerates either a bare array or a `{ data: [...] }` envelope, matching the
 * other admin list endpoints (`adminApi.ts`, `registrationsApi.ts`).
 */
export async function getNotices(): Promise<NoticeResponse[]> {
  const res = await apiFetch<unknown>("/api/admin/notices");
  if (Array.isArray(res)) return res as NoticeResponse[];
  return (res as { data?: NoticeResponse[] })?.data ?? [];
}

/** `POST /api/admin/notices`. Bearer token attached automatically. */
export function createNotice(payload: NoticeRequest) {
  return apiFetch<NoticeResponse>("/api/admin/notices", {
    method: "POST",
    body: payload,
  });
}

/** `PUT /api/admin/notices/{id}`. Bearer token attached automatically. */
export function updateNotice(id: string, payload: NoticeRequest) {
  return apiFetch<NoticeResponse>(`/api/admin/notices/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
  });
}

/** `DELETE /api/admin/notices/{id}`. Backend replies 204. */
export function deleteNotice(id: string) {
  return apiFetch<void>(`/api/admin/notices/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
