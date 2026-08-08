'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';

interface MeUser {
  _id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_BADGE: Record<string, string> = {
  DONOR: 'bg-orange-100 text-orange-700',
  NGO: 'bg-blue-100 text-blue-700',
  VOLUNTEER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-gray-100 text-gray-700',
};

const ROLE_AVATAR: Record<string, string> = {
  DONOR: 'from-orange-500 to-red-500',
  NGO: 'from-blue-500 to-cyan-500',
  VOLUNTEER: 'from-purple-500 to-pink-500',
  ADMIN: 'from-gray-600 to-gray-800',
};

/**
 * Dynamic user section for the header navbar. Fetches the current session via
 * /api/auth/me and shows the user's name, email, role badge and logout — or a
 * plain "Login" link when no one is signed in.
 */
export default function UserNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<MeUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authed' | 'guest'>('loading');

  // Re-fetch on every route change: the layout persists across client-side
  // navigations, so this keeps the header in sync right after login/register/
  // logout (which use router.push without a full page reload).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.user) {
            setUser(data.data.user);
            setStatus('authed');
            return;
          }
        }
        setStatus('guest');
      } catch {
        if (!cancelled) setStatus('guest');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // even if the network call fails, redirect so the user can try again
    }
    router.push('/login');
    router.refresh();
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center px-3 py-2">
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (status === 'guest' || !user) {
    return (
      <a
        href="/login"
        className="px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
      >
        Login
      </a>
    );
  }

  const initials = (user.name || '?')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-2 pl-3 border-l border-green-100">
      <div
        className={`w-9 h-9 rounded-full bg-gradient-to-br ${
          ROLE_AVATAR[user.role] || 'from-gray-500 to-gray-700'
        } flex items-center justify-center text-white text-xs font-bold shrink-0`}
        title={`${user.name} (${user.role})`}
      >
        {initials}
      </div>

      <div className="hidden md:block text-left leading-tight">
        <div className="text-sm font-medium text-gray-900 max-w-[120px] truncate">
          {user.name}
        </div>
        <div className="text-xs text-gray-500 max-w-[140px] truncate">
          {user.email}
        </div>
      </div>

      <span
        className={`hidden lg:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
          ROLE_BADGE[user.role] || 'bg-gray-100 text-gray-600'
        }`}
      >
        {user.role}
      </span>

      <button
        onClick={handleLogout}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Log out"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}
