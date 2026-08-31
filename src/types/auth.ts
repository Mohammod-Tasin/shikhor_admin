export interface AdminUser {
  user_id: string;
  email: string;
  phone_number?: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
}

export interface AuthResponse {
  access_token: string;
  access_token_expires_at: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
