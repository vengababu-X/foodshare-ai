import Pusher from 'pusher';

/**
 * Pusher server instance (serverless-safe: HTTP triggers only — no long-lived
 * sockets on the server, so it works on Vercel's stateless functions).
 *
 * Every mutation in the API layer fans out on the public `food-channel` and
 * the four portals (donor / ngo / volunteer / admin) receive the events
 * instantly via the useRealtime hook.
 *
 * When the Pusher credentials are missing the helpers become no-ops and the
 * portals fall back to polling / manual refresh — development never breaks.
 */

const appId = process.env.PUSHER_APP_ID || '';
const key = process.env.NEXT_PUBLIC_PUSHER_KEY || '';
const secret = process.env.PUSHER_SECRET || '';
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

export const pusher: Pusher | null =
  appId && key && secret
    ? new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: true,
      })
    : null;

export const FOOD_CHANNEL = 'food-channel';

/** Broadcast a payload on the public food-channel. Never throws. */
export async function broadcast(event: string, data: unknown): Promise<void> {
  if (!pusher) return;
  try {
    await pusher.trigger(FOOD_CHANNEL, event, data);
  } catch (error) {
    console.error(`Pusher trigger "${event}" failed:`, error);
  }
}

export default pusher;
