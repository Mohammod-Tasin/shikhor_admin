"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { getActiveEvent } from "@/lib/api/eventsApi";
import type { EventResponse } from "@/types/event";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OverviewPage() {
  const { user } = useAuth();
  const [activeEvent, setActiveEvent] = useState<EventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const event = await getActiveEvent();
        if (!cancelled) setActiveEvent(event);
      } catch {
        if (!cancelled) setError("Could not load the active event.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">
          Welcome back{user?.email ? `, ${user.email}` : ""}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Manage platform content for the OlympiadNext client site.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Active event</h2>
            <Link
              href="/dashboard/events"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-ink-500">Loading…</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : activeEvent ? (
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-ink-900">{activeEvent.title}</p>
                <p className="text-sm text-ink-500">{formatDate(activeEvent.event_date)}</p>
                <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live on client site
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink-500">No event is currently published.</p>
                <Link
                  href="/dashboard/events"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Create one →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink-900">Session</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">Email</span>
              <span className="font-medium text-ink-900">{user?.email ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Email verified</span>
              <span className="font-medium text-ink-900">
                {user?.is_email_verified ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Auth model</span>
              <span className="font-medium text-ink-900">In-memory token + refresh cookie</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
