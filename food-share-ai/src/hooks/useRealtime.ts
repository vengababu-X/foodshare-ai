'use client';

import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';

/**
 * useRealtime — subscribe to a Pusher `food-channel` event from a portal page.
 *
 * Every API mutation broadcasts on the public `food-channel`; pages subscribe
 * to the events they care about:
 *   - `donation-created`      (donor posted → NGO/admin update instantly)
 *   - `donation-accepted`     (NGO claimed  → donor/volunteer/admin update)
 *   - `delivery:assigned`     (volunteer got a new job)
 *   - `delivery:status:update`(IN_TRANSIT / COMPLETED → stakeholders update)
 *   - `donation:status:update`(status changed → donor feed updates)
 *
 * The client connection is a module-level singleton so several subscriptions
 * on one page share a single socket. When NEXT_PUBLIC_PUSHER_KEY is missing
 * the hook is a no-op and the page falls back to polling / manual refresh.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RealtimeHandler = (data: any) => void;

let client: Pusher | null = null;

function getClient(): Pusher | null {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  if (!key) return null;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';
  client = new Pusher(key, { cluster, forceTLS: true });
  return client;
}

export function useRealtime(
  event: string,
  handler: RealtimeHandler,
  channel = 'food-channel'
): { connected: boolean } {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const pusher = getClient();
    if (!pusher) return;

    const ch = pusher.subscribe(channel);
    const onEvent = (data: unknown) => handlerRef.current(data);
    ch.bind(event, onEvent);

    const onConnected = () => setConnected(true);
    const onDisconnected = () => setConnected(false);
    pusher.connection.bind('connected', onConnected);
    pusher.connection.bind('disconnected', onDisconnected);

    return () => {
      ch.unbind(event, onEvent);
      pusher.connection.unbind('connected', onConnected);
      pusher.connection.unbind('disconnected', onDisconnected);
      // The shared client stays connected for the page's other subscriptions.
    };
  }, [event, channel]);

  return { connected };
}

export default useRealtime;
