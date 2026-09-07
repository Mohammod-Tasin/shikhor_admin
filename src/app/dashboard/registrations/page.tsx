"use client";

import { useEffect, useState } from "react";
import {
  getRegistrations,
  reviewRegistration,
  unrejectRegistration,
} from "@/lib/api/registrationsApi";
import { ApiError } from "@/lib/api/client";
import {
  registrationStudentName,
  type PendingRegistration,
  type RegistrationDecision,
  type RegistrationStatus,
} from "@/types/registration";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type RowAction = RegistrationDecision | "unrejected";
type RowState = { kind: "idle" } | { kind: "working"; action: RowAction };

function formatSubmitted(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ExamRegistrationsPage() {
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [rejectedRegistrations, setRejectedRegistrations] = useState<PendingRegistration[]>([]);
  const [status, setStatus] = useState<RegistrationStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pending, rejected] = await Promise.all([
          getRegistrations("pending"),
          getRegistrations("rejected"),
        ]);
        if (!cancelled) {
          setPendingRegistrations(pending);
          setRejectedRegistrations(rejected);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load registrations awaiting review.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(reg: PendingRegistration, decision: RegistrationDecision) {
    setActionError(null);
    setNotice(null);
    setRowState((prev) => ({ ...prev, [reg.id]: { kind: "working", action: decision } }));

    try {
      await reviewRegistration(reg.id, decision);
      setPendingRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
      if (decision === "rejected") {
        setRejectedRegistrations((prev) => [{ ...reg, status: "rejected" }, ...prev]);
      }
      setRowState((prev) => {
        const next = { ...prev };
        delete next[reg.id];
        return next;
      });
      setNotice(
        `${registrationStudentName(reg)}'s payment for "${reg.event_title}" was ${
          decision === "approved" ? "approved" : "rejected"
        }.`,
      );
    } catch (err) {
      setRowState((prev) => ({ ...prev, [reg.id]: { kind: "idle" } }));
      setActionError(
        err instanceof ApiError
          ? err.status === 403
            ? "Your account does not have admin access for this action."
            : err.status === 409
              ? "This registration was already reviewed. Refresh to see the current queue."
              : err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  async function unreject(reg: PendingRegistration) {
    setActionError(null);
    setNotice(null);
    setRowState((prev) => ({ ...prev, [reg.id]: { kind: "working", action: "unrejected" } }));

    try {
      await unrejectRegistration(reg.id);
      setRejectedRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
      setPendingRegistrations((prev) => [{ ...reg, status: "pending" }, ...prev]);
      setRowState((prev) => {
        const next = { ...prev };
        delete next[reg.id];
        return next;
      });
      setNotice(`${registrationStudentName(reg)}'s registration was returned to pending review.`);
    } catch (err) {
      setRowState((prev) => ({ ...prev, [reg.id]: { kind: "idle" } }));
      setActionError(
        err instanceof ApiError
          ? err.status === 403
            ? "Your account does not have admin access for this action."
            : err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  const registrations = status === "pending" ? pendingRegistrations : rejectedRegistrations;
  const title = status === "pending" ? "Awaiting review" : "Rejected registrations";
  const emptyMessage =
    status === "pending"
      ? "No exam-registration payments are waiting for review right now."
      : "No exam registrations have been rejected.";

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Exam Registrations
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">Payment verification</h1>
        <p className="mt-1 text-sm text-ink-500">
          Check each transaction ID against your bKash/Nagad statement, then approve or reject
          the registration.
        </p>
      </header>

      {notice && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {actionError}
        </p>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
            <span className="text-xs text-ink-500">
              {loading ? "…" : `${registrations.length} ${status}`}
            </span>
          </div>
          <div className="flex gap-2" role="tablist" aria-label="Registration status">
            {(["pending", "rejected"] as const).map((tab) => (
              <Button
                key={tab}
                role="tab"
                aria-selected={status === tab}
                variant={status === tab ? "primary" : "outline"}
                size="sm"
                onClick={() => setStatus(tab)}
              >
                {tab === "pending" ? "Pending" : "Rejected"}
              </Button>
            ))}
          </div>
        </CardHeader>
        {loading ? (
          <CardContent>
            <p className="text-sm text-ink-500">Loading…</p>
          </CardContent>
        ) : loadError ? (
          <CardContent>
            <p className="text-sm text-red-600">{loadError}</p>
          </CardContent>
        ) : registrations.length === 0 ? (
          <CardContent>
            <p className="text-sm text-ink-500">{emptyMessage}</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Event</th>
                  <th className="px-6 py-3 font-medium">Payment</th>
                  <th className="px-6 py-3 font-medium">Transaction ID</th>
                  <th className="px-6 py-3 font-medium">Submitted</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => {
                  const state = rowState[reg.id] ?? { kind: "idle" };
                  const working = state.kind === "working";
                  return (
                    <tr
                      key={reg.id}
                      className="border-b border-slate-100 align-top last:border-0"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-ink-900">{registrationStudentName(reg)}</p>
                        <p className="text-xs text-ink-500">{reg.student_email}</p>
                      </td>
                      <td className="px-6 py-4 text-ink-700">{reg.event_title}</td>
                      <td className="px-6 py-4 text-ink-700">
                        <span className="font-medium capitalize">{reg.payment_method}</span>
                        <p className="text-xs text-ink-500">from {reg.sender_number}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-ink-900">
                        {reg.transaction_id}
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-500">
                        {formatSubmitted(reg.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {status === "pending" ? (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={working && state.action === "approved"}
                                disabled={working}
                                onClick={() => decide(reg, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                loading={working && state.action === "rejected"}
                                disabled={working}
                                onClick={() => decide(reg, "rejected")}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={working && state.action === "unrejected"}
                              disabled={working}
                              onClick={() => unreject(reg)}
                            >
                              Un-reject
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
