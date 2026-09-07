import { apiFetch } from "./client";
import type {
  PendingRegistration,
  RegistrationDecision,
  RegistrationStatus,
} from "@/types/registration";

/**
 * `GET /api/admin/registrations?status={status}` — exam registrations in a
 * review state. The Bearer token is attached automatically by `apiFetch`;
 * the route is gated server-side by `RequireAccessToken` + `RequireAdmin`.
 *
 * The backend wraps the rows in `{ registrations }`; a bare array or
 * `{ data }` are tolerated too so a shape tweak doesn't break the queue.
 */
export async function getRegistrations(status: RegistrationStatus): Promise<PendingRegistration[]> {
  const res = await apiFetch<
    | PendingRegistration[]
    | { registrations?: PendingRegistration[]; data?: PendingRegistration[] }
    | null
  >(`/api/admin/registrations?status=${encodeURIComponent(status)}`);

  if (Array.isArray(res)) return res;
  return res?.registrations ?? res?.data ?? [];
}

/**
 * `PUT /api/admin/registrations/{id}/review` with body `{ status }` —
 * approves (`"approved"`) or rejects (`"rejected"`) a pending
 * registration. The backend records the acting admin as `reviewed_by`
 * from the access token, not the request body. Bearer token attached
 * automatically.
 */
export function reviewRegistration(id: string, status: RegistrationDecision) {
  return apiFetch<void>(`/api/admin/registrations/${encodeURIComponent(id)}/review`, {
    method: "PUT",
    body: { status },
  });
}

/**
 * `PUT /api/admin/registrations/{id}/unreject` — returns a rejected
 * registration to the pending payment-review queue. The request has no body.
 */
export function unrejectRegistration(id: string) {
  return apiFetch<{ id: string; status: "pending" }>(
    `/api/admin/registrations/${encodeURIComponent(id)}/unreject`,
    { method: "PUT" },
  );
}
