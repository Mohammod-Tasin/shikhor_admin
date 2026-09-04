/**
 * Mirrors the Go backend's pending-user record returned by
 * `GET /api/admin/users?status=pending`. These are accounts that have
 * uploaded a KYC `verification_doc` and are awaiting a manual admin
 * decision.
 *
 * Only `user_id` and `verification_doc` are relied on as always-present;
 * the display fields are optional so a sparse record still renders without
 * throwing, and `full_name` is accepted as an alias for `name`.
 */
export interface PendingUser {
  user_id: string;
  name?: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  institution?: string;
  level?: string;
  /** Auth-gated URL (absolute or API-relative) of the uploaded document. */
  verification_doc: string;
  verification_status?: string;
  created_at?: string;
}

/** The two terminal states an admin can move a pending user to. */
export type VerificationDecision = "verified" | "rejected";

/** Best-effort display name for a pending user. */
export function pendingUserName(user: PendingUser): string {
  return user.name?.trim() || user.full_name?.trim() || user.email?.trim() || user.user_id;
}
