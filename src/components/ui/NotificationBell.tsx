'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellRing, CheckCheck, Inbox } from 'lucide-react';

interface AppNotification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
  href?: string;
}

/** Role-aware notification bell with an unread badge and dropdown panel.
 *
 * The bell starts empty — notifications arrive in real time via the
 * `fsai:notification` custom event (server-driven flows push them when
 * donations are accepted, deliveries assigned, etc.).
 */
export default function NotificationBell({ role: _role }: { role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the panel on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Allow pages/services to push live notifications.
  useEffect(() => {
    const onNew = (
      e: Event
    ) => {
    const detail = (
      e as CustomEvent<{ title?: string; message?: string; href?: string }>
    ).detail;
    const title = detail?.title;
    if (!title) return;
    setItems((prev) =>
      [
        {
          id: Date.now(),
          title,
          message: detail.message || '',
          time: 'Just now',
          read: false,
          href: detail.href,
        },
        ...prev,
      ].slice(0, 20)
    );
    };
    window.addEventListener('fsai:notification', onNew);
    return () => window.removeEventListener('fsai:notification', onNew);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = () =>
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  const handleOpen = (n: AppNotification) => {
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
    );
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
        title="Notifications"
        aria-label={open ? 'Close notifications' : 'Open notifications'}
      >
        {unread > 0 ? (
          <BellRing className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-green-100 overflow-hidden z-[60]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-gray-900">
                  Notifications
                </span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {unread} new
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    You&apos;re all caught up!
                  </p>
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleOpen(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-green-50/70 transition-colors ${
                      n.read ? '' : 'bg-green-50/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          n.read ? 'bg-transparent' : 'bg-green-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {n.time}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
