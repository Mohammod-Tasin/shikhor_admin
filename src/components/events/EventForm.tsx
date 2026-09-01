"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { createEvent, updateEvent } from "@/lib/api/eventsApi";
import { datetimeLocalToISO, isoToDatetimeLocal } from "@/lib/utils/datetime";
import type { EventResponse } from "@/types/event";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";

interface EventFormProps {
  /** When provided, the form edits this event via PUT; otherwise it creates one via POST. */
  event?: EventResponse | null;
  onSuccess: (event: EventResponse) => void;
}

interface FieldErrors {
  title?: string;
  event_date?: string;
}

export function EventForm({ event, onSuccess }: EventFormProps) {
  const isEditing = Boolean(event);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(
    event?.event_date ? isoToDatetimeLocal(event.event_date) : "",
  );
  const [isActive, setIsActive] = useState(event?.is_active ?? false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = "Title is required.";
    if (!eventDate) errors.event_date = "Event date is required.";
    return errors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSavedMessage(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    let eventDateISO: string;
    try {
      eventDateISO = datetimeLocalToISO(eventDate);
    } catch {
      setFieldErrors((prev) => ({ ...prev, event_date: "Enter a valid date and time." }));
      return;
    }

    setSubmitting(true);
    try {
      // Images are managed manually on the client frontend, so the admin
      // form always sends an empty image_url to satisfy the backend DTO.
      const payload = {
        title: title.trim(),
        description,
        image_url: "",
        event_date: eventDateISO,
        is_active: isActive,
      };

      const result =
        isEditing && event
          ? await updateEvent(event.id, payload)
          : await createEvent(payload);

      setSavedMessage(isEditing ? "Event updated." : "Event created.");
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
        id="title"
        label="Title"
        required
        value={title}
        error={fieldErrors.title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="National Math Olympiad 2026"
      />

      <Textarea
        id="description"
        label="Description"
        rows={5}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the event shown on the public site…"
      />

      <Input
        id="event_date"
        label="Event date & time"
        type="datetime-local"
        required
        value={eventDate}
        error={fieldErrors.event_date}
        onChange={(e) => setEventDate(e.target.value)}
        hint="Stored in UTC; shown here in your local timezone."
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <Toggle
          checked={isActive}
          onChange={setIsActive}
          label="Active"
          description="Only one event should be active at a time — the client site renders the active one."
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
          {isEditing ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
