"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { createImportantDate, updateImportantDate } from "@/lib/api/importantDatesApi";
import type { ImportantDateRequest, ImportantDateResponse } from "@/types/importantDate";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";

interface ImportantDateFormProps {
  /** When provided, the form edits this row via PUT; otherwise it creates one via POST. */
  row?: ImportantDateResponse | null;
  onSuccess: (row: ImportantDateResponse) => void;
}

interface FieldErrors {
  event_date?: string;
  title?: string;
  details_en?: string;
  details_bn?: string;
  display_order?: string;
}

export function ImportantDateForm({ row, onSuccess }: ImportantDateFormProps) {
  const isEditing = Boolean(row);

  // A native <input type="date"> value is already "YYYY-MM-DD" — no conversion.
  const [eventDate, setEventDate] = useState(row?.event_date ?? "");
  const [title, setTitle] = useState(row?.title ?? "");
  const [detailsEn, setDetailsEn] = useState(row?.details_en ?? "");
  const [detailsBn, setDetailsBn] = useState(row?.details_bn ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    row?.display_order != null ? String(row.display_order) : "0",
  );
  // Backend defaults is_active to true; a new row starts active.
  const [isActive, setIsActive] = useState(row?.is_active ?? true);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!eventDate) errors.event_date = "Date is required.";
    if (!title.trim()) errors.title = "Title is required.";
    if (!detailsEn.trim()) errors.details_en = "English details are required.";
    if (!detailsBn.trim()) errors.details_bn = "Bangla details are required.";
    const order = Number(displayOrder);
    if (!Number.isInteger(order) || order < 0) {
      errors.display_order = "Enter a whole number (0 or more).";
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

    setSubmitting(true);
    try {
      const payload: ImportantDateRequest = {
        event_date: eventDate,
        title: title.trim(),
        details_en: detailsEn.trim(),
        details_bn: detailsBn.trim(),
        display_order: Number(displayOrder),
      };
      // Omit is_active to keep the backend default (true); only send it when
      // the admin explicitly turned the toggle off.
      if (!isActive) payload.is_active = false;

      const result =
        isEditing && row
          ? await updateImportantDate(row.id, payload)
          : await createImportantDate(payload);

      setSavedMessage(isEditing ? "Important date updated." : "Important date created.");
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
        id="event_date"
        label="Date"
        type="date"
        required
        value={eventDate}
        error={fieldErrors.event_date}
        onChange={(e) => setEventDate(e.target.value)}
      />

      <Input
        id="title"
        label="Title"
        required
        value={title}
        error={fieldErrors.title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Registration deadline"
      />

      <Textarea
        id="details_en"
        label="Details — English"
        rows={4}
        value={detailsEn}
        error={fieldErrors.details_en}
        onChange={(e) => setDetailsEn(e.target.value)}
      />

      <Textarea
        id="details_bn"
        label="Details — Bangla"
        rows={4}
        value={detailsBn}
        error={fieldErrors.details_bn}
        onChange={(e) => setDetailsBn(e.target.value)}
      />

      <Input
        id="display_order"
        label="Display order"
        type="number"
        min={0}
        step={1}
        value={displayOrder}
        error={fieldErrors.display_order}
        onChange={(e) => setDisplayOrder(e.target.value)}
        hint="Lower numbers show first on the client site."
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <Toggle
          checked={isActive}
          onChange={setIsActive}
          label="Active"
          description="Inactive entries are hidden from the client site but kept here."
        />
      </div>

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
          {isEditing ? "Save changes" : "Create important date"}
        </Button>
      </div>
    </form>
  );
}
