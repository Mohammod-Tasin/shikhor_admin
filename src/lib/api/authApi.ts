import { apiFetch } from "./client";
import { getDeviceFingerprint } from "@/lib/utils/fingerprint";
import type { AdminUser, AuthResponse } from "@/types/auth";

// The admin console talks to the backend's admin-scoped auth routes
// (/api/auth/admin/*), not the shared /api/auth/* ones the student site
// uses. They run the same backend logic but set a separate refresh cookie
// (distinct name + path), so signing into the admin console and the
// student site in the same browser no longer evicts each other's session.
// Admin login also rejects a non-admin account with 403.
export async function login(email: string, password: string) {
  const device_fingerprint = await getDeviceFingerprint();
  return apiFetch<AuthResponse>("/api/auth/admin/login", {
    method: "POST",
    body: { email, password, device_fingerprint },
    skipAuth: true,
  });
}

/** Relies solely on the HttpOnly refresh cookie; no body or bearer token needed. */
export function refresh() {
  return apiFetch<AuthResponse>("/api/auth/admin/refresh", { method: "POST", skipAuth: true });
}

export function logout() {
  return apiFetch<void>("/api/auth/admin/logout", { method: "POST", skipAuth: true });
}

/** Access token is attached automatically by the API client. */
export function me() {
  return apiFetch<AdminUser>("/api/auth/me");
}
