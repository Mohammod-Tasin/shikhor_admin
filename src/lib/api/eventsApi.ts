import { apiFetch } from "./client";
import type { EventRequest, EventResponse } from "@/types/event";

/**
 * Reads the single currently-active event from the public client surface
 * (`GET /api/client/events`). The backend exposes no "list all events" or
 * "get by id" admin endpoint, so the dashboard is built around the active
 * event: view it, edit it, or publish a new one.
 *
 * Returns `null` when nothing is published (backend replies 404).
 */
export async function getActiveEvent(): Promise<EventResponse | null> {
  try {
    return await apiFetch<EventResponse>("/api/client/events", { skipAuth: true });
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Uploads a single image file to `POST /api/admin/events/upload` as
 * multipart/form-data and returns the hosted `image_url` the backend
 * responds with. The `Authorization: Bearer <token>` header and the
 * `X-Device-Fingerprint` header are attached automatically by `apiFetch`;
 * the browser sets the multipart Content-Type/boundary itself.
 */
export async function uploadEventImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await apiFetch<{ image_url: string }>("/api/admin/events/upload", {
    method: "POST",
    body: form,
  });

  if (!res || typeof res.image_url !== "string" || res.image_url === "") {
    throw new Error("Upload succeeded but no image_url was returned.");
  }
  return res.image_url;
}

/**
 * `POST /api/admin/events`. The `Authorization: Bearer <token>` header is
 * attached automatically by `apiFetch` from the in-memory auth state; the
 * route is gated by the backend's `RequireAccessToken` + `RequireAdmin`
 * middleware.
 */
export function createEvent(payload: EventRequest) {
  return apiFetch<EventResponse>("/api/admin/events", {
    method: "POST",
    body: payload,
  });
}

/** `PUT /api/admin/events/{id}`. Bearer token attached automatically. */
export function updateEvent(id: string, payload: EventRequest) {
  return apiFetch<EventResponse>(`/api/admin/events/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
  });
}
