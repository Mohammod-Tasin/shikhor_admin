import { apiFetch } from "./client";
import type {
  CandidateResponse,
  ParticipantDecision,
  RoundRequest,
  RoundResponse,
} from "@/types/round";

/**
 * `GET /api/admin/events/{eventId}/rounds` — every round for the event,
 * ordered by round_order (no `your_status`, which is student-specific and
 * only ever appears on the public listing).
 */
export async function listRounds(eventId: string): Promise<RoundResponse[]> {
  const res = await apiFetch<{ rounds: RoundResponse[]; count: number }>(
    `/api/admin/events/${encodeURIComponent(eventId)}/rounds`,
  );
  return res.rounds ?? [];
}

/** `POST /api/admin/events/{eventId}/rounds`. Bearer token attached automatically. */
export function createRound(eventId: string, payload: RoundRequest) {
  return apiFetch<RoundResponse>(`/api/admin/events/${encodeURIComponent(eventId)}/rounds`, {
    method: "POST",
    body: payload,
  });
}

/** `PUT /api/admin/events/{eventId}/rounds/{id}`. Never touches status. */
export function updateRound(eventId: string, id: string, payload: RoundRequest) {
  return apiFetch<RoundResponse>(
    `/api/admin/events/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(id)}`,
    { method: "PUT", body: payload },
  );
}

/** `DELETE /api/admin/events/{eventId}/rounds/{id}`. */
export function deleteRound(eventId: string, id: string) {
  return apiFetch<void>(
    `/api/admin/events/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

/** `POST /api/admin/rounds/{id}/start` — the explicit upcoming->ongoing transition. */
export function startRound(id: string) {
  return apiFetch<RoundResponse>(`/api/admin/rounds/${encodeURIComponent(id)}/start`, {
    method: "POST",
  });
}

/** `POST /api/admin/rounds/{id}/end` — the explicit ongoing->ended transition. */
export function endRound(id: string) {
  return apiFetch<RoundResponse>(`/api/admin/rounds/${encodeURIComponent(id)}/end`, {
    method: "POST",
  });
}

/**
 * `GET /api/admin/rounds/{id}/candidates` — only returns data once the
 * round's status is 'ended'.
 */
export async function getCandidates(roundId: string): Promise<CandidateResponse[]> {
  const res = await apiFetch<{ candidates: CandidateResponse[]; count: number }>(
    `/api/admin/rounds/${encodeURIComponent(roundId)}/candidates`,
  );
  return res.candidates ?? [];
}

/**
 * `PUT /api/admin/rounds/{id}/participants` — the body is a bare JSON
 * array of decisions, not an envelope object.
 */
export function setParticipants(roundId: string, decisions: ParticipantDecision[]) {
  return apiFetch<{ round_id: string; updated: number }>(
    `/api/admin/rounds/${encodeURIComponent(roundId)}/participants`,
    { method: "PUT", body: decisions },
  );
}
