/**
 * Mirrors the Go backend's `dto.EventRequest` — the admin-supplied payload
 * for both create (`POST /api/admin/events`) and update
 * (`PUT /api/admin/events/{id}`). `event_date` is serialised as an RFC3339
 * string so Go's `time.Time` can decode it.
 */
export interface EventRequest {
  title: string;
  description: string;
  image_url: string;
  event_date: string;
  is_active: boolean;
  /** Manual bKash/Nagad payment details for exam registration. The backend
   * replaces all event fields on update, so these must be sent on every
   * edit or they reset to blank/zero. */
  bkash_number: string;
  nagad_number: string;
  /** Whole Bangladeshi Taka; 0 means "no fee shown yet". */
  registration_fee: number;
}

/** Mirrors the Go backend's `dto.EventResponse`. */
export interface EventResponse {
  id: string;
  title: string;
  description: string;
  image_url: string;
  event_date: string;
  is_active: boolean;
  bkash_number: string;
  nagad_number: string;
  registration_fee: number;
  created_at: string;
  updated_at: string;
}
