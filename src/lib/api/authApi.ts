import { apiFetch } from "./client";
import { getDeviceFingerprint } from "@/lib/utils/fingerprint";
import type { AdminUser, AuthResponse } from "@/types/auth";

export async function login(email: string, password: string) {
  const device_fingerprint = await getDeviceFingerprint();
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password, device_fingerprint },
    skipAuth: true,
  });
}

/** Relies solely on the HttpOnly refresh cookie; no body or bearer token needed. */
export function refresh() {
  return apiFetch<AuthResponse>("/api/auth/refresh", { method: "POST", skipAuth: true });
}

export function logout() {
  return apiFetch<void>("/api/auth/logout", { method: "POST", skipAuth: true });
}

/** Access token is attached automatically by the API client. */
export function me() {
  return apiFetch<AdminUser>("/api/auth/me");
}
