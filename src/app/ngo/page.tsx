'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  AlertCircle,
  TrendingUp,
  Package,
  QrCode,
} from 'lucide-react';
import AuthPrompt from '@/components/ui/AuthPrompt';
import QRCodeDisplay from '@/components/ui/QRCodeDisplay';
import { consumeScrollAction } from '@/lib/headerActions';
import { useIntakeOpen } from '@/lib/intakeStore';
import { useRealtime } from '@/hooks/useRealtime';

interface Donation {
  _id: string;
  donorId: {
    name: string;
    email: string;
    phone: string;
    location: {
      coordinates: [number, number];
    };
  };
  items: {
    name: string;
    qty: number;
    unit: string;
  }[];
  cookedAt: string;
  expiresAt: string;
  urgencyScore: number;
  aiQualityScore?: number;
  status: string;
  location: {
    coordinates: [number, number];
  };
  image?: string;
  photoUrl?: string;
  notes?: string;
  pickupQrCode?: string;
  deliveryQrCode?: string;
  createdAt: string;
}

export default function NGOPortal() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<'login' | 'forbidden' | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeliveryQR, setShowDeliveryQR] = useState<Donation | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  // Intake state shared with the navbar capacity pill (localStorage + events)
  const { open: capacityEnabled, toggle: toggleCapacity } = useIntakeOpen();
  const [pickups, setPickups] = useState<Donation[]>([]);
  const [pickupsLoading, setPickupsLoading] = useState(true);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [feedFilter, setFeedFilter] = useState<'all' | 'urgent'>('all');
  const [acceptedToday, setAcceptedToday] = useState(0);
  const [accepting, setAccepting] = useState(false);
  // Holds the delivery QR payload for the success modal (always generated).
  const [acceptSuccess, setAcceptSuccess] = useState<string | null>(null);

  // Fetch pending donations (poll every 30s, stopped once auth fails)
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch the NGO's claimed donations (active pickups)
  const fetchPickups = useCallback(async () => {
    try {
      const response = await fetch('/api/donations?status=ACCEPTED&limit=20');
      if (response.status === 401 || response.status === 403) return;
      const data = await response.json();
      if (data.success) {
        setPickups(
          Array.isArray(data.data?.donations) ? data.data.donations : []
        );
      }
    } catch (error) {
      console.error('Error fetching pickups:', error);
    } finally {
      setPickupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDonations();
    fetchPickups();
    consumeScrollAction();
    pollingRef.current = setInterval(fetchDonations, 5000);

    // Pause live polling while the tab is hidden so a background NGO portal
    // doesn't fire requests every 5s indefinitely; resume on visibility.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (pollingRef.current) clearInterval(pollingRef.current);
      } else if (!pollingRef.current) {
        pollingRef.current = setInterval(fetchDonations, 5000);
        fetchDonations();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Guards against overlapping polls (a fetch still in flight is never
  // superseded — the Redis-cached endpoint is fast, but a slow response
  // should never spawn concurrent requests).
  const fetchingRef = useRef(false);

  const fetchDonations = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await fetch('/api/donations?status=AVAILABLE&limit=20');

      // Gracefully handle auth failures instead of rendering empty/error objects
      if (response.status === 401) {
        setAuthError('login');
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }
      if (response.status === 403) {
        setAuthError('forbidden');
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }
      if (!response.ok) {
        setNotification({
          type: 'error',
          message: 'Failed to load donations. Please try again.',
        });
        return;
      }

      const data = await response.json();
      if (data.success) {
        // Always initialize state arrays safely
        const donationsList = Array.isArray(data.data?.donations)
          ? data.data.donations
          : [];
        setDonations(donationsList);
      }
    } catch (error) {
      console.error('Error fetching donations:', error);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  // Real-time sync (Pusher): a new listing pushes in instantly — refetch the
  // feed (the payload carries only ids/status, never donor PII; the full card
  // comes from the authenticated API).
  useRealtime('donation-created', () => {
    setNotification({
      type: 'success',
      message: 'New donation just landed in the live feed!',
    });
    setTimeout(() => setNotification(null), 4000);
    fetchDonations();
  });
  useRealtime('donation-accepted', () => {
    fetchDonations();
    fetchPickups();
  });
  useRealtime('delivery:status:update', fetchPickups);

  // Generate delivery QR code for a donation (server-side, JWT-signed)
  const generateDeliveryQR = async (donationId: string) => {
    try {
      const response = await fetch('/api/donations/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId,
          type: 'DELIVERY',
        }),
      });
      if (response.status === 401) {
        setAuthError('login');
        return null;
      }
      if (response.status === 403) {
        setAuthError('forbidden');
        return null;
      }

      const data = await response.json();
      if (data.success) {
        setQrCodes(prev => ({ ...prev, [donationId]: data.data.qrCodeUrl }));
        return data.data.qrData;
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
    return null;
  };

  const handleAccept = useCallback((donation: Donation) => {
    setSelectedDonation(donation);
    setShowAcceptModal(true);
  }, []);

  const handleDecline = async (donation: Donation) => {
    try {
      const response = await fetch('/api/donations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId: donation._id,
          status: 'PENDING',
          declined: true,
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
      if (data.success) {
        setNotification({
          type: 'success',
          message: data.message || 'Donation returned to the available feed',
        });
        fetchDonations();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Failed to decline donation. Please try again.',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'Network error. Failed to decline donation.',
      });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const confirmAccept = async () => {
    if (!selectedDonation || accepting) return;
    const donation = selectedDonation;
    setAccepting(true);

    let qrData: string | null = null;
    let assignedVolunteer: string | null = null;

    try {
      const response = await fetch('/api/donations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId: donation._id }),
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
        setNotification({
          type: 'error',
          message: data.error || 'Failed to accept donation. Please try again.',
        });
        setAccepting(false);
        return;
      }

      assignedVolunteer = data.data?.volunteer?.name || null;

      // Generate the drop-off QR code (server-side, JWT-signed, persisted)
      const qr = await generateDeliveryQR(donation._id);
      if (qr) qrData = qr;
    } catch {
      setNotification({
        type: 'error',
        message: 'Network error. Failed to accept donation.',
      });
      setAccepting(false);
      return;
    }

    // Reconcile with the server in the background
    fetchDonations();
    fetchPickups();

    // Real-time stats: Accepted Today increments
    setAcceptedToday((n) => n + 1);

    // Notify the assigned volunteer (surfaces in their notification bell)
    if (assignedVolunteer) {
      window.dispatchEvent(
        new CustomEvent('fsai:notification', {
          detail: {
            title: `Volunteer assigned: ${assignedVolunteer} 🚚`,
            message: `${assignedVolunteer} has been dispatched for ${(donation.items || [])
              .map((item) => item.name)
              .join(', ')}.`,
            href: '/volunteer',
          },
        })
      );
    }

    setShowAcceptModal(false);
    setAcceptSuccess(qrData);
    setAccepting(false);
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  // Live feed filtering for the "Available Food (Live)" quick action
  const visibleDonations =
    feedFilter === 'urgent'
      ? donations.filter((d) => d.urgencyScore >= 60)
      : donations;

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  // If the API told us we're not authenticated (or lack permission), show a
  // clean prompt instead of a blank/broken dashboard.
  if (authError) {
    return <AuthPrompt mode={authError} redirectTo="/ngo" />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">NGO Portal</h1>
          <p className="text-gray-600 mt-1">
            Receive and distribute food donations to communities in need
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Live Feed Active</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Accepting Donations</span>
            <button
              onClick={toggleCapacity}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                capacityEnabled ? 'bg-green-500' : 'bg-orange-400'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  capacityEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <p className="text-2xl font-bold text-gray-900">{donations.length}</p>
              <p className="text-sm text-gray-500">Available Donations</p>
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
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {donations.filter((d) => d.urgencyScore >= 80).length}
              </p>
              <p className="text-sm text-gray-500">Urgent</p>
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
              <p className="text-2xl font-bold text-gray-900">{acceptedToday}</p>
              <p className="text-sm text-gray-500">Accepted Today</p>
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
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">500</p>
              <p className="text-sm text-gray-500">Beneficiaries</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Incoming Donations Feed */}
      <div id="live-feed" className="scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Incoming Donations
          </h2>
          <span className="text-sm text-gray-500">
            Auto-refreshes every 5 seconds
          </span>
        </div>

        {/* Filterable view (surfaces via the "Available Food (Live)" action) */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFeedFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              feedFilter === 'all'
                ? 'bg-green-600 text-white shadow'
                : 'bg-white/80 border border-green-100 text-gray-600 hover:bg-green-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFeedFilter('urgent')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              feedFilter === 'urgent'
                ? 'bg-red-500 text-white shadow'
                : 'bg-white/80 border border-green-100 text-gray-600 hover:bg-red-50'
            }`}
          >
            Urgent Only ⚡
          </button>
          <span className="text-xs text-gray-400">
            {visibleDonations.length} shown
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Loading donations...</p>
          </div>
        ) : visibleDonations.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-green-100">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No available donations
            </h3>
            <p className="text-gray-500">
              {feedFilter === 'urgent'
                ? 'No urgent donations right now — try the All view'
                : 'New donations will appear here automatically'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleDonations.map((donation, index) => (
              <motion.div
                key={donation._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100 hover:shadow-xl transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {(donation.image || donation.photoUrl) && (
                    <div className="relative w-full lg:w-44 h-32 lg:h-24 shrink-0">
                      <img
                        src={donation.image || donation.photoUrl}
                        alt={(donation.items || []).map((item) => item.name).join(', ')}
                        className="w-full h-full object-cover rounded-xl"
                      />
                      {donation.aiQualityScore !== undefined && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/95 text-[10px] font-bold text-slate-800 shadow-sm flex items-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              donation.aiQualityScore >= 80
                                ? 'bg-green-500'
                                : donation.aiQualityScore >= 60
                                ? 'bg-yellow-500'
                                : 'bg-orange-500'
                            }`}
                          />
                          AI Fresh {donation.aiQualityScore}%
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getUrgencyColor(donation.urgencyScore)}`}>
                        Urgency: {donation.urgencyScore}%
                      </span>
                      {donation.aiQualityScore !== undefined && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getQualityColor(donation.aiQualityScore)}`}>
                          AI Score: {donation.aiQualityScore}%
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        Expires in {getTimeUntilExpiry(donation.expiresAt)}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {(donation.items || [])
                        .map((item) => `${item.name} (${item.qty} ${item.unit})`)
                        .join(', ')}
                    </h3>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {donation.donorId?.name || 'Unknown donor'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {donation.location?.coordinates?.[1]?.toFixed(4) ?? 'N/A'}, {donation.location?.coordinates?.[0]?.toFixed(4) ?? 'N/A'}
                      </span>
                    </div>

                    {donation.notes && (
                      <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                        {donation.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDecline(donation)}
                      className="px-4 py-2 border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <XCircle className="w-5 h-5 inline mr-1" />
                      Decline
                    </button>
                    <button
                      onClick={() => handleAccept(donation)}
                      disabled={!capacityEnabled}
                      className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <CheckCircle className="w-5 h-5 inline mr-1" />
                      Accept
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Active Pickups (claimed donations) */}
      <div id="pickups" className="scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            Active Pickups
          </h2>
          <span className="text-sm text-gray-500">
            {pickups.length} awaiting pickup
          </span>
        </div>

        {pickupsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : pickups.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-10 text-center shadow-lg border border-green-100">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No active pickups
            </h3>
            <p className="text-gray-500 text-sm">
              Donations you accept will appear here with pickup status
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pickups.map((donation) => {
              const hasQr = !!(donation.deliveryQrCode || qrCodes[donation._id]);
              return (
                <motion.div
                  key={donation._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-green-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Awaiting Pickup
                      </span>
                      <span className="text-sm text-gray-500">
                        Expires in {getTimeUntilExpiry(donation.expiresAt)}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {(donation.items || [])
                        .map((item) => `${item.name} (${item.qty} ${item.unit})`)
                        .join(', ')}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {donation.donorId?.name || 'Unknown donor'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        if (!hasQr) await generateDeliveryQR(donation._id);
                        setShowDeliveryQR(donation);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                    >
                      <QrCode className="w-4 h-4" />
                      {hasQr ? 'Delivery QR' : 'Generate QR'}
                    </button>
                    <span className="text-xs text-gray-400">
                      Nearest volunteer dispatched automatically
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Accept Modal */}
      <AnimatePresence>
        {showAcceptModal && selectedDonation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAcceptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            >
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Accept Donation?
                  </h2>
                  <p className="text-gray-600">
                    The nearest active volunteer will be dispatched automatically
                  </p>
                </div>

                {/* Donation Summary */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Donation Summary
                  </h3>
                  <p className="text-sm text-gray-600">
                    {(selectedDonation.items || [])
                      .map((item) => `${item.name}: ${item.qty} ${item.unit}`)
                      .join(', ')}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    From: {selectedDonation.donorId?.name || 'Unknown donor'}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowAcceptModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAccept}
                    disabled={accepting}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {accepting ? 'Accepting...' : 'Confirm Accept'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accept Success Modal — instant feedback with the generated QR */}
      <AnimatePresence>
        {acceptSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setAcceptSuccess(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Donation Accepted!
                  </h2>
                  <p className="text-gray-600">
                    Unique QR Code Generated for Volunteer Pickup.
                  </p>
                </div>

                <div className="mb-6">
                  <QRCodeDisplay
                    data={acceptSuccess}
                    title="Delivery QR Code"
                    subtitle="Show this to the volunteer for pickup verification"
                  />
                </div>

                <button
                  onClick={() => setAcceptSuccess(null)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery QR Code Modal */}
      <AnimatePresence>
        {showDeliveryQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeliveryQR(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <QRCodeDisplay
                data={showDeliveryQR.deliveryQrCode || showDeliveryQR.pickupQrCode || qrCodes[showDeliveryQR._id] || ''}
                title="Delivery QR Code"
                subtitle="Show this to the volunteer for delivery verification"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}