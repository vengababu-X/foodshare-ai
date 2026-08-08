import { Redis } from '@upstash/redis';

/**
 * Shared Upstash Redis client used for real-time caching and invalidation.
 *
 * - `active_donations` holds the general active donation feed with a 30-second
 *   TTL and is invalidated immediately whenever a donation is created,
 *   accepted, or changes status.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const redis = new Redis({
  url: UPSTASH_URL,
  token: UPSTASH_TOKEN,
});

export const ACTIVE_DONATIONS_KEY = 'active_donations';
/** Seconds the cached donation feed is considered fresh. */
export const ACTIVE_DONATIONS_TTL = 30;

interface ActiveFeedPayload {
  donations: unknown[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// The feed is keyed per-page-size so requests with different `limit` values
// (donor: 10, ESG card: 100, admin: 200) never share a cached payload.
export function activeDonationsKey(limit: number): string {
  return `${ACTIVE_DONATIONS_KEY}:${limit}`;
}

/** Read the cached active donation feed, or null on a miss / Redis failure. */
export async function getCachedActiveDonations(limit: number): Promise<ActiveFeedPayload | null> {
  try {
    const raw = await redis.get<string>(activeDonationsKey(limit));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveFeedPayload;
    if (!Array.isArray(parsed?.donations) || !parsed?.pagination) return null;
    return parsed;
  } catch (error) {
    console.error('Redis get active_donations failed:', error);
    return null;
  }
}

/** Store the active donation feed with the 30-second TTL. */
export async function cacheActiveDonations(payload: ActiveFeedPayload): Promise<void> {
  try {
    await redis.set(activeDonationsKey(payload.pagination.limit), JSON.stringify(payload), {
      ex: ACTIVE_DONATIONS_TTL,
    });
  } catch (error) {
    console.error('Redis set active_donations failed:', error);
  }
}

/** Invalidate the cached feeds immediately after any mutation. */
export async function invalidateActiveDonations(): Promise<void> {
  try {
    const keys = await redis.keys(`${ACTIVE_DONATIONS_KEY}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch (error) {
    console.error('Redis del active_donations failed:', error);
  }
}

export default redis;
