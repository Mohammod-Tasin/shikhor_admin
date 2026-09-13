/**
 * Mirrors the Go backend's `dto.PrizeRequest` — the admin-supplied payload
 * for both create (`POST /api/admin/events/{eventId}/prizes`) and update
 * (`PUT /api/admin/events/{eventId}/prizes/{id}`). `rank_from`/`rank_to`
 * form an inclusive placement range (e.g. 1-1 for "1st place", 2-3 for
 * "2nd-3rd place"). The backend rejects `rank_from > rank_to` and any
 * range that overlaps another prize tier for the same event.
 */
export interface PrizeRequest {
  rank_from: number;
  rank_to: number;
  prize_name: string;
  prize_description?: string;
}

/** Mirrors the Go backend's prize response — identical on the admin and
 * public (`GET /api/client/events/{eventId}/prizes`) surfaces, since a
 * prize tier has no draft/active state to distinguish them. */
export interface PrizeResponse {
  id: string;
  event_id: string;
  rank_from: number;
  rank_to: number;
  prize_name: string;
  prize_description?: string;
  created_at: string;
  updated_at: string;
}

/** `{ prizes, count }` envelope returned by both the admin and public
 * list endpoints. */
export interface PrizeListResponse {
  prizes: PrizeResponse[];
  count: number;
}
