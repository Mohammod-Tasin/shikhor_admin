/**
 * Converts an ISO / RFC3339 timestamp (as returned by the Go backend) into
 * the `YYYY-MM-DDTHH:mm` string that a native `<input type="datetime-local">`
 * expects, expressed in the browser's local timezone.
 */
export function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Converts a `datetime-local` input value (local wall-clock time, no zone)
 * into a full RFC3339 UTC string that Go's `time.Time` JSON decoder accepts.
 */
export function datetimeLocalToISO(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date");
  }
  return d.toISOString();
}
