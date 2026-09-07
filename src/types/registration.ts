/**
 * Mirrors the Go backend's `dto.AdminRegistrationResponse`, one row of the
 * exam-registration payment review queue returned by
 * `GET /api/admin/registrations?status={status}`.
 *
 * A student has sent an event's registration fee to its bKash/Nagad number
 * and submitted the wallet transaction ID; an admin checks it against
 * their payment statement and approves or rejects.
 */
export interface PendingRegistration {
  id: string;
  student_name?: string | null;
  student_email: string;
  event_id: string;
  event_title: string;
  payment_method: "bkash" | "nagad";
  /** The number the student paid from. */
  sender_number: string;
  transaction_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
}

/** States exposed in the admin payment-review queue. */
export type RegistrationStatus = "pending" | "approved" | "rejected";

/** The two terminal states an admin can move a pending registration to. */
export type RegistrationDecision = "approved" | "rejected";

/** Best-effort display name for a pending registration's student. */
export function registrationStudentName(reg: PendingRegistration): string {
  return reg.student_name?.trim() || reg.student_email?.trim() || "Unknown student";
}
