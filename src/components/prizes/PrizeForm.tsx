"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { createPrize, updatePrize } from "@/lib/api/prizesApi";
import type { PrizeRequest, PrizeResponse } from "@/types/prize";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

interface PrizeFormProps {
  eventId: string;
  /** When provided, the form edits this tier via PUT; otherwise it creates one via POST. */
  prize?: PrizeResponse | null;
  onSuccess: (prize: PrizeResponse) => void;
}

interface FieldErrors {
  rank_from?: string;
  rank_to?: string;
  prize_name?: string;
}

export function PrizeForm({ eventId, prize, onSuccess }: PrizeFormProps) {
  const isEditing = Boolean(prize);

  const [rankFrom, setRankFrom] = useState(prize?.rank_from != null ? String(prize.rank_from) : "");
  const [rankTo, setRankTo] = useState(prize?.rank_to != null ? String(prize.rank_to) : "");
  const [prizeName, setPrizeName] = useState(prize?.prize_name ?? "");
  const [prizeDescription, setPrizeDescription] = useState(prize?.prize_description ?? "");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Only rank_from <= rank_to is checked here — the backend also enforces
  // it, but catching it early avoids a round trip. Overlapping ranges are
  // deliberately NOT checked client-side; that error surfaces through the
  // normal formError path below, same as the round-form's duplicate-final
  // check.
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const from = Number(rankFrom);
    const to = Number(rankTo);
    if (!Number.isInteger(from) || from <= 0) {
      errors.rank_from = "Enter a whole number (1 or more).";
    }
    if (!Number.isInteger(to) || to <= 0) {
      errors.rank_to = "Enter a whole number (1 or more).";
    }
    if (!errors.rank_from && !errors.rank_to && from > to) {
      errors.rank_to = "Rank to must be greater than or equal to rank from.";
    }
    if (!prizeName.trim()) errors.prize_name = "Prize name is required.";
    return errors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSavedMessage(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const payload: PrizeRequest = {
        rank_from: Number(rankFrom),
        rank_to: Number(rankTo),
        prize_name: prizeName.trim(),
      };
      if (prizeDescription.trim()) payload.prize_description = prizeDescription.trim();

      const result =
        isEditing && prize
          ? await updatePrize(eventId, prize.id, payload)
          : await createPrize(eventId, payload);

      setSavedMessage(isEditing ? "Prize updated." : "Prize created.");
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          id="rank_from"
          label="Rank from"
          type="number"
          min={1}
          step={1}
          required
          value={rankFrom}
          error={fieldErrors.rank_from}
          onChange={(e) => setRankFrom(e.target.value)}
          placeholder="1"
        />
        <Input
          id="rank_to"
          label="Rank to"
          type="number"
          min={1}
          step={1}
          required
          value={rankTo}
          error={fieldErrors.rank_to}
          onChange={(e) => setRankTo(e.target.value)}
          placeholder="1"
          hint="Same as rank from for a single placement, e.g. 1-1 for 1st place."
        />
      </div>

      <Input
        id="prize_name"
        label="Prize name"
        required
        value={prizeName}
        error={fieldErrors.prize_name}
        onChange={(e) => setPrizeName(e.target.value)}
        placeholder="Gold medal + BDT 5000"
      />

      <Textarea
        id="prize_description"
        label="Description (optional)"
        rows={3}
        value={prizeDescription}
        onChange={(e) => setPrizeDescription(e.target.value)}
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
          {isEditing ? "Save changes" : "Create prize"}
        </Button>
      </div>
    </form>
  );
}
