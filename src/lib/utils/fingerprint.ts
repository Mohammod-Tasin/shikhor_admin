let cachedVisitorId: string | undefined;
let inFlight: Promise<string | undefined> | null = null;

/**
 * Silently derives a device fingerprint. The Go backend's
 * `RequireAccessToken` middleware enforces single-device sessions: every
 * authenticated request must carry an `X-Device-Fingerprint` header that
 * matches the fingerprint captured at login, or the access token is
 * treated as superseded. Dynamically imported so the fingerprinting
 * library (browser-only APIs) never loads during Next.js SSR. Failures
 * are swallowed since auth must degrade gracefully when fingerprinting
 * doesn't work.
 */
export async function getDeviceFingerprint(): Promise<string | undefined> {
  if (cachedVisitorId !== undefined) {
    return cachedVisitorId;
  }

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
        const agent = await FingerprintJS.load();
        const result = await agent.get();
        cachedVisitorId = result.visitorId;
        return cachedVisitorId;
      } catch {
        return undefined;
      } finally {
        inFlight = null;
      }
    })();
  }

  return inFlight;
}
