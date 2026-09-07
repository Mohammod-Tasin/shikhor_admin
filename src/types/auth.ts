export interface AdminUser {
  user_id: string;
  email: string;
  // Field names mirror the Go backend's GET /api/auth/me payload exactly.
  // Phone auth was removed backend-side, so there is no phone_number /
  // phone-verified field to carry here.
  email_verified: boolean;
}

export interface AuthResponse {
  access_token: string;
  access_token_expires_at: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
