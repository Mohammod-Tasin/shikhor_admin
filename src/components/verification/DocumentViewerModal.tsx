"use client";

import { useEffect, useState } from "react";
import { fetchAuthGatedMedia } from "@/lib/api/adminApi";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";

type MediaKind = "image" | "pdf" | "unknown";

/** Guesses how to render the document from its file extension. */
function mediaKindFromUrl(url: string): MediaKind {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/.test(path)) return "image";
  return "unknown";
}

interface DocumentViewerModalProps {
  /** Auth-gated URL of the user's `verification_doc`. */
  doc: string;
  /** Shown in the modal header for context. */
  userName: string;
  onClose: () => void;
}

export function DocumentViewerModal({ doc, userName, onClose }: DocumentViewerModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kind = mediaKindFromUrl(doc);

  useEffect(() => {
    let revoked = false;
    let created: string | null = null;

    (async () => {
      try {
        const url = await fetchAuthGatedMedia(doc);
        if (revoked) {
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        setObjectUrl(url);
      } catch (err) {
        if (revoked) return;
        setError(
          err instanceof ApiError && err.status === 403
            ? "Your account does not have access to this document."
            : "Could not load the document. Please try again.",
        );
      }
    })();

    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [doc]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Verification document for ${userName}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink-900">Verification document</h2>
            <p className="truncate text-xs text-ink-500">{userName}</p>
          </div>
          <div className="flex items-center gap-2">
            {objectUrl && (
              <a
                href={objectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Open in new tab
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="min-h-[60vh] flex-1 overflow-auto bg-slate-50">
          {error ? (
            <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            </div>
          ) : !objectUrl ? (
            <div className="flex h-full min-h-[60vh] items-center justify-center" role="status">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
            </div>
          ) : kind === "image" ? (
            <div className="flex min-h-[60vh] items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={`Verification document for ${userName}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <iframe
              src={objectUrl}
              title={`Verification document for ${userName}`}
              className="h-[70vh] w-full border-0 bg-white"
            />
          )}
        </div>

        {objectUrl && kind === "unknown" && (
          <p className="border-t border-slate-200 px-6 py-3 text-xs text-ink-500">
            Unrecognised file type — if it doesn&apos;t render above, use “Open in new tab”.
          </p>
        )}
      </div>
    </div>
  );
}
