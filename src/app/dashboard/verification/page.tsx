"use client";

import { useEffect, useState } from "react";
import { getPendingUsers, verifyUser } from "@/lib/api/adminApi";
import { ApiError } from "@/lib/api/client";
import { pendingUserName, type PendingUser, type VerificationDecision } from "@/types/verification";
import { DocumentViewerModal } from "@/components/verification/DocumentViewerModal";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type RowState = { kind: "idle" } | { kind: "working"; decision: VerificationDecision };

export default function UserVerificationPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [viewing, setViewing] = useState<PendingUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pending = await getPendingUsers();
        if (!cancelled) setUsers(pending);
      } catch {
        if (!cancelled) setLoadError("Could not load users awaiting verification.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(user: PendingUser, decision: VerificationDecision) {
    setActionError(null);
    setNotice(null);
    setRowState((prev) => ({ ...prev, [user.user_id]: { kind: "working", decision } }));

    try {
      await verifyUser(user.user_id, decision);
      setUsers((prev) => prev.filter((u) => u.user_id !== user.user_id));
      setRowState((prev) => {
        const next = { ...prev };
        delete next[user.user_id];
        return next;
      });
      setNotice(
        `${pendingUserName(user)} was ${decision === "verified" ? "approved" : "rejected"}.`,
      );
    } catch (err) {
      setRowState((prev) => ({ ...prev, [user.user_id]: { kind: "idle" } }));
      setActionError(
        err instanceof ApiError
          ? err.status === 403
            ? "Your account does not have admin access for this action."
            : err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          User Verification
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">KYC document review</h1>
        <p className="mt-1 text-sm text-ink-500">
          Review the identity documents submitted by users and approve or reject each request.
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
          <h2 className="text-sm font-semibold text-ink-900">Awaiting approval</h2>
          <span className="text-xs text-ink-500">
            {loading ? "…" : `${users.length} pending`}
          </span>
        </CardHeader>
        {loading ? (
          <CardContent>
            <p className="text-sm text-ink-500">Loading…</p>
          </CardContent>
        ) : loadError ? (
          <CardContent>
            <p className="text-sm text-red-600">{loadError}</p>
          </CardContent>
        ) : users.length === 0 ? (
          <CardContent>
            <p className="text-sm text-ink-500">
              No users are waiting for verification right now.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Institution</th>
                  <th className="px-6 py-3 font-medium">Level</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const state = rowState[user.user_id] ?? { kind: "idle" };
                  const working = state.kind === "working";
                  return (
                    <tr
                      key={user.user_id}
                      className="border-b border-slate-100 align-top last:border-0"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-ink-900">{pendingUserName(user)}</p>
                        {user.email && <p className="text-xs text-ink-500">{user.email}</p>}
                      </td>
                      <td className="px-6 py-4 text-ink-700">{user.institution || "—"}</td>
                      <td className="px-6 py-4 text-ink-700">{user.level || "—"}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={working || !user.verification_doc}
                            onClick={() => setViewing(user)}
                          >
                            View Document
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={working && state.decision === "verified"}
                            disabled={working}
                            onClick={() => decide(user, "verified")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={working && state.decision === "rejected"}
                            disabled={working}
                            onClick={() => decide(user, "rejected")}
                          >
                            Reject
                          </Button>
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

      {viewing && viewing.verification_doc && (
        <DocumentViewerModal
          doc={viewing.verification_doc}
          userName={pendingUserName(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
