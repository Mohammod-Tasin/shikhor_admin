"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { createEvent, updateEvent, uploadEventImage } from "@/lib/api/eventsApi";
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
  image?: string;
}

const MAX_IMAGE_BYTES = 100 * 1024 * 1024;

export function EventForm({ event, onSuccess }: EventFormProps) {
  const isEditing = Boolean(event);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(
    event?.event_date ? isoToDatetimeLocal(event.event_date) : "",
  );
  const [isActive, setIsActive] = useState(event?.is_active ?? false);

  // Image: an already-hosted URL from the existing event, plus an optional
  // locally-selected File that must be uploaded on submit before its URL
  // replaces the existing one.
  const [existingImageUrl, setExistingImageUrl] = useState(event?.image_url ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Object URLs for the local preview must be revoked to avoid leaking.
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    setFormError(null);
    const file = e.target.files?.[0] ?? null;

    if (file && !file.type.startsWith("image/")) {
      setImageFile(null);
      setFieldErrors((prev) => ({ ...prev, image: "Please choose an image file." }));
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      setImageFile(null);
      setFieldErrors((prev) => ({ ...prev, image: "Image must be 100 MB or smaller." }));
      return;
    }
    setImageFile(file);
  }

  function clearSelectedFile() {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
    setStatusText(null);

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
      // Step 1: if a new file was picked, upload it first and use the URL
      // the backend returns. Any failure here aborts the whole submit so
      // we never save an event pointing at a missing image.
      let imageUrl = existingImageUrl.trim();
      if (imageFile) {
        setStatusText("Uploading image…");
        try {
          imageUrl = await uploadEventImage(imageFile);
        } catch (err) {
          setFormError(
            err instanceof ApiError
              ? `Image upload failed: ${err.message}`
              : "Image upload failed. Please try again.",
          );
          return;
        }
      }

      // Step 2: build the Event payload with the resolved image URL and a
      // strict UTC ISO-8601 event_date.
      setStatusText(isEditing ? "Saving changes…" : "Creating event…");
      const payload = {
        title: title.trim(),
        description,
        image_url: imageUrl,
        event_date: eventDateISO,
        is_active: isActive,
      };

      const result =
        isEditing && event
          ? await updateEvent(event.id, payload)
          : await createEvent(payload);

      setExistingImageUrl(result.image_url);
      clearSelectedFile();
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
      setStatusText(null);
    }
  }

  const displayImage = previewUrl ?? (existingImageUrl.trim() || null);

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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image" className="text-sm font-medium text-ink-900">
          Event image
        </label>
        <input
          ref={fileInputRef}
          id="image"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {fieldErrors.image ? (
          <p className="text-sm text-red-600">{fieldErrors.image}</p>
        ) : (
          <p className="text-xs text-ink-500">
            {imageFile
              ? "New image selected — it will be uploaded when you save."
              : existingImageUrl
                ? "Leave empty to keep the current image."
                : "PNG or JPG, up to 100 MB. Optional."}
          </p>
        )}

        {displayImage && (
          <div className="mt-2 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImage}
              alt="Event banner preview"
              className="h-24 w-40 rounded-lg border border-slate-200 object-cover"
            />
            {imageFile && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSelectedFile}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>

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
        {statusText && <span className="text-sm text-ink-500">{statusText}</span>}
      </div>
    </form>
  );
}
