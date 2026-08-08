'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, ShieldAlert, ArrowRight } from 'lucide-react';

interface AuthPromptProps {
  /** 'login' = must authenticate; 'forbidden' = wrong role / insufficient permissions */
  mode?: 'login' | 'forbidden';
  /** The dashboard the user was trying to reach, used for the redirect back */
  redirectTo?: string;
}

/**
 * Shown when a dashboard API request comes back 401 (not logged in) or
 * 403 (wrong role), instead of crashing or rendering empty error objects.
 *
 * Register-only platform: there are no demo accounts or bypass buttons —
 * unauthenticated users are sent to /login, where they can sign in or
 * create a real account via /register.
 */
export default function AuthPrompt({ mode = 'login', redirectTo }: AuthPromptProps) {
  const router = useRouter();
  const isForbidden = mode === 'forbidden';
  const [secondsLeft, setSecondsLeft] = useState(3);

  const safeRedirect =
    redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
      ? redirectTo
      : '';

  const handleGoToLogin = () => {
    const query = safeRedirect ? `?redirectTo=${encodeURIComponent(safeRedirect)}` : '';
    router.replace(`/login${query}`);
  };

  // Automatically redirect unauthenticated / unauthorized users to /login
  // instead of leaving them on a broken dashboard.
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleGoToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center py-16"
    >
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-10 text-center shadow-xl border border-green-100 max-w-md w-full">
        <div
          className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isForbidden ? 'bg-red-100' : 'bg-amber-100'
          }`}
        >
          {isForbidden ? (
            <ShieldAlert className="w-8 h-8 text-red-500" />
          ) : (
            <Lock className="w-8 h-8 text-amber-500" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isForbidden ? 'Access Restricted' : 'Please log in to view this dashboard'}
        </h2>

        <p className="text-gray-600 mb-6">
          {isForbidden
            ? "You don't have permission to view this dashboard. Please log in with an account that has the right access."
            : 'Your session has expired or you are not signed in. Log in to continue.'}
        </p>

        <p className="text-sm text-gray-500 mb-6">
          Redirecting to login in <span className="font-semibold">{secondsLeft}s</span>...
        </p>

        <button
          onClick={handleGoToLogin}
          className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
        >
          <Lock className="w-5 h-5 mr-2" />
          Go to Login
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>

        <p className="text-sm text-gray-500 mt-4">
          New here?{' '}
          <button
            onClick={() => router.push('/register')}
            className="font-semibold text-green-600 hover:text-green-700"
          >
            Create an account
          </button>
        </p>
      </div>
    </motion.div>
  );
}
