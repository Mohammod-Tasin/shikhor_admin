"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { createNotice, updateNotice } from "@/lib/api/noticesApi";
import type { NoticeRequest, NoticeResponse } from "@/types/notice";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";

interface NoticeFormProps {
  /** When provided, the form edits this row via PUT; otherwise it creates one via POST. */
  row?: NoticeResponse | null;
  onSuccess: (row: NoticeResponse) => void;
}

interface FieldErrors {
  text_en?: string;
  text_bn?: string;
  display_order?: string;
}

export function NoticeForm({ row, onSuccess }: NoticeFormProps) {
  const isEditing = Boolean(row);

  const [textEn, setTextEn] = useState(row?.text_en ?? "");
  const [textBn, setTextBn] = useState(row?.text_bn ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    row?.display_order != null ? String(row.display_order) : "0",
  );
  // Backend defaults is_active to true; a new notice starts active.
  const [isActive, setIsActive] = useState(row?.is_active ?? true);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!textEn.trim()) errors.text_en = "English text is required.";
    if (!textBn.trim()) errors.text_bn = "Bangla text is required.";
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
      const payload: NoticeRequest = {
        text_en: textEn.trim(),
        text_bn: textBn.trim(),
        display_order: Number(displayOrder),
      };
      // Omit is_active to keep the backend default (true); only send it when
      // the admin explicitly turned the toggle off.
      if (!isActive) payload.is_active = false;

      const result =
        isEditing && row
          ? await updateNotice(row.id, payload)
          : await createNotice(payload);

      setSavedMessage(isEditing ? "Notice updated." : "Notice created.");
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
      <Textarea
        id="text_en"
        label="Notice — English"
        rows={4}
        value={textEn}
        error={fieldErrors.text_en}
        onChange={(e) => setTextEn(e.target.value)}
      />

      <Textarea
        id="text_bn"
        label="Notice — Bangla"
        rows={4}
        value={textBn}
        error={fieldErrors.text_bn}
        onChange={(e) => setTextBn(e.target.value)}
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
          description="Inactive notices are hidden from the client site but kept here."
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
          {isEditing ? "Save changes" : "Create notice"}
        </Button>
      </div>
    </form>
  );
}
