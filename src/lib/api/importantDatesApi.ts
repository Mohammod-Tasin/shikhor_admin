import { apiFetch } from "./client";
import type { ImportantDateRequest, ImportantDateResponse } from "@/types/importantDate";

/**
 * `GET /api/admin/important-dates` — every row, active and inactive. The
 * `Authorization: Bearer <token>` header is attached automatically by
 * `apiFetch`; the route is gated by the backend's admin middleware.
 *
 * The backend wraps the list as `{ important_dates: [...], count: N }`
 * (`dto.ImportantDateListResponse`), mirroring how `roundsApi.ts`'s
 * `listRounds` unwraps `{ rounds, count }`.
 */
export async function getImportantDates(): Promise<ImportantDateResponse[]> {
  const res = await apiFetch<{ important_dates: ImportantDateResponse[]; count: number }>(
    "/api/admin/important-dates",
  );
  return res.important_dates ?? [];
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
