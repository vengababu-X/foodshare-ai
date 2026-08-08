import { broadcast } from '@/lib/pusher';

/**
 * Real-time notification helpers (Pusher-backed).
 *
 * These previously sat on an in-memory Socket.io server, which cannot work
 * across Vercel's stateless serverless functions (there was no long-running
 * server to host it, so no client ever received an event). They now fan out
 * through Pusher on the public `food-channel`, so every connected laptop
 * receives the event instantly.
 *
 * Clients never need the target id — they subscribe to the event name and
 * refetch their own (authenticated, server-filtered) data. The target id
 * parameter is kept so existing call sites stay unchanged. The helpers are
 * fire-and-forget no-ops when Pusher is not configured — the portals fall
 * back to polling.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventData = Record<string, any>;

/** Notify a specific user (broadcast on the food-channel). */
export function notifyUser(_userId: string, event: string, data: EventData): void {
  void broadcast(event, data);
}

/** Notify watchers of a specific donation. */
export function notifyDonation(_donationId: string, event: string, data: EventData): void {
  void broadcast(event, data);
}

/** Notify watchers of a specific delivery. */
export function notifyDelivery(_deliveryId: string, event: string, data: EventData): void {
  void broadcast(event, data);
}

export default {
  notifyUser,
  notifyDonation,
  notifyDelivery,
};
