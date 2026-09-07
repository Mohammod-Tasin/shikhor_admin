"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveEvent } from "@/lib/api/eventsApi";
import type { EventResponse } from "@/types/event";
import { EventForm } from "@/components/events/EventForm";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Mode = { kind: "loading" } | { kind: "view" } | { kind: "edit" } | { kind: "create" };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function EventsManagementPage() {
  const router = useRouter();
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = await getActiveEvent();
        if (cancelled) return;
        setEvent(active);
        setMode(active ? { kind: "view" } : { kind: "create" });
      } catch {
        if (!cancelled) {
          setLoadError("Could not load events.");
          setMode({ kind: "view" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSuccess(updated: EventResponse) {
    setEvent(updated);
    setMode({ kind: "view" });
  }

  return (
    <div>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Events Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">Platform events</h1>
          <p className="mt-1 text-sm text-ink-500">
            Create or update the event content shown on the OlympiadNext client site.
          </p>
        </div>
        {mode.kind === "view" && (
          <Button variant="outline" size="sm" onClick={() => setMode({ kind: "create" })}>
            New event
          </Button>
        )}
      </header>

      {loadError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
      )}

      {mode.kind === "loading" && (
        <p className="text-sm text-ink-500">Loading…</p>
      )}

      {mode.kind === "view" && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">
              {event ? "Current active event" : "No active event"}
            </h2>
            {event && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/dashboard/registrations?event_id=${encodeURIComponent(event.id)}`)
                  }
                >
                  View Participants
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMode({ kind: "edit" })}>
                  Edit
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {event ? (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Title" value={event.title} />
                <Field label="Event date" value={formatDate(event.event_date)} />
                <Field label="Status" value={event.is_active ? "Active" : "Inactive"} />
                <Field label="Image URL" value={event.image_url || "—"} />
                <Field label="bKash number" value={event.bkash_number || "—"} />
                <Field label="Nagad number" value={event.nagad_number || "—"} />
                <Field
                  label="Registration fee"
                  value={event.registration_fee ? `৳ ${event.registration_fee}` : "—"}
                />
                <div className="sm:col-span-2">
                  <Field label="Description" value={event.description || "—"} />
                </div>
              </dl>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-ink-500">
                  Nothing is published to the client site right now.
                </p>
                <Button size="sm" onClick={() => setMode({ kind: "create" })}>
                  Create event
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(mode.kind === "edit" || mode.kind === "create") && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">
              {mode.kind === "edit" ? "Edit event" : "Create event"}
            </h2>
            {event && (
              <Button variant="ghost" size="sm" onClick={() => setMode({ kind: "view" })}>
                Cancel
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <EventForm
              event={mode.kind === "edit" ? event : null}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink-900">{value}</dd>
    </div>
  );
}
