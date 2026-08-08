'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  MapPin,
  CheckCircle,
  Navigation,
  Package,
  AlertCircle,
  QrCode,
  ClipboardList,
  Map as MapIcon,
  TrendingUp,
  Trophy,
  RefreshCw,
} from 'lucide-react';
import DynamicLeafletMap from '@/components/maps/DynamicLeafletMap';
import AuthPrompt from '@/components/ui/AuthPrompt';
import QRScanner from '@/components/ui/QRScanner';
import { VIEW_EVENT, VIEW_KEY } from '@/lib/headerActions';
import { useRealtime } from '@/hooks/useRealtime';

interface Delivery {
  _id: string;
  donationId: {
    _id: string;
    items: {
      name: string;
      qty: number;
      unit: string;
    }[];
    image?: string;
    photoUrl?: string;
    donorId: {
      name: string;
      phone: string;
      location: {
        coordinates: [number, number];
      };
    };
  };
  assignedNGO: {
    name: string;
    phone: string;
    location: {
      coordinates: [number, number];
    };
  };
  status: string;
  routeCoordinates?: Array<[number, number]>;
  pickupVerifiedAt?: string;
  deliveryVerifiedAt?: string;
  mealsProvided?: number;
  routeInfo: {
    distance: number;
    duration: number;
  };
  pickupLocation: {
    coordinates: [number, number];
  };
  dropoffLocation: {
    coordinates: [number, number];
  };
  completedAt?: string;
  proofPhotoUrl?: string;
  createdAt: string;
}

export default function VolunteerPortal() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<'login' | 'forbidden' | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showQRVerify, setShowQRVerify] = useState<'pickup' | 'dropoff' | null>(null);
  const [volunteerPosition, setVolunteerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [view, setView] = useState<'tasks' | 'map' | 'impact'>('tasks');
  const [celebration, setCelebration] = useState<Delivery | null>(null);
  const lastLocationSentAt = useRef(0);

  // Header quick actions (Open Tasks / Delivery Map / My Impact) switch tabs
  useEffect(() => {
    const stored = sessionStorage.getItem(VIEW_KEY);
    if (stored) {
      sessionStorage.removeItem(VIEW_KEY);
      if (stored === 'map' || stored === 'impact' || stored === 'tasks') {
        setView(stored);
      }
    }
    const onSwitch = (e: Event) => {
      const v = (e as CustomEvent<{ view?: string }>).detail?.view;
      if (v === 'map' || v === 'impact' || v === 'tasks') setView(v);
    };
    window.addEventListener(VIEW_EVENT, onSwitch);
    return () => window.removeEventListener(VIEW_EVENT, onSwitch);
  }, []);

  // Fetch deliveries
  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      const response = await fetch('/api/deliveries?limit=20');

      // Gracefully handle auth failures instead of rendering empty/error objects
      if (response.status === 401) {
        setAuthError('login');
        return;
      }
      if (response.status === 403) {
        setAuthError('forbidden');
        return;
      }
      if (!response.ok) {
        setNotification({
          type: 'error',
          message: 'Failed to load delivery jobs. Please try again.',
        });
        return;
      }

      const data = await response.json();
      if (data.success) {
        // Always initialize state arrays safely
        const deliveriesList = Array.isArray(data.data?.deliveries)
          ? data.data.deliveries
          : [];
        setDeliveries(deliveriesList);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time sync (Pusher): new jobs push in instantly, and every status
  // change (IN_TRANSIT / COMPLETED) refreshes the portal from MongoDB. The
  // refetch is volunteer-scoped server-side, so each volunteer only sees
  // their own jobs.
  useRealtime('delivery:assigned', () => {
    fetchDeliveries();
    setNotification({
      type: 'success',
      message: 'A new delivery is available — check Open Tasks.',
    });
    setTimeout(() => setNotification(null), 4000);
  });
  useRealtime('delivery:status:update', fetchDeliveries);
  useRealtime('donation-accepted', fetchDeliveries);

  // Apply a status change to both the deliveries list and the active delivery
  // so stats + UI update instantly (works online and offline).
  const patchDelivery = (deliveryId: string, patch: Partial<Delivery>) => {
    setDeliveries((prev) =>
      prev.map((d) => (d._id === deliveryId ? { ...d, ...patch } : d))
    );
    setActiveDelivery((prev) =>
      prev && prev._id === deliveryId ? { ...prev, ...patch } : prev
    );
  };

  // Build the route path for the active delivery (routeCoordinates if
  // available, otherwise a straight line between pickup and drop-off)
  const getRoutePath = (delivery: Delivery) => {
    if (delivery.routeCoordinates && delivery.routeCoordinates.length >= 2) {
      return delivery.routeCoordinates.map((coord) => ({
        lat: coord[0],
        lng: coord[1],
      }));
    }
    return [
      {
        lat: delivery.pickupLocation?.coordinates?.[1] ?? 0,
        lng: delivery.pickupLocation?.coordinates?.[0] ?? 0,
      },
      {
        lat: delivery.dropoffLocation?.coordinates?.[1] ?? 0,
        lng: delivery.dropoffLocation?.coordinates?.[0] ?? 0,
      },
    ];
  };

  // Persist the volunteer's live GPS position (throttled to every 5 seconds)
  // via the volunteer-scoped PATCH endpoint — ownership is enforced server-side
  // against the real logged-in volunteer ID.
  const updateVolunteerLocation = async (
    deliveryId: string,
    deliveryStatus: string,
    pos: { lat: number; lng: number }
  ) => {
    const now = Date.now();
    if (now - lastLocationSentAt.current < 5000) return;
    lastLocationSentAt.current = now;
    try {
      await fetch('/api/deliveries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId,
          status: deliveryStatus,
          location: pos,
        }),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Handle QR verification for pickup / drop-off — the raw scanned token is a
  // JWT verified server-side against JWT_SECRET and matched to this delivery's
  // donation. PICKUP → IN_TRANSIT, DROPOFF → COMPLETED.
  const handleQRVerified = async (type: 'pickup' | 'dropoff', qrToken: string) => {
    if (!activeDelivery) return;
    const delivery = activeDelivery; // pre-patch snapshot used to revert on failure
    const action = type === 'pickup' ? 'PICKUP' : 'DROPOFF';
    const nowIso = new Date().toISOString();

    // Optimistic local update: pickup → IN_TRANSIT, drop-off → COMPLETED
    const patch: Partial<Delivery> =
      type === 'pickup'
        ? { status: 'IN_TRANSIT', pickupVerifiedAt: nowIso }
        : { status: 'COMPLETED', deliveryVerifiedAt: nowIso, completedAt: nowIso };
    patchDelivery(delivery._id, patch);
    setShowQRVerify(null);

    try {
      const response = await fetch('/api/donations/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken,
          deliveryId: delivery._id,
          action,
        }),
      });

      if (response.status === 401) {
        setAuthError('login');
        return;
      }
      if (response.status === 403) {
        setAuthError('forbidden');
        return;
      }

      const data = await response.json();
      if (!data.success) {
        // Verification failed — revert the optimistic patch and surface the error
        patchDelivery(delivery._id, {
          status: delivery.status,
          pickupVerifiedAt: delivery.pickupVerifiedAt,
          deliveryVerifiedAt: delivery.deliveryVerifiedAt,
          completedAt: delivery.completedAt,
        });
        setNotification({
          type: 'error',
          message: data.error || 'Invalid or Expired QR Code',
        });
        fetchDeliveries();
        return;
      }

      setNotification({
        type: 'success',
        message:
          type === 'pickup'
            ? 'Pickup verified! Delivery is now in transit.'
            : 'Drop-off verified! Delivery completed.',
      });

      // Completion celebrates the volunteer's contribution
      if (type === 'dropoff') {
        setActiveDelivery(null);
        setCelebration({ ...delivery, status: 'COMPLETED', completedAt: nowIso });
      }
      fetchDeliveries();
    } catch {
      setNotification({
        type: 'error',
        message: 'Network error. Could not verify the QR code.',
      });
    }
  };

  // Live GPS tracking: the real device geolocation (navigator.watchPosition)
  // drives the volunteer marker on the delivery map.
  useEffect(() => {
    if (!activeDelivery) {
      setVolunteerPosition(null);
      return;
    }

    let watchId: number | null = null;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setVolunteerPosition(pos);
          if (activeDelivery.status !== 'COMPLETED' && activeDelivery.status !== 'CANCELLED') {
            updateVolunteerLocation(activeDelivery._id, activeDelivery.status, pos);
          }
        },
        () => setVolunteerPosition(null),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    return () => {
      if (watchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDelivery]);

  // Generates a REAL server-signed JWT QR token so the "Simulate Camera Scan"
  // fallback exercises the full verification loop (signature + MongoDB match).
  const simulateCameraScan = async (): Promise<string> => {
    if (!activeDelivery) return '';
    const donationId =
      typeof activeDelivery.donationId === 'string'
        ? activeDelivery.donationId
        : activeDelivery.donationId?._id;
    if (!donationId) return '';
    const type = showQRVerify === 'pickup' ? 'PICKUP' : 'DELIVERY';
    try {
      const response = await fetch('/api/donations/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId, type }),
      });
      const data = await response.json();
      return data.data?.qrData || '';
    } catch {
      return '';
    }
  };

  const handleStartDelivery = async (delivery: Delivery) => {
    // ASSIGNED → IN_TRANSIT in MongoDB via the volunteer-scoped PATCH endpoint.
    patchDelivery(delivery._id, { status: 'IN_TRANSIT' });
    setActiveDelivery({ ...delivery, status: 'IN_TRANSIT' });
    setNotification({
      type: 'success',
      message: 'Delivery started! GPS tracking is active.',
    });
    setView('map');

    try {
      const response = await fetch('/api/deliveries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId: delivery._id,
          status: 'IN_TRANSIT',
        }),
      });
      if (response.status === 401) {
        setAuthError('login');
        return;
      }
      if (response.status === 403) {
        setAuthError('forbidden');
        return;
      }
      const data = await response.json();
      if (data.success) fetchDeliveries();
    } catch {
      // Local state already reflects IN_TRANSIT
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800';
      case 'PICKUP_VERIFIED':
        return 'bg-teal-100 text-teal-800';
      case 'IN_TRANSIT':
        return 'bg-purple-100 text-purple-800';
      case 'DELIVERY_VERIFIED':
        return 'bg-emerald-100 text-emerald-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Prepare map markers for active delivery (guard missing coordinates)
  const activeDeliveryMarkers = activeDelivery
    ? [
        {
          id: 'pickup',
          position: {
            lat: activeDelivery.pickupLocation?.coordinates?.[1] ?? 0,
            lng: activeDelivery.pickupLocation?.coordinates?.[0] ?? 0,
          },
          title: 'Pickup Location',
          type: 'pickup' as const,
          info: activeDelivery.donationId?.donorId?.name || 'Donor',
        },
        {
          id: 'dropoff',
          position: {
            lat: activeDelivery.dropoffLocation?.coordinates?.[1] ?? 0,
            lng: activeDelivery.dropoffLocation?.coordinates?.[0] ?? 0,
          },
          title: 'Dropoff Location',
          type: 'dropoff' as const,
          info: activeDelivery.assignedNGO?.name || 'NGO',
        },
        // Live volunteer marker
        ...(volunteerPosition
          ? [
              {
                id: 'volunteer',
                position: volunteerPosition,
                title: 'You (Live)',
                type: 'volunteer' as const,
                info: 'Volunteer live location',
              },
            ]
          : []),
      ]
    : [];

  // Route path used for the polyline + GPS simulation
  const routeCoordinates = activeDelivery ? getRoutePath(activeDelivery) : [];

  // If the API told us we're not authenticated (or lack permission), show a
  // clean prompt instead of a blank/broken dashboard.
  if (authError) {
    return <AuthPrompt mode={authError} redirectTo="/volunteer" />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Volunteer Portal</h1>
          <p className="text-gray-600 mt-1">
            Help deliver food donations from donors to NGOs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDeliveries}
            title="Refresh live feed"
            aria-label="Refresh deliveries"
            className="p-2.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors"
          >
            <RefreshCw
              className={`w-5 h-5 ${loading ? 'animate-spin text-green-600' : ''}`}
            />
          </button>
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
          {activeDelivery && (
            <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg flex items-center gap-2">
              <Truck className="w-5 h-5 animate-pulse" />
              <span className="text-sm font-medium">Active Delivery</span>
            </span>
          )}
        </div>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${
              notification.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Tabs — switch without page reloads */}
      <div className="flex gap-2 md:gap-3 border-b border-gray-200 overflow-x-auto">
        {(
          [
            { id: 'tasks', label: 'Open Tasks', icon: ClipboardList },
            { id: 'map', label: 'Delivery Map', icon: MapIcon },
            { id: 'impact', label: 'My Impact', icon: TrendingUp },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              view === tab.id
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4 inline mr-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── DELIVERY MAP VIEW ──────────────────────────────────────────── */}
      {view === 'map' && (
        <div className="space-y-4">
        {activeDelivery && (
        <motion.div
          id="delivery-map"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-xl scroll-mt-24"
        >
          <div className="flex items-center gap-3 mb-4">
            <Truck className="w-8 h-8 animate-bounce" />
            <h2 className="text-xl font-bold">Active Delivery</h2>
          </div>
          
          {/* Route Map */}
          <div className="mb-6 rounded-xl overflow-hidden">
            <DynamicLeafletMap
              markers={activeDeliveryMarkers}
              center={{
                lat: ((activeDelivery.pickupLocation?.coordinates?.[1] ?? 0) + (activeDelivery.dropoffLocation?.coordinates?.[1] ?? 0)) / 2,
                lng: ((activeDelivery.pickupLocation?.coordinates?.[0] ?? 0) + (activeDelivery.dropoffLocation?.coordinates?.[0] ?? 0)) / 2,
              }}
              zoom={13}
              showRoute={true}
              routeCoordinates={routeCoordinates}
            />
          </div>

          {/* Verification Stepper + GPS toggle */}
          <div className="mb-6 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Verification Progress</span>
              <span className="text-xs px-3 py-1.5 bg-white/20 rounded-lg text-white/80">
                Real GPS Tracking
              </span>
            </div>
            <div className="flex items-center">
              {[
                {
                  key: 'pickup',
                  label: 'Pickup',
                  done: !!activeDelivery.pickupVerifiedAt,
                },
                {
                  key: 'dropoff',
                  label: 'Drop-off',
                  done: !!activeDelivery.deliveryVerifiedAt,
                },
                {
                  key: 'complete',
                  label: 'Completed',
                  done: activeDelivery.status === 'COMPLETED',
                },
              ].map((step, i, arr) => (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center w-14">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        step.done ? 'bg-green-400 text-white' : 'bg-white/20 text-white/80'
                      }`}
                    >
                      {step.done ? '✓' : i + 1}
                    </div>
                    <span className="text-[10px] mt-1 text-white/80">{step.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex-1 h-0.5 bg-white/20 rounded mb-4" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Pickup Location</h3>
              <p className="text-white/90">
                {activeDelivery.donationId?.donorId?.name || 'Donor'}
              </p>
              <p className="text-sm text-white/70 mt-1">
                {(activeDelivery.donationId?.items || []).map(i => i.name).join(', ')}
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Dropoff Location</h3>
              <p className="text-white/90">
                {activeDelivery.assignedNGO?.name || 'NGO'}
              </p>
              <p className="text-sm text-white/70 mt-1">
                {activeDelivery.routeInfo?.distance?.toFixed(1) || 'N/A'} km
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            {/* Primary staged action — morphs through the delivery lifecycle */}
            {!activeDelivery.pickupVerifiedAt && (
              <button
                onClick={() => setShowQRVerify('pickup')}
                className="px-5 py-2.5 bg-white text-purple-700 font-bold rounded-lg hover:bg-white/90 shadow transition-all flex items-center gap-2"
              >
                <QrCode className="w-5 h-5" />
                📷 Scan Pickup QR
              </button>
            )}
            {activeDelivery.pickupVerifiedAt && !activeDelivery.deliveryVerifiedAt && (
              <button
                onClick={() => setShowQRVerify('dropoff')}
                className="px-5 py-2.5 bg-white text-purple-700 font-bold rounded-lg hover:bg-white/90 shadow transition-all flex items-center gap-2"
              >
                <QrCode className="w-5 h-5" />
                📷 Scan Dropoff QR
              </button>
            )}
            <button
              onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${activeDelivery.pickupLocation?.coordinates?.[1] ?? 0}&mlon=${activeDelivery.pickupLocation?.coordinates?.[0] ?? 0}#map=15/${activeDelivery.pickupLocation?.coordinates?.[1] ?? 0}/${activeDelivery.pickupLocation?.coordinates?.[0] ?? 0}`)}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <Navigation className="w-5 h-5" />
              Navigate to Pickup
            </button>
          </div>
        </motion.div>
        )}

        {/* Map empty state */}
        {!activeDelivery && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-green-100">
            <MapIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No active delivery
            </h3>
            <p className="text-gray-500 mb-6">
              Start a task to see the live delivery map with GPS tracking.
            </p>
            <button
              onClick={() => setView('tasks')}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <ClipboardList className="w-5 h-5 mr-2" />
              Go to Open Tasks
            </button>
          </div>
        )}
        </div>
      )}

      {/* ── MY IMPACT VIEW ─────────────────────────────────────────────── */}
      {view === 'impact' && (
        <div className="space-y-6">
      {/* Stats Cards */}
      <div id="impact" className="grid grid-cols-2 md:grid-cols-4 gap-4 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {deliveries.filter((d) => d.status === 'ASSIGNED').length}
              </p>
              <p className="text-sm text-gray-500">Available Jobs</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {deliveries.filter((d) => d.status === 'IN_TRANSIT').length}
              </p>
              <p className="text-sm text-gray-500">In Transit</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {deliveries.filter((d) => d.status === 'COMPLETED').length}
              </p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {deliveries
                  .filter((d) => d.status === 'COMPLETED')
                  .reduce((sum, d) => sum + (d.routeInfo?.distance || 0), 0)
                  .toFixed(1)}km
              </p>
              <p className="text-sm text-gray-500">Distance Covered</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Completed history (impact) */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Completed Deliveries
        </h2>
        {deliveries.filter((d) => d.status === 'COMPLETED').length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center shadow-lg border border-green-100">
            <p className="text-gray-500">
              No completed deliveries yet — finish a task to grow your impact!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries
              .filter((d) => d.status === 'COMPLETED')
              .map((delivery) => (
                <div
                  key={delivery._id}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow border border-green-100 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {(delivery.donationId?.items || [])
                        .map((i) => i.name)
                        .join(', ')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {delivery.assignedNGO?.name || 'NGO'} ·{' '}
                      {delivery.routeInfo?.distance?.toFixed(1) || 'N/A'} km ·{' '}
                      {delivery.completedAt
                        ? new Date(delivery.completedAt).toLocaleString()
                        : ''}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 self-start">
                    ✓ Completed
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
        </div>
      )}

      {/* ── OPEN TASKS VIEW ────────────────────────────────────────────── */}
      {view === 'tasks' && (
        <div className="space-y-6">
        {/* Compact active delivery card with the staged action */}
        {activeDelivery && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-5 text-white shadow-xl">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Truck className="w-6 h-6 animate-bounce" />
                <div>
                  <h3 className="font-bold">Active Delivery</h3>
                  <p className="text-sm text-white/80">
                    {(activeDelivery.donationId?.items || [])
                      .map((i) => i.name)
                      .join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!activeDelivery.pickupVerifiedAt && (
                  <button
                    onClick={() => setShowQRVerify('pickup')}
                    className="px-4 py-2 bg-white text-purple-700 font-semibold rounded-lg hover:bg-white/90 transition-colors"
                  >
                    <QrCode className="w-4 h-4 inline mr-1.5" />
                    📷 Scan Pickup QR
                  </button>
                )}
                {activeDelivery.pickupVerifiedAt && !activeDelivery.deliveryVerifiedAt && (
                  <button
                    onClick={() => setShowQRVerify('dropoff')}
                    className="px-4 py-2 bg-white text-purple-700 font-semibold rounded-lg hover:bg-white/90 transition-colors"
                  >
                    <QrCode className="w-4 h-4 inline mr-1.5" />
                    📷 Scan Dropoff QR
                  </button>
                )}
                <button
                  onClick={() => setView('map')}
                  className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                >
                  <MapIcon className="w-4 h-4 inline mr-1.5" />
                  View Map
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Available Delivery Jobs */}
        <div id="tasks" className="scroll-mt-24">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Available Delivery Jobs
          </h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Loading jobs...</p>
          </div>
        ) : deliveries.filter((d) => d.status === 'ASSIGNED').length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-green-100">
            <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No available jobs
            </h3>
            <p className="text-gray-500">
              New delivery jobs will appear here when NGOs assign them
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries
              .filter((d) => d.status === 'ASSIGNED')
              .map((delivery, index) => (
                <motion.div
                  key={delivery._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100 hover:shadow-xl transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {(delivery.donationId?.image || delivery.donationId?.photoUrl) && (
                      <img
                        src={delivery.donationId.image || delivery.donationId.photoUrl}
                        alt={(delivery.donationId?.items || []).map((item) => item.name).join(', ')}
                        className="w-full lg:w-44 h-32 lg:h-24 object-cover rounded-xl shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            delivery.status
                          )}`}
                        >
                          {delivery.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {delivery.routeInfo?.distance?.toFixed(1) || 'N/A'} km
                        </span>
                        <span className="text-sm text-gray-500">
                          ~{delivery.routeInfo?.duration || 'N/A'} min
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {(delivery.donationId?.items || [])
                          .map((item) => item.name)
                          .join(', ')}
                      </h3>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Pickup: {delivery.donationId?.donorId?.name || 'Donor'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Dropoff: {delivery.assignedNGO?.name || 'NGO'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartDelivery(delivery)}
                      disabled={activeDelivery !== null}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <Truck className="w-5 h-5 inline mr-2" />
                      Start Delivery
                    </button>
                  </div>
                </motion.div>
              ))}
          </div>
        )}
        </div>
      </div>
      )}

      {/* Celebration Modal — shown when a delivery is completed */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCelebration(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Delivery Completed!
              </h2>
              <p className="text-gray-600 mb-6">
                Thank you for your contribution — every delivery counts!
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {celebration.mealsProvided ??
                      (celebration.donationId?.items || []).reduce(
                        (s, i) => s + (i.qty || 0),
                        0
                      )}
                  </div>
                  <div className="text-xs text-gray-500">Meals Delivered</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {(celebration.routeInfo?.distance ?? 0).toFixed(1)} km
                  </div>
                  <div className="text-xs text-gray-500">Distance Covered</div>
                </div>
              </div>
              <button
                onClick={() => setCelebration(null)}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Awesome!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Verification Modal (pickup / drop-off) */}
      <AnimatePresence>
        {showQRVerify && activeDelivery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowQRVerify(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <QRScanner
                onScan={(data) => handleQRVerified(showQRVerify, data)}
                onClose={() => setShowQRVerify(null)}
                title={
                  showQRVerify === 'pickup'
                    ? 'Scan Pickup QR Code'
                    : 'Scan Delivery QR Code'
                }
                simulateToken={simulateCameraScan}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}