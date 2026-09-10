/**
 * Mirrors the Go backend's important-date DTO — the admin-supplied payload for
 * both create (`POST /api/admin/important-dates`) and update
 * (`PUT /api/admin/important-dates/{id}`).
 *
 * `event_date` is a date-only `"YYYY-MM-DD"` string (no time component).
 * `is_active` is optional: omitting it keeps the backend default of `true`, so
 * the admin form only sends it when the toggle is explicitly turned off.
 */
export interface ImportantDateRequest {
  event_date: string;
  title: string;
  details_en: string;
  details_bn: string;
  display_order: number;
  is_active?: boolean;
}

/** Mirrors the Go backend's important-date response. */
export interface ImportantDateResponse {
  id: string;
  event_date: string;
  title: string;
  details_en: string;
  details_bn: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
