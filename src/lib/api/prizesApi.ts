import { apiFetch } from "./client";
import type { PrizeListResponse, PrizeRequest, PrizeResponse } from "@/types/prize";

/**
 * `GET /api/admin/events/{eventId}/prizes` — every prize tier for the
 * event, ordered by rank_from. The `Authorization: Bearer <token>` header
 * is attached automatically by `apiFetch`; the route is gated by the
 * backend's admin middleware. Same response shape as the public
 * `GET /api/client/events/{eventId}/prizes`, unwrapped the same way
 * `roundsApi.ts`'s `listRounds` unwraps `{ rounds, count }`.
 */
export async function listPrizes(eventId: string): Promise<PrizeResponse[]> {
  const res = await apiFetch<PrizeListResponse>(
    `/api/admin/events/${encodeURIComponent(eventId)}/prizes`,
  );
  return res.prizes ?? [];
}

/** `POST /api/admin/events/{eventId}/prizes`. Bearer token attached automatically. */
export function createPrize(eventId: string, payload: PrizeRequest) {
  return apiFetch<PrizeResponse>(`/api/admin/events/${encodeURIComponent(eventId)}/prizes`, {
    method: "POST",
    body: payload,
  });
}

/** `PUT /api/admin/events/{eventId}/prizes/{id}`. */
export function updatePrize(eventId: string, prizeId: string, payload: PrizeRequest) {
  return apiFetch<PrizeResponse>(
    `/api/admin/events/${encodeURIComponent(eventId)}/prizes/${encodeURIComponent(prizeId)}`,
    { method: "PUT", body: payload },
  );
}

/** `DELETE /api/admin/events/{eventId}/prizes/{id}`. */
export function deletePrize(eventId: string, prizeId: string) {
  return apiFetch<void>(
    `/api/admin/events/${encodeURIComponent(eventId)}/prizes/${encodeURIComponent(prizeId)}`,
    { method: "DELETE" },
  );
}
