'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { PartyPopper, X } from 'lucide-react';

/**
 * Personalized welcome banner. After registration the app redirects to the
 * user's dashboard with `?welcome=<Name>` — this shows a one-time
 * "Welcome, [Name]!" greeting and cleans the query string from the URL.
 */
export default function WelcomeBanner() {
  return (
    <Suspense fallback={null}>
      <WelcomeBannerInner />
    </Suspense>
  );
}

function WelcomeBannerInner() {
  const searchParams = useSearchParams();
  const name = searchParams.get('welcome');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (name && typeof window !== 'undefined') {
      // Remove the query param so the banner doesn't reappear on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      window.history.replaceState({}, '', url.toString());
    }
  }, [name]);

  if (!name || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg flex items-center gap-3"
    >
      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
        <PartyPopper className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">Welcome, {name}! 🎉</p>
        <p className="text-sm text-green-100">
          Your account is ready — here&apos;s your dashboard.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
        aria-label="Dismiss welcome message"
      >
        <X className="w-5 h-5" />
      </button>
    </motion.div>
  );
}
