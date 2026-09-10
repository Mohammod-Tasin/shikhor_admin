"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { deleteNotice, getNotices } from "@/lib/api/noticesApi";
import type { NoticeResponse } from "@/types/notice";
import { NoticeForm } from "@/components/notices/NoticeForm";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; row: NoticeResponse };

type RowState = { kind: "idle" } | { kind: "deleting" };

function sortByOrder(rows: NoticeResponse[]): NoticeResponse[] {
  return [...rows].sort((a, b) => a.display_order - b.display_order);
}

export default function NoticesPage() {
  const [rows, setRows] = useState<NoticeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getNotices();
        if (!cancelled) setRows(sortByOrder(data));
      } catch {
        if (!cancelled) setLoadError("Could not load notices.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSuccess(saved: NoticeResponse) {
    setRows((prev) =>
      sortByOrder(
        prev.some((r) => r.id === saved.id)
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [...prev, saved],
      ),
    );
    setNotice(mode.kind === "edit" ? "Notice updated." : "Notice created.");
    setActionError(null);
    setMode({ kind: "list" });
  }

  async function remove(row: NoticeResponse) {
    const label = row.text_en.trim().slice(0, 40) || "this notice";
    if (!window.confirm(`Delete "${label}"?`)) return;
    setActionError(null);
    setNotice(null);
    setRowState((prev) => ({ ...prev, [row.id]: { kind: "deleting" } }));

    try {
      await deleteNotice(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setRowState((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setNotice("Notice deleted.");
    } catch (err) {
      setRowState((prev) => ({ ...prev, [row.id]: { kind: "idle" } }));
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
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Notice Board
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">Notices</h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage the notices shown on the OlympiadNext client site.
          </p>
        </div>
        {mode.kind === "list" && (
          <Button variant="outline" size="sm" onClick={() => setMode({ kind: "create" })}>
            New notice
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
            <h2 className="text-sm font-semibold text-ink-900">All notices</h2>
            <span className="text-xs text-ink-500">
              {loading ? "…" : `${rows.length} total`}
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
          ) : rows.length === 0 ? (
            <CardContent>
              <p className="text-sm text-ink-500">No notices yet.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-6 py-3 font-medium">Order</th>
                    <th className="px-6 py-3 font-medium">Notice</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const state = rowState[row.id] ?? { kind: "idle" };
                    const deleting = state.kind === "deleting";
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 align-top last:border-0"
                      >
                        <td className="px-6 py-4 text-ink-700">{row.display_order}</td>
                        <td className="px-6 py-4">
                          <p className="line-clamp-2 font-medium text-ink-900">{row.text_en}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{row.text_bn}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={
                              row.is_active
                                ? "font-medium text-emerald-700"
                                : "font-medium text-ink-500"
                            }
                          >
                            {row.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deleting}
                              onClick={() => setMode({ kind: "edit", row })}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              loading={deleting}
                              disabled={deleting}
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
              {mode.kind === "edit" ? "Edit notice" : "Create notice"}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setMode({ kind: "list" })}>
              Cancel
            </Button>
          </CardHeader>
          <CardContent>
            <NoticeForm
              row={mode.kind === "edit" ? mode.row : null}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
