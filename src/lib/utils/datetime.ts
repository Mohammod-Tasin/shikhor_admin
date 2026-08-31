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
 * Converts a `datetime-local` input value into a strict UTC ISO-8601 /
 * RFC3339 string (`YYYY-MM-DDTHH:mm:ssZ`) that Go's `time.Time` JSON
 * decoder accepts.
 *
 * The input is bare wall-clock time with no zone (`2026-08-31T10:00`).
 * Parsing the components explicitly and building the Date via the local
 * constructor — rather than `new Date(value)` — avoids engine-specific
 * ambiguity and makes the "local time in, UTC out" conversion deliberate,
 * so the timestamp the backend stores matches the moment the admin picked.
 */
export function datetimeLocalToISO(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) {
    throw new Error("Invalid date/time value");
  }
  const [, year, month, day, hour, minute, second] = match;
  const local = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    second ? Number(second) : 0,
    0,
  );
  if (Number.isNaN(local.getTime())) {
    throw new Error("Invalid date/time value");
  }
  // Drop milliseconds for a clean RFC3339 string.
  return local.toISOString().replace(/\.\d{3}Z$/, "Z");
}
