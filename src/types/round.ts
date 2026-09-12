/**
 * Mirrors the Go backend's `dto.RoundRequest` — the admin-supplied payload
 * for both create (`POST /api/admin/events/{eventId}/rounds`) and update
 * (`PUT /api/admin/events/{eventId}/rounds/{id}`). `start_at` is serialised
 * as an RFC3339 string, same convention as `EventRequest.event_date`.
 */
export interface RoundRequest {
  round_order: number;
  round_name: string;
  start_at: string;
  duration_minutes: number;
}

/**
 * A round's lifecycle: 'upcoming' until an admin starts it, 'ongoing'
 * while students may enter, then 'ended' once closed for review.
 * Transitions only move forward, via the dedicated start/end endpoints.
 */
export type RoundStatus = "upcoming" | "ongoing" | "ended";

/** Mirrors the Go backend's `dto.RoundResponse`. */
export interface RoundResponse {
  id: string;
  event_id: string;
  round_order: number;
  round_name: string;
  start_at: string;
  duration_minutes: number;
  status: RoundStatus;
  created_at: string;
  updated_at: string;
}

/**
 * An admin's decision for one student in one round. 'winner' is only
 * accepted by the backend on an event's highest-numbered round.
 */
export type ParticipantStatus = "qualified" | "eliminated" | "winner";

/**
 * Mirrors the Go backend's `dto.CandidateResponse`, one row of
 * `GET /api/admin/rounds/{id}/candidates` — only populated once the round
 * has ended. `existing_status` is set when the admin already decided this
 * student in this round, letting the UI pre-select it.
 */
export interface CandidateResponse {
  user_id: string;
  full_name?: string | null;
  email: string;
  existing_status?: ParticipantStatus | null;
}

/** One element of the bare-array body for `PUT /api/admin/rounds/{id}/participants`. */
export interface ParticipantDecision {
  user_id: string;
  status: ParticipantStatus;
}

/** Best-effort display name for a round candidate. */
export function candidateName(candidate: CandidateResponse): string {
  return candidate.full_name?.trim() || candidate.email;
}
