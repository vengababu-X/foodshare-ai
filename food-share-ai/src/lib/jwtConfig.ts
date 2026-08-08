/**
 * Shared JWT configuration used by both the Edge middleware (src/middleware.ts)
 * and the Node API auth helpers (src/middleware/auth.ts).
 *
 * Keeping this in one place guarantees the signing and verification secrets
 * can never drift apart — a mismatch would silently break every login.
 */
export const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-in-production';
