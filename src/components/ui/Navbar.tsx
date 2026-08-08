'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Plus,
  Activity,
  Award,
  Menu,
  X,
  Loader2,
  ClipboardList,
  Map as MapIcon,
  Package,
  CheckCircle2,
  LayoutDashboard,
  TrendingUp,
  Utensils,
  Leaf,
  Recycle,
  Sparkles,
} from 'lucide-react';
import UserNav from '@/components/ui/UserNav';
import NotificationBell from '@/components/ui/NotificationBell';
import ESGCertificate from '@/components/ui/ESGCertificate';
import { useIntakeOpen } from '@/lib/intakeStore';
import {
  navigateToAction,
  openDonationModal,
  switchView,
} from '@/lib/headerActions';

interface MeUser {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface EsgDonation {
  status?: string;
  items?: Array<{ qty?: number }>;
  mealsProvided?: number;
  carbonSavedKg?: number;
}

interface RoleActionHandlers {
  postFood: () => void;
  myActivity: () => void;
  openESG: () => void;
  liveFeed: () => void;
  activePickups: () => void;
  openTasks: () => void;
  deliveryMap: () => void;
  impactStats: () => void;
}

const LINK_CLS =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 transition-all duration-200';
const LINK_CLS_MOBILE =
  'flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:text-green-700 hover:bg-green-50 transition-all duration-200';

/**
 * Role-specific quick actions rendered in the header (horizontal on desktop,
 * stacked full-width inside the mobile menu).
 */
function RoleActions({
  role,
  variant,
  handlers,
  intake,
  impactCount,
}: {
  role: string;
  variant: 'desktop' | 'mobile';
  handlers: RoleActionHandlers;
  intake: { open: boolean; toggle: () => void };
  impactCount: number | null;
}) {
  const mobile = variant === 'mobile';
  const link = mobile ? LINK_CLS_MOBILE : LINK_CLS;

  switch (role) {
    case 'DONOR':
      return (
        <div className={mobile ? 'space-y-1' : 'flex items-center gap-1.5'}>
          <button
            onClick={handlers.postFood}
            className={
              mobile
                ? 'flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-md hover:shadow-lg transition-all duration-200'
                : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200'
            }
            title="Post surplus food from any page"
          >
            <Plus className="w-4 h-4" />
            Post Food
          </button>
          <button onClick={handlers.myActivity} className={link}>
            <Activity className="w-4 h-4 text-green-600" />
            My Activity
          </button>
          <button onClick={handlers.openESG} className={link}>
            <Award className="w-4 h-4 text-green-600" />
            ESG Certificates
          </button>
        </div>
      );

    case 'NGO':
      return (
        <div className={mobile ? 'space-y-1' : 'flex items-center gap-1.5'}>
          <button onClick={handlers.liveFeed} className={link}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Available Food <span className="text-green-700 font-semibold">(Live)</span>
          </button>
          <button onClick={handlers.activePickups} className={link}>
            <Package className="w-4 h-4 text-green-600" />
            Active Pickups
          </button>
          <button
            onClick={intake.toggle}
            className={
              mobile
                ? `flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold border transition-all duration-300 ${
                    intake.open
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-orange-50 border-orange-200 text-orange-700'
                  }`
                : `inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all duration-300 ${
                    intake.open
                      ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                      : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                  }`
            }
            title={
              intake.open ? 'Click to pause intake' : 'Click to resume intake'
            }
          >
            <span className="relative flex h-2 w-2">
              {intake.open && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  intake.open ? 'bg-green-500' : 'bg-orange-500'
                }`}
              />
            </span>
            {intake.open ? 'Intake Open' : 'Intake Paused'}
          </button>
        </div>
      );

    case 'VOLUNTEER':
      return (
        <div className={mobile ? 'space-y-1' : 'flex items-center gap-1.5'}>
          <button onClick={handlers.openTasks} className={link}>
            <ClipboardList className="w-4 h-4 text-green-600" />
            Open Tasks
          </button>
          <button onClick={handlers.deliveryMap} className={link}>
            <MapIcon className="w-4 h-4 text-green-600" />
            Delivery Map
          </button>
          <button
            onClick={handlers.impactStats}
            className={
              mobile
                ? 'flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-green-50 border border-green-200 text-green-700 transition-all duration-300'
                : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-all duration-300'
            }
            title="My Impact Stats — completed deliveries"
          >
            <CheckCircle2 className="w-4 h-4" />
            {impactCount === null ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                My Impact · <strong>{impactCount}</strong> ✓
              </>
            )}
          </button>
        </div>
      );

    case 'ADMIN':
    default:
      return (
        <div className={mobile ? 'space-y-1' : 'flex items-center gap-1.5'}>
          <a href="/admin" className={link}>
            <LayoutDashboard className="w-4 h-4 text-green-600" />
            Admin Portal
          </a>
          <a href="/impact" className={link}>
            <TrendingUp className="w-4 h-4 text-green-600" />
            Impact Dashboard
          </a>
        </div>
      );
  }
}

function GuestLinks({ mobile }: { mobile?: boolean }) {
  const link = mobile ? LINK_CLS_MOBILE : LINK_CLS;
  return (
    <div className={mobile ? 'space-y-1' : 'flex items-center gap-1.5'}>
      <a href="/impact" className={link}>
        <TrendingUp className="w-4 h-4 text-green-600" />
        Impact Dashboard
      </a>
      {mobile && (
        <a href="/register" className={link}>
          <Sparkles className="w-4 h-4 text-green-600" />
          Register
        </a>
      )}
    </div>
  );
}

/**
 * Main navigation header. Replaces the generic portal-switcher links with
 * context-rich, role-specific quick actions and widgets.
 */
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<MeUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authed' | 'guest'>(
    'loading'
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showESG, setShowESG] = useState(false);
  const [esgData, setEsgData] = useState<{ donations: EsgDonation[] } | null>(
    null
  );
  const [esgLoading, setEsgLoading] = useState(false);
  const [impactCount, setImpactCount] = useState<number | null>(null);

  const intake = useIntakeOpen();

  // Fetch the current session — re-fetch on route change so the header stays
  // in sync right after login/register/logout (client-side navigations).
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

  // Close the mobile menu on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close the mobile menu with the Escape key.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Volunteers: fetch the completed-delivery count for the impact chip.
  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'VOLUNTEER') return;
    let cancelled = false;
    fetch('/api/deliveries?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.data?.deliveries)
          ? data.data.deliveries
          : [];
        setImpactCount(
          list.filter(
            (d: { status?: string }) => d.status === 'COMPLETED'
          ).length
        );
      })
      .catch(() => {
        if (!cancelled) setImpactCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [status, user?.role]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const handlePostFood = useCallback(() => {
    closeMobile();
    openDonationModal(router, pathname);
  }, [closeMobile, router, pathname]);

  const handleMyActivity = useCallback(() => {
    closeMobile();
    navigateToAction(router, pathname, '/donor', 'activity');
  }, [closeMobile, router, pathname]);

  const handleOpenESG = useCallback(() => {
    closeMobile();
    setShowESG(true);
    if (!esgData && !esgLoading) {
      setEsgLoading(true);
      fetch('/api/donations?limit=100')
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data?.data?.donations)
            ? data.data.donations
            : [];
          setEsgData({ donations: list });
        })
        .catch(() => setEsgData({ donations: [] }))
        .finally(() => setEsgLoading(false));
    }
  }, [closeMobile, esgData, esgLoading]);

  const handleLiveFeed = useCallback(() => {
    closeMobile();
    navigateToAction(router, pathname, '/ngo', 'live-feed');
  }, [closeMobile, router, pathname]);

  const handleActivePickups = useCallback(() => {
    closeMobile();
    navigateToAction(router, pathname, '/ngo', 'pickups');
  }, [closeMobile, router, pathname]);

  const handleOpenTasks = useCallback(() => {
    closeMobile();
    switchView(router, pathname, '/volunteer', 'tasks');
  }, [closeMobile, router, pathname]);

  const handleDeliveryMap = useCallback(() => {
    closeMobile();
    switchView(router, pathname, '/volunteer', 'map');
  }, [closeMobile, router, pathname]);

  const handleImpactStats = useCallback(() => {
    closeMobile();
    switchView(router, pathname, '/volunteer', 'impact');
  }, [closeMobile, router, pathname]);

  const handlers: RoleActionHandlers = {
    postFood: handlePostFood,
    myActivity: handleMyActivity,
    openESG: handleOpenESG,
    liveFeed: handleLiveFeed,
    activePickups: handleActivePickups,
    openTasks: handleOpenTasks,
    deliveryMap: handleDeliveryMap,
    impactStats: handleImpactStats,
  };

  // ESG impact totals computed from the donations endpoint — the same source
  // the donor portal uses for "Your Donations", so the numbers stay
  // consistent with the rest of the app.
  const esgDonations = esgData?.donations ?? [];
  const esgDelivered = esgDonations.filter((d) => d.status === 'DELIVERED');
  const esgTotals = {
    totalDonations: esgDonations.length,
    mealsProvided: esgDelivered.reduce(
      (sum, d) =>
        sum +
        (d.mealsProvided ??
          (d.items ?? []).reduce((a, i) => a + (i.qty ?? 0), 0)),
      0
    ),
    carbonSavedKg: esgDelivered.reduce(
      (sum, d) => sum + (d.carbonSavedKg ?? 0.5),
      0
    ),
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-green-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-3">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center space-x-3 shrink-0"
            aria-label="FoodShare AI home"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A2.704 2.704 0 003 15.546V12a9 9 0 0118 0v3.546z"
                />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                FoodShare AI
              </h1>
              <p className="text-xs text-gray-500">
                Reducing Waste, Fighting Hunger
              </p>
            </div>
          </a>

          {/* Desktop role-specific quick actions */}
          <nav
            className="hidden lg:flex flex-1 justify-center px-2"
            aria-label="Quick actions"
          >
            {status === 'authed' && user ? (
              <RoleActions
                role={user.role}
                variant="desktop"
                handlers={handlers}
                intake={intake}
                impactCount={impactCount}
              />
            ) : (
              <GuestLinks />
            )}
          </nav>

          {/* Far right: bell + avatar/name/role/logout */}
          <div className="flex items-center gap-1.5 shrink-0">
            {status === 'authed' && user && (
              <NotificationBell role={user.role} />
            )}
            <UserNav />
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:text-green-700 hover:bg-green-50 transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-green-100 bg-white/95 backdrop-blur-md shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {status === 'authed' && user ? (
              <RoleActions
                role={user.role}
                variant="mobile"
                handlers={handlers}
                intake={intake}
                impactCount={impactCount}
              />
            ) : (
              <GuestLinks mobile />
            )}
            {status === 'authed' && user && (
              <div className="border-t border-green-100 pt-3 mt-2">
                <a href="/impact" className={LINK_CLS_MOBILE}>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  Impact Dashboard
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ESG Certificates modal (donor) — portaled to body so it can overlay
          the sticky header. */}
      {showESG && user && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowESG(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 border-b border-green-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    <h2 className="text-lg font-bold text-gray-900">
                      ESG Certificates
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowESG(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {esgLoading && !esgData ? (
                    <div className="py-12 flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
                      <p className="text-sm text-gray-500">
                        Calculating your impact...
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                          <Package className="w-5 h-5 text-green-600 mx-auto mb-1" />
                          <div className="text-xl font-bold text-gray-900">
                            {esgTotals.totalDonations}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Donations
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                          <Utensils className="w-5 h-5 text-green-600 mx-auto mb-1" />
                          <div className="text-xl font-bold text-gray-900">
                            {esgTotals.mealsProvided.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Meals Provided
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                          <Leaf className="w-5 h-5 text-green-600 mx-auto mb-1" />
                          <div className="text-xl font-bold text-gray-900">
                            {esgTotals.carbonSavedKg.toFixed(1)} kg
                          </div>
                          <div className="text-[11px] text-gray-500">
                            CO₂ Saved
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                          <Recycle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                          <div className="text-xl font-bold text-gray-900">
                            {(esgTotals.mealsProvided * 0.5).toFixed(1)} kg
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Waste Reduced
                          </div>
                        </div>
                      </div>

                      <ESGCertificate
                        donorName={user.name}
                        donorType="Verified"
                        totalDonations={esgTotals.totalDonations}
                        mealsProvided={esgTotals.mealsProvided}
                        carbonSavedKg={esgTotals.carbonSavedKg}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}
