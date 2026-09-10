/**
 * Mirrors the Go backend's notice DTO — the admin-supplied payload for both
 * create (`POST /api/admin/notices`) and update (`PUT /api/admin/notices/{id}`).
 *
 * `is_active` is optional: omitting it keeps the backend default of `true`, so
 * the admin form only sends it when the toggle is explicitly turned off.
 */
export interface NoticeRequest {
  text_en: string;
  text_bn: string;
  display_order: number;
  is_active?: boolean;
}

/** Mirrors the Go backend's notice response. */
export interface NoticeResponse {
  id: string;
  text_en: string;
  text_bn: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
