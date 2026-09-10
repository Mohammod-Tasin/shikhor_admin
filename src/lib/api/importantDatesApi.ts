import { apiFetch } from "./client";
import type { ImportantDateRequest, ImportantDateResponse } from "@/types/importantDate";

/**
 * `GET /api/admin/important-dates` — every row, active and inactive. The
 * `Authorization: Bearer <token>` header is attached automatically by
 * `apiFetch`; the route is gated by the backend's admin middleware.
 *
 * Tolerates either a bare array or a `{ data: [...] }` envelope, matching the
 * other admin list endpoints (`adminApi.ts`, `registrationsApi.ts`).
 */
export async function getImportantDates(): Promise<ImportantDateResponse[]> {
  const res = await apiFetch<unknown>("/api/admin/important-dates");
  if (Array.isArray(res)) return res as ImportantDateResponse[];
  return (res as { data?: ImportantDateResponse[] })?.data ?? [];
}

/** `POST /api/admin/important-dates`. Bearer token attached automatically. */
export function createImportantDate(payload: ImportantDateRequest) {
  return apiFetch<ImportantDateResponse>("/api/admin/important-dates", {
    method: "POST",
    body: payload,
  });
}

/** `PUT /api/admin/important-dates/{id}`. Bearer token attached automatically. */
export function updateImportantDate(id: string, payload: ImportantDateRequest) {
  return apiFetch<ImportantDateResponse>(
    `/api/admin/important-dates/${encodeURIComponent(id)}`,
    { method: "PUT", body: payload },
  );
}

/** `DELETE /api/admin/important-dates/{id}`. Backend replies 204. */
export function deleteImportantDate(id: string) {
  return apiFetch<void>(`/api/admin/important-dates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
