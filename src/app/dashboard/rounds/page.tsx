"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { deleteRound, endRound, listRounds, startRound } from "@/lib/api/roundsApi";
import type { RoundResponse, RoundStatus } from "@/types/round";
import { RoundForm } from "@/components/rounds/RoundForm";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; row: RoundResponse };
type RowAction = "start" | "end" | "delete";
type RowState = { kind: "idle" } | { kind: "working"; action: RowAction };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_BADGE: Record<RoundStatus, string> = {
  upcoming: "bg-slate-100 text-slate-700",
  ongoing: "bg-amber-100 text-amber-800",
  ended: "bg-emerald-100 text-emerald-700",
};

function StatusBadge({ status }: { status: RoundStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[status]}`}
    >
      {status}
    </span>
  );
}

export default function RoundsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Loading…</p>}>
      <RoundsContent />
    </Suspense>
  );
}

function sortByOrder(rows: RoundResponse[]): RoundResponse[] {
  return [...rows].sort((a, b) => a.round_order - b.round_order);
}

function RoundsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id")?.trim() || null;

  const [rows, setRows] = useState<RoundResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const data = await listRounds(eventId);
        if (!cancelled) setRows(sortByOrder(data));
      } catch {
        if (!cancelled) setLoadError("Could not load rounds for this event.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!eventId) {
    return (
      <div>
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Rounds Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">Event rounds</h1>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-500">
              Open rounds management from an event on the{" "}
              <Link href="/dashboard/events" className="text-brand-600 underline">
                Events Management
              </Link>{" "}
              page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleSuccess(saved: RoundResponse) {
    setRows((prev) =>
      sortByOrder(prev.some((r) => r.id === saved.id) ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]),
    );
    setNotice(mode.kind === "edit" ? "Round updated." : "Round created.");
    setActionError(null);
    setMode({ kind: "list" });
  }

  async function start(row: RoundResponse) {
    setActionError(null);
    setNotice(null);
    setRowState((prev) => ({ ...prev, [row.id]: { kind: "working", action: "start" } }));
    try {
      const updated = await startRound(row.id);
      setRows((prev) => sortByOrder(prev.map((r) => (r.id === row.id ? updated : r))));
      setNotice(`"${row.round_name}" started.`);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setRowState((prev) => ({ ...prev, [row.id]: { kind: "idle" } }));
    }
  }

  async function end(row: RoundResponse) {
    setActionError(null);
    setNotice(null);
    setRowState((prev) => ({ ...prev, [row.id]: { kind: "working", action: "end" } }));
    try {
      const updated = await endRound(row.id);
      setRows((prev) => sortByOrder(prev.map((r) => (r.id === row.id ? updated : r))));
      setNotice(`"${row.round_name}" ended. Participant decisions can now be recorded.`);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setRowState((prev) => ({ ...prev, [row.id]: { kind: "idle" } }));
    }
  }

  async function remove(row: RoundResponse) {
    if (!eventId) return;
    if (!window.confirm(`Delete "${row.round_name}"?`)) return;
    setActionError(null);
    setNotice(null);
    setRowState((prev) => ({ ...prev, [row.id]: { kind: "working", action: "delete" } }));
    try {
      await deleteRound(eventId, row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setRowState((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setNotice(`"${row.round_name}" was deleted.`);
    } catch (err) {
      setActionError(describeError(err));
      setRowState((prev) => ({ ...prev, [row.id]: { kind: "idle" } }));
    }
  }

  function describeError(err: unknown): string {
    if (err instanceof ApiError) {
      return err.status === 403
        ? "Your account does not have admin access for this action."
        : err.message;
    }
    return "Something went wrong. Please try again.";
  }

  const siblingOrders = (mode.kind === "edit" ? rows.filter((r) => r.id !== mode.row.id) : rows).map(
    (r) => r.round_order,
  );

  return (
    <div>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Rounds Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">Event rounds</h1>
          <p className="mt-1 text-sm text-ink-500">
            Create, start, end and decide the outcome of this event&apos;s rounds.
          </p>
        </div>
        {mode.kind === "list" && (
          <Button variant="outline" size="sm" onClick={() => setMode({ kind: "create" })}>
            New round
          </Button>
        )}
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

      {mode.kind === "list" ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">All rounds</h2>
            <span className="text-xs text-ink-500">{loading ? "…" : `${rows.length} total`}</span>
          </CardHeader>
          {loading ? (
            <CardContent>
              <p className="text-sm text-ink-500">Loading…</p>
            </CardContent>
          ) : loadError ? (
            <CardContent>
              <p className="text-sm text-red-600">{loadError}</p>
            </CardContent>
          ) : rows.length === 0 ? (
            <CardContent>
              <p className="text-sm text-ink-500">No rounds yet for this event.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-6 py-3 font-medium">Order</th>
                    <th className="px-6 py-3 font-medium">Round name</th>
                    <th className="px-6 py-3 font-medium">Start</th>
                    <th className="px-6 py-3 font-medium">Duration</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const state = rowState[row.id] ?? { kind: "idle" };
                    const working = state.kind === "working";
                    return (
                      <tr key={row.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="px-6 py-4 text-ink-700">{row.round_order}</td>
                        <td className="px-6 py-4 font-medium text-ink-900">{row.round_name}</td>
                        <td className="px-6 py-4 text-ink-700">{formatDate(row.start_at)}</td>
                        <td className="px-6 py-4 text-ink-700">{row.duration_minutes} min</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {row.status === "upcoming" && (
                              <Button
                                variant="primary"
                                size="sm"
                                loading={working && state.action === "start"}
                                disabled={working}
                                onClick={() => start(row)}
                              >
                                Start
                              </Button>
                            )}
                            {row.status === "ongoing" && (
                              <Button
                                variant="primary"
                                size="sm"
                                loading={working && state.action === "end"}
                                disabled={working}
                                onClick={() => end(row)}
                              >
                                End
                              </Button>
                            )}
                            {row.status === "ended" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={working}
                                onClick={() =>
                                  router.push(
                                    `/dashboard/rounds/decisions?round_id=${encodeURIComponent(row.id)}&event_id=${encodeURIComponent(eventId)}`,
                                  )
                                }
                              >
                                Decide participants
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={working}
                              onClick={() => setMode({ kind: "edit", row })}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              loading={working && state.action === "delete"}
                              disabled={working}
                              onClick={() => remove(row)}
                            >
                              Delete
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
      ) : (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">
              {mode.kind === "edit" ? "Edit round" : "Create round"}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setMode({ kind: "list" })}>
              Cancel
            </Button>
          </CardHeader>
          <CardContent>
            <RoundForm
              eventId={eventId}
              round={mode.kind === "edit" ? mode.row : null}
              siblingOrders={siblingOrders}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
