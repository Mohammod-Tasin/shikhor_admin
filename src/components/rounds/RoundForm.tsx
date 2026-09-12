"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { createRound, updateRound } from "@/lib/api/roundsApi";
import { datetimeLocalToISO, isoToDatetimeLocal } from "@/lib/utils/datetime";
import type { RoundRequest, RoundResponse } from "@/types/round";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface RoundFormProps {
  eventId: string;
  /** When provided, the form edits this round via PUT; otherwise it creates one via POST. */
  round?: RoundResponse | null;
  /**
   * round_order values already used by this event's other rounds (excluding
   * the one being edited), used only for the client-side contiguity warning
   * below — the backend does not enforce or need this.
   */
  siblingOrders: number[];
  onSuccess: (round: RoundResponse) => void;
}

interface FieldErrors {
  round_name?: string;
  start_at?: string;
  duration_minutes?: string;
  round_order?: string;
}

export function RoundForm({ eventId, round, siblingOrders, onSuccess }: RoundFormProps) {
  const isEditing = Boolean(round);

  const [roundName, setRoundName] = useState(round?.round_name ?? "");
  const [startAt, setStartAt] = useState(round?.start_at ? isoToDatetimeLocal(round.start_at) : "");
  const [durationMinutes, setDurationMinutes] = useState(
    round?.duration_minutes != null ? String(round.duration_minutes) : "",
  );
  const [roundOrder, setRoundOrder] = useState(
    round?.round_order != null ? String(round.round_order) : "",
  );
  const [gapWarningDismissed, setGapWarningDismissed] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // A gap (e.g. order 3 saved before order 2 exists) permanently locks every
  // later round out, since round N looks up round N-1 by exact round_order.
  // Not enforced server-side, so just a dismissible client-side nudge.
  const orderNum = Number(roundOrder);
  const hasGap =
    roundOrder.trim() !== "" &&
    Number.isInteger(orderNum) &&
    orderNum > 1 &&
    !siblingOrders.includes(orderNum - 1);

  useEffect(() => {
    setGapWarningDismissed(false);
  }, [roundOrder]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!roundName.trim()) errors.round_name = "Round name is required.";
    if (!startAt) errors.start_at = "Start date & time is required.";
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration <= 0) {
      errors.duration_minutes = "Enter a whole number of minutes greater than 0.";
    }
    const order = Number(roundOrder);
    if (!Number.isInteger(order) || order <= 0) {
      errors.round_order = "Enter a whole number (1 or more).";
    }
    return errors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSavedMessage(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    let startAtISO: string;
    try {
      startAtISO = datetimeLocalToISO(startAt);
    } catch {
      setFieldErrors((prev) => ({ ...prev, start_at: "Enter a valid date and time." }));
      return;
    }

    setSubmitting(true);
    try {
      const payload: RoundRequest = {
        round_order: Number(roundOrder),
        round_name: roundName.trim(),
        start_at: startAtISO,
        duration_minutes: Number(durationMinutes),
      };

      const result =
        isEditing && round
          ? await updateRound(eventId, round.id, payload)
          : await createRound(eventId, payload);

      setSavedMessage(isEditing ? "Round updated." : "Round created.");
      onSuccess(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(
          err.status === 403
            ? "Your account does not have admin access for this action."
            : err.message,
        );
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        id="round_name"
        label="Round name"
        required
        value={roundName}
        error={fieldErrors.round_name}
        onChange={(e) => setRoundName(e.target.value)}
        placeholder="Qualifying round"
      />

      <Input
        id="round_order"
        label="Round order"
        type="number"
        min={1}
        step={1}
        required
        value={roundOrder}
        error={fieldErrors.round_order}
        onChange={(e) => setRoundOrder(e.target.value)}
        hint="Position in the event's sequence — 1, 2, 3…"
      />

      {hasGap && !gapWarningDismissed && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p>
            Round order {orderNum} has no round {orderNum - 1} yet for this event. This will make
            every round after the gap permanently unenterable until it&apos;s filled.
          </p>
          <button
            type="button"
            onClick={() => setGapWarningDismissed(true)}
            className="shrink-0 text-xs font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <Input
        id="start_at"
        label="Start date & time"
        type="datetime-local"
        required
        value={startAt}
        error={fieldErrors.start_at}
        onChange={(e) => setStartAt(e.target.value)}
        hint="Stored in UTC; shown here in your local timezone."
      />

      <Input
        id="duration_minutes"
        label="Duration (minutes)"
        type="number"
        min={1}
        step={1}
        required
        value={durationMinutes}
        error={fieldErrors.duration_minutes}
        onChange={(e) => setDurationMinutes(e.target.value)}
        placeholder="60"
      />

      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {formError}
        </p>
      )}
      {savedMessage && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {savedMessage}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={submitting}>
          {isEditing ? "Save changes" : "Create round"}
        </Button>
      </div>
    </form>
  );
}
