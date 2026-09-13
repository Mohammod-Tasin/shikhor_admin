"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getCandidates, listRounds, setParticipants } from "@/lib/api/roundsApi";
import { candidateName, type CandidateResponse, type ParticipantStatus } from "@/types/round";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const DECISION_LABEL: Record<ParticipantStatus, string> = {
  qualified: "Qualify",
  eliminated: "Eliminate",
  winner: "Winner",
};

/** One row's pending decision. Rank is only meaningful (and only ever
 * sent to the backend) when status is "winner". */
interface Decision {
  status: ParticipantStatus;
  rank?: number;
}

function isPositiveInt(n: number | undefined): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/** Matches the "missing decision" banner's existing truncation so a long
 * candidate list never blows up the error banner. */
function previewNames(names: string[]): string {
  return names.length > 15 ? `${names.slice(0, 15).join(", ")}, and ${names.length - 15} more` : names.join(", ");
}

// Mirrors dashboard/rounds/page.tsx's and dashboard/prizes/page.tsx's own
// LevelBadge — shown here so a mis-click between two similarly-ordered
// rounds of different levels can't go unnoticed while deciding winners.
const LEVEL_BADGE: Record<string, string> = {
  Junior: "bg-sky-100 text-sky-700",
  Secondary: "bg-violet-100 text-violet-700",
  "Higher Secondary": "bg-rose-100 text-rose-700",
};

function LevelBadge({ level }: { level: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_BADGE[level] ?? "bg-slate-100 text-slate-700"}`}
    >
      {level}
    </span>
  );
}

export default function RoundDecisionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-500">Loading…</p>}>
      <RoundDecisionsContent />
    </Suspense>
  );
}

function RoundDecisionsContent() {
  const searchParams = useSearchParams();
  const roundId = searchParams.get("round_id")?.trim() || null;
  const eventId = searchParams.get("event_id")?.trim() || null;

  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [isFinalRound, setIsFinalRound] = useState(false);
  const [roundName, setRoundName] = useState<string | null>(null);
  const [roundLevel, setRoundLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selection, setSelection] = useState<Record<string, Decision>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!roundId || !eventId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const [rows, allRounds] = await Promise.all([getCandidates(roundId), listRounds(eventId)]);
        if (cancelled) return;
        setCandidates(rows);
        const initial: Record<string, Decision> = {};
        for (const c of rows) {
          if (c.existing_status) initial[c.user_id] = { status: c.existing_status, rank: c.existing_rank };
        }
        setSelection(initial);

        const thisRound = allRounds.find((r) => r.id === roundId);
        setIsFinalRound(Boolean(thisRound?.is_final));
        setRoundName(thisRound?.round_name ?? null);
        setRoundLevel(thisRound?.level ?? null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiError && err.status === 409
              ? "This round has not ended yet — candidates are only available once it has."
              : "Could not load candidates for this round.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId, eventId]);

  const availableStatuses = useMemo<ParticipantStatus[]>(
    () => (isFinalRound ? ["qualified", "eliminated", "winner"] : ["qualified", "eliminated"]),
    [isFinalRound],
  );

  if (!roundId || !eventId) {
    return (
      <div>
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Rounds Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">Participant decisions</h1>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-500">
              Open this from a round on the{" "}
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

  function nameFor(userId: string): string {
    const c = candidates.find((c) => c.user_id === userId);
    return c ? candidateName(c) : userId;
  }

  function setRowStatus(userId: string, status: ParticipantStatus) {
    setSelection((prev) => ({ ...prev, [userId]: { ...prev[userId], status } }));
  }

  function setRowRank(userId: string, rank: number | undefined) {
    setSelection((prev) => ({ ...prev, [userId]: { ...prev[userId], rank } }));
  }

  function toggleChecked(userId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleCheckAll() {
    setChecked((prev) => (prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.user_id))));
  }

  function bulkApply(status: ParticipantStatus) {
    setSelection((prev) => {
      const next = { ...prev };
      for (const userId of checked) next[userId] = { ...next[userId], status };
      return next;
    });
  }

  async function handleSubmit() {
    if (!roundId) return;
    setActionError(null);
    setNotice(null);

    const missing = candidates.filter((c) => !selection[c.user_id]);
    if (missing.length > 0) {
      const names = missing.map((c) => candidateName(c));
      setActionError(
        `Missing a decision for ${missing.length} candidate${missing.length === 1 ? "" : "s"}: ${previewNames(names)}.`,
      );
      return;
    }

    const entries = Object.entries(selection);

    const winnersWithoutRank = entries.filter(([, d]) => d.status === "winner" && !isPositiveInt(d.rank));
    if (winnersWithoutRank.length > 0) {
      const names = winnersWithoutRank.map(([userId]) => nameFor(userId));
      setActionError(
        `Enter a rank (a positive whole number) for ${winnersWithoutRank.length} winner${winnersWithoutRank.length === 1 ? "" : "s"}: ${previewNames(names)}.`,
      );
      return;
    }

    const rankToNames = new Map<number, string[]>();
    for (const [userId, d] of entries) {
      if (d.status === "winner" && isPositiveInt(d.rank)) {
        const names = rankToNames.get(d.rank) ?? [];
        names.push(nameFor(userId));
        rankToNames.set(d.rank, names);
      }
    }
    const duplicateRanks = [...rankToNames.entries()].filter(([, names]) => names.length > 1);
    if (duplicateRanks.length > 0) {
      const desc = duplicateRanks.map(([rank, names]) => `rank ${rank} (${names.join(", ")})`).join("; ");
      setActionError(`Each winner needs a unique rank — duplicate: ${desc}.`);
      return;
    }

    const decisions = entries.map(([user_id, d]) =>
      d.status === "winner" ? { user_id, status: d.status, rank: d.rank } : { user_id, status: d.status },
    );
    if (decisions.length === 0) {
      setActionError("Select a decision for at least one candidate.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await setParticipants(roundId, decisions);
      setNotice(`Saved decisions for ${result.updated} candidate${result.updated === 1 ? "" : "s"}.`);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.status === 403
            ? "Your account does not have admin access for this action."
            : err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Rounds Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">Participant decisions</h1>
          {(roundName || roundLevel) && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
              {roundName}
              {roundLevel && <LevelBadge level={roundLevel} />}
            </p>
          )}
          <p className="mt-1 text-sm text-ink-500">
            Qualify or eliminate each candidate{isFinalRound ? ", or mark the event winner." : "."}
          </p>
        </div>
        <Link href={`/dashboard/rounds?event_id=${encodeURIComponent(eventId)}`}>
          <Button variant="ghost" size="sm">
            Back to rounds
          </Button>
        </Link>
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
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Candidates</h2>
            <span className="text-xs text-ink-500">
              {loading ? "…" : `${candidates.length} total`}
            </span>
          </div>
          {!loading && candidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-500">
                {checked.size > 0 ? `${checked.size} selected` : "Bulk apply:"}
              </span>
              {availableStatuses.map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  disabled={checked.size === 0}
                  onClick={() => bulkApply(status)}
                >
                  {DECISION_LABEL[status]}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        {loading ? (
          <CardContent>
            <p className="text-sm text-ink-500">Loading…</p>
          </CardContent>
        ) : loadError ? (
          <CardContent>
            <p className="text-sm text-red-600">{loadError}</p>
          </CardContent>
        ) : candidates.length === 0 ? (
          <CardContent>
            <p className="text-sm text-ink-500">No candidates are eligible for this round.</p>
          </CardContent>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-6 py-3 font-medium">
                      <input
                        type="checkbox"
                        checked={checked.size === candidates.length}
                        onChange={toggleCheckAll}
                        aria-label="Select all candidates"
                      />
                    </th>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 text-right font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const current = selection[c.user_id];
                    return (
                      <tr key={c.user_id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={checked.has(c.user_id)}
                            onChange={() => toggleChecked(c.user_id)}
                            aria-label={`Select ${candidateName(c)}`}
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-ink-900">{candidateName(c)}</td>
                        <td className="px-6 py-4 text-ink-700">{c.email}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center justify-end gap-2">
                              {availableStatuses.map((status) => (
                                <Button
                                  key={status}
                                  variant={
                                    current?.status === status
                                      ? status === "eliminated"
                                        ? "danger"
                                        : "primary"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() => setRowStatus(c.user_id, status)}
                                >
                                  {DECISION_LABEL[status]}
                                </Button>
                              ))}
                            </div>
                            {current?.status === "winner" && (
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={current.rank ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setRowRank(c.user_id, raw === "" ? undefined : Number(raw));
                                }}
                                placeholder="Rank"
                                aria-label={`Rank for ${candidateName(c)}`}
                                className="w-20 text-right"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button loading={submitting} onClick={handleSubmit}>
                Save decisions
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
