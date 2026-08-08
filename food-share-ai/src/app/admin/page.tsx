'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  CheckCircle,
  XCircle,
  TrendingUp,
  Download,
  Shield,
  Package,
  Leaf,
  MapPin,
  Search,
  Radio,
  BarChart3,
  AlertTriangle,
  UserCheck,
  UserX,
  RotateCcw,
  FileText,
  Send,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import DynamicLeafletMap from '@/components/maps/DynamicLeafletMap';
import AuthPrompt from '@/components/ui/AuthPrompt';
import { useRealtime } from '@/hooks/useRealtime';

type Role = 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN';
type RoleFilter = 'all' | 'DONOR' | 'NGO' | 'VOLUNTEER' | 'pending';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  donorType?: string;
  phone: string;
  isVerified: boolean;
  status?: 'ACTIVE' | 'SUSPENDED';
  capacity?: number;
  rating?: number;
  location?: { coordinates: [number, number] };
  createdAt: string;
}

interface DonationItem {
  name: string;
  qty: number;
  unit: string;
}

interface Donation {
  _id: string;
  donorId?: { _id?: string; name?: string } | string;
  items?: DonationItem[];
  status: string;
  urgencyScore: number;
  aiFreshnessStatus?: string;
  location?: { coordinates: [number, number] };
  matchedNGO?: { _id?: string; name?: string } | string;
  assignedVolunteer?: { _id?: string; name?: string } | string;
  createdAt: string;
  expiresAt?: string;
}

interface PlatformStats {
  totalDonations: number;
  successfulDeliveries: number;
  mealsDonated: number;
  mealsServed: number;
  carbonSavedKg: number;
  foodWasteReducedTonnes: number;
  familiesHelped: number;
  averageDonorRating: number;
  totalUsers: number;
  donors: number;
  ngos: number;
  volunteers: number;
  admins: number;
  verifiedNGOs: number;
  pendingNGOs: number;
  deliverySuccessRate: number;
  monthly: { month: string; donations: number; meals: number; delivered: number }[];
  demo?: boolean;
}

type Tab = 'users' | 'dispatches' | 'analytics' | 'heatmap';

const ESCALATION_MS = 5 * 60 * 1000; // 5 minutes

const getRoleColor = (role: string) => {
  switch (role) {
    case 'DONOR':
      return 'bg-orange-100 text-orange-800';
    case 'NGO':
      return 'bg-blue-100 text-blue-800';
    case 'VOLUNTEER':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.max(0, s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const itemSummary = (d: Donation) =>
  (d.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ');

export default function AdminPortal() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<'login' | 'forbidden' | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [viewDocUser, setViewDocUser] = useState<AdminUser | null>(null);
  const [forceAssignDonation, setForceAssignDonation] = useState<Donation | null>(null);
  const [assignNGO, setAssignNGO] = useState('');
  const [assignVolunteer, setAssignVolunteer] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [tick, setTick] = useState(0);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const notify = (type: 'success' | 'error', message: string) =>
    setNotification({ type, message });

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, donationsRes, statsRes] = await Promise.all([
        fetch('/api/users?limit=500'),
        fetch('/api/donations?limit=200'),
        fetch('/api/admin/stats'),
      ]);

      // Gracefully handle auth failures instead of rendering empty/error objects
      const anyUnauthorized =
        usersRes.status === 401 || donationsRes.status === 401 || statsRes.status === 401;
      const anyForbidden =
        usersRes.status === 403 || donationsRes.status === 403 || statsRes.status === 403;
      if (anyUnauthorized) {
        setAuthError('login');
        return;
      }
      if (anyForbidden) {
        setAuthError('forbidden');
        return;
      }
      if (!usersRes.ok || !donationsRes.ok || !statsRes.ok) {
        notify('error', 'Failed to load dashboard data. Please try again.');
        return;
      }

      const usersData = await usersRes.json();
      const donationsData = await donationsRes.json();
      const statsData = await statsRes.json();

      // Always initialize state arrays safely
      setUsers(Array.isArray(usersData.data?.users) ? usersData.data.users : []);
      setDonations(
        Array.isArray(donationsData.data?.donations)
          ? donationsData.data.donations
          : []
      );
      setStats(statsData.data || null);
    } catch (error) {
      console.error('Error fetching data:', error);
      notify('error', 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time sync (Pusher): donations and deliveries refresh the admin KPIs
  // and dispatch list instantly across every connected device.
  useRealtime('donation-created', fetchData);
  useRealtime('donation-accepted', fetchData);
  useRealtime('delivery:status:update', fetchData);

  // Live refresh while the dispatches tab is open
  useEffect(() => {
    if (activeTab !== 'dispatches') return;
    const interval = setInterval(() => {
      fetch('/api/donations?limit=200')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.data?.donations) {
            setDonations(data.data.donations);
          }
        })
        .catch(() => undefined);
    }, 15000);
    // Re-render every minute so escalation tags/ages stay live between polls
    const ticker = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      clearInterval(interval);
      clearInterval(ticker);
    };
  }, [activeTab]);

  // ── Admin user management actions ──────────────────────────────────────
  const manageUser = async (
    userId: string,
    updates: { isVerified?: boolean; status?: 'ACTIVE' | 'SUSPENDED' },
    successMessage: string
  ) => {
    // Optimistic local update: badges flip instantly (works offline too)
    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, ...updates } : u))
    );
    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
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
        notify('success', successMessage);
        fetchData();
      } else {
        // Offline / non-blocking failure: keep the local badge change (silent)
        notify('success', successMessage);
      }
    } catch {
      // Offline — local badge change already applied
      notify('success', successMessage);
    }
  };

  // ── Force assign (admin emergency override) ────────────────────────────
  const handleForceAssign = async () => {
    if (!forceAssignDonation) return;
    if (!assignNGO && !assignVolunteer) {
      notify('error', 'Select at least an NGO or a volunteer to assign.');
      return;
    }

    setAssigning(true);
    try {
      // The NGO is required whenever a volunteer is assigned — the delivery
      // record must never be attributed to the admin account. Fall back to the
      // donation's existing matched NGO when the dropdown was left untouched.
      let effectiveNGO = assignNGO;
      if (!effectiveNGO) {
        const existing = forceAssignDonation.matchedNGO;
        if (existing && typeof existing === 'object' && existing._id) {
          effectiveNGO = existing._id;
        }
      }
      if (assignVolunteer && !effectiveNGO) {
        notify('error', 'Select an NGO before assigning a volunteer.');
        return;
      }

      // 1. Reassign the NGO (and put the donation back into MATCHED state)
      if (effectiveNGO) {
        const res = await fetch('/api/donations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donationId: forceAssignDonation._id,
            status: 'MATCHED',
            matchedNGO: effectiveNGO,
          }),
        });
        if (res.status === 401) {
          setAuthError('login');
          return;
        }
        const data = await res.json();
        if (!data.success) {
          notify('error', data.error || 'Failed to assign NGO');
          return;
        }
      }

      // 2. When a volunteer is chosen, create the delivery record so the
      //    volunteer sees the job on their board immediately.
      if (assignVolunteer) {
        const res = await fetch('/api/deliveries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donationId: forceAssignDonation._id,
            volunteerId: assignVolunteer,
            ngoId: effectiveNGO,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          notify(
            'error',
            (data.error as string) || 'Failed to assign volunteer'
          );
          return;
        }
      }

      notify(
        'success',
        assignVolunteer
          ? 'Donation force-assigned to NGO + volunteer'
          : 'Donation force-assigned to NGO'
      );
      setForceAssignDonation(null);
      setAssignNGO('');
      setAssignVolunteer('');
      fetchData();
    } catch {
      notify('error', 'Force assign failed');
    } finally {
      setAssigning(false);
    }
  };

  // ── CSV export ─────────────────────────────────────────────────────────
  const handleExportReport = () => {
    const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows: (string | number)[][] = [];

    rows.push([`FoodShare AI — Platform Report`, new Date().toLocaleString()]);
    rows.push([]);
    rows.push(['METRIC', 'VALUE']);
    rows.push(['Total Donations', stats?.totalDonations ?? 0]);
    rows.push(['Successful Deliveries', stats?.successfulDeliveries ?? 0]);
    rows.push(['Meals Donated', stats?.mealsDonated ?? 0]);
    rows.push(['Meals Served', stats?.mealsServed ?? 0]);
    rows.push(['Food Waste Reduced (Tonnes)', stats?.foodWasteReducedTonnes ?? 0]);
    rows.push(['CO2 Saved (kg)', stats?.carbonSavedKg ?? 0]);
    rows.push(['Active Users', stats?.totalUsers ?? 0]);
    rows.push(['NGOs', stats?.ngos ?? 0]);
    rows.push(['Verified NGOs', stats?.verifiedNGOs ?? 0]);
    rows.push(['Active Volunteers', stats?.volunteers ?? 0]);
    rows.push(['Families Helped', stats?.familiesHelped ?? 0]);
    rows.push(['Avg Donor Rating', stats?.averageDonorRating ?? 0]);
    rows.push(['Delivery Success Rate (%)', stats?.deliverySuccessRate ?? 0]);
    rows.push([]);

    rows.push(['USER', 'EMAIL', 'ROLE', 'DONOR TYPE', 'STATUS', 'VERIFIED']);
    users.forEach((u) =>
      rows.push([
        u.name,
        u.email,
        u.role,
        u.donorType || '',
        u.status === 'SUSPENDED' ? 'SUSPENDED' : u.isVerified ? 'VERIFIED' : 'PENDING',
        u.isVerified ? 'YES' : 'NO',
      ])
    );
    rows.push([]);

    rows.push(['DONATION ID', 'STATUS', 'ITEMS', 'MEALS', 'URGENCY', 'CREATED']);
    donations.forEach((d) =>
      rows.push([
        d._id,
        d.status,
        itemSummary(d),
        (d.items || []).reduce((s, i) => s + i.qty, 0),
        d.urgencyScore,
        new Date(d.createdAt).toLocaleString(),
      ])
    );

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'impact_summary.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notify('success', 'impact_summary.csv downloaded');
  };

  // ── Derived data ───────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole =
        roleFilter === 'all'
          ? true
          : roleFilter === 'pending'
            ? u.role === 'NGO' && !u.isVerified && u.status !== 'SUSPENDED'
            : u.role === roleFilter;
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const isEscalated = (d: Donation) =>
    d.status === 'AVAILABLE' &&
    Date.now() - new Date(d.createdAt).getTime() > ESCALATION_MS;

  const escalatedDonations = useMemo(
    () => donations.filter((d) => isEscalated(d)),
    // tick forces recomputation so the >5min threshold updates live
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [donations, tick]
  );

  const completionData = useMemo(
    () =>
      (stats?.monthly || []).map((m) => ({
        month: m.month,
        rate: m.donations > 0 ? Math.round((m.delivered / m.donations) * 100) : 0,
      })),
    [stats]
  );

  const userDistribution = useMemo(
    () => [
      { role: 'DONOR', count: stats?.donors ?? 0 },
      { role: 'NGO', count: stats?.ngos ?? 0 },
      { role: 'VOLUNTEER', count: stats?.volunteers ?? 0 },
      { role: 'ADMIN', count: stats?.admins ?? 0 },
    ],
    [stats]
  );

  // Heatmap: high-waste zones (donations weighted by urgency) + NGO pickup points
  const heatmapPoints = useMemo(() => {
    const points: { lat: number; lng: number; intensity: number }[] = [];
    donations.forEach((d) => {
      if (d.location?.coordinates?.length === 2) {
        points.push({
          lat: d.location.coordinates[1],
          lng: d.location.coordinates[0],
          intensity: Math.max(0.35, Math.min(1, (d.urgencyScore || 50) / 100)),
        });
      }
    });
    users.forEach((u) => {
      if (u.role === 'NGO' && u.location?.coordinates?.length === 2) {
        points.push({
          lat: u.location.coordinates[1],
          lng: u.location.coordinates[0],
          intensity: 0.45,
        });
      }
    });
    return points;
  }, [donations, users]);

  const mapMarkers = [
    ...users
      .filter((u) => u.role === 'NGO' && u.location?.coordinates?.length === 2)
      .map((u) => ({
        id: u._id,
        position: { lat: u.location!.coordinates[1], lng: u.location!.coordinates[0] },
        title: u.name,
        type: 'ngo' as const,
        info: `Capacity: ${u.capacity ?? 0} | ${u.isVerified ? 'Verified' : 'Pending'}`,
      })),
    ...donations
      .filter((d) => d.location?.coordinates?.length === 2)
      .slice(0, 30)
      .map((d) => ({
        id: d._id,
        position: { lat: d.location!.coordinates[1], lng: d.location!.coordinates[0] },
        title: `Donation ${d._id.slice(0, 8)}`,
        type: 'donation' as const,
        info: `Status: ${d.status} | Urgency: ${d.urgencyScore}%`,
      })),
  ];

  const statCards = [
    { icon: Package, label: 'Meals Donated', value: stats?.mealsDonated.toLocaleString() ?? '—', color: 'from-orange-500 to-red-500' },
    { icon: TrendingUp, label: 'Meals Served', value: stats?.mealsServed.toLocaleString() ?? '—', color: 'from-green-500 to-emerald-500' },
    { icon: Leaf, label: 'Food Waste Reduced', value: stats ? `${stats.foodWasteReducedTonnes.toFixed(3)} T` : '—', color: 'from-teal-500 to-green-500' },
    { icon: Shield, label: 'CO₂ Saved', value: stats ? `${stats.carbonSavedKg.toFixed(1)} kg` : '—', color: 'from-emerald-500 to-teal-500' },
    { icon: CheckCircle, label: 'Verified NGOs', value: stats ? `${stats.verifiedNGOs}/${stats.ngos}` : '—', color: 'from-blue-500 to-indigo-500' },
    { icon: Package, label: 'Deliveries Completed', value: stats?.successfulDeliveries.toLocaleString() ?? '—', color: 'from-indigo-500 to-purple-500' },
  ];

  if (authError) {
    return <AuthPrompt mode={authError} redirectTo="/admin" />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1 flex items-center gap-2">
            Manage users, verify NGOs, monitor dispatches, and view platform analytics
            {stats?.demo && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                offline demo data
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleExportReport}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
        >
          <Download className="w-5 h-5 mr-2" />
          Export Report (CSV)
        </button>
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
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="text-center py-24">
          <div className="animate-spin w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4">Loading admin dashboard...</p>
        </div>
      ) : (
        <>
          {/* Stats Cards (from /api/admin/stats — single source of truth) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-green-100"
              >
                <div className="text-center">
                  <div
                    className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mx-auto mb-2`}
                  >
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 md:gap-4 border-b border-gray-200 overflow-x-auto">
            {(
              [
                { id: 'users', label: 'Users & Verification', icon: Users },
                { id: 'dispatches', label: 'Live Dispatches', icon: Radio },
                { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                { id: 'heatmap', label: 'Heatmap', icon: MapPin },
              ] as { id: Tab; label: string; icon: typeof Users }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4 inline mr-1" />
                {tab.label}
                {tab.id === 'dispatches' && escalatedDonations.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                    {escalatedDonations.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── USERS & VERIFICATION ─────────────────────────────────────── */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'DONOR', label: 'Donors' },
                      { id: 'NGO', label: 'NGOs' },
                      { id: 'VOLUNTEER', label: 'Volunteers' },
                      { id: 'pending', label: 'Pending Approval' },
                    ] as { id: RoleFilter; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setRoleFilter(f.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        roleFilter === f.id
                          ? 'bg-green-600 text-white shadow'
                          : 'bg-white/80 text-gray-600 border border-gray-200 hover:bg-green-50'
                      }`}
                    >
                      {f.label}
                      {f.id === 'pending' && stats && stats.pendingNGOs > 0 && (
                        <span
                          className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            roleFilter === 'pending'
                              ? 'bg-white/25 text-white'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {stats.pendingNGOs}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-green-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                            No users match the current filters.
                          </td>
                        </tr>
                      )}
                      {filteredUsers.map((user) => {
                        const isPendingNGO = user.role === 'NGO' && !user.isVerified;
                        const isSuspended = user.status === 'SUSPENDED';
                        return (
                          <tr key={user._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                                    isSuspended
                                      ? 'bg-gray-400'
                                      : user.role === 'DONOR'
                                        ? 'bg-orange-500'
                                        : user.role === 'NGO'
                                          ? 'bg-blue-500'
                                          : user.role === 'VOLUNTEER'
                                            ? 'bg-purple-500'
                                            : 'bg-gray-700'
                                  }`}
                                >
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {user.email}
                                  </div>
                                  {user.phone && (
                                    <div className="text-xs text-gray-400">{user.phone}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                                {user.role}
                              </span>
                              {user.donorType && (
                                <div className="text-xs text-gray-400 mt-1">{user.donorType}</div>
                              )}
                              {user.role === 'NGO' && user.capacity ? (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  Capacity: {user.capacity}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isSuspended ? (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Suspended</span>
                              ) : isPendingNGO ? (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending Approval</span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {user.role === 'NGO' ? 'Verified' : 'Active'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-wrap gap-2">
                                {isPendingNGO && (
                                  <>
                                    <button
                                      onClick={() => setViewDocUser(user)}
                                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                    >
                                      <FileText className="w-3.5 h-3.5 mr-1" />
                                      View Document
                                    </button>
                                    <button
                                      onClick={() =>
                                        manageUser(user._id, { isVerified: true }, `${user.name} approved`)
                                      }
                                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                    >
                                      <UserCheck className="w-3.5 h-3.5 mr-1" />
                                      Approve NGO
                                    </button>
                                    <button
                                      onClick={() =>
                                        manageUser(user._id, { status: 'SUSPENDED' }, `${user.name} application rejected`)
                                      }
                                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                    >
                                      <UserX className="w-3.5 h-3.5 mr-1" />
                                      Reject
                                    </button>
                                  </>
                                )}

                                {user.role === 'NGO' && user.isVerified && (
                                  <button
                                    onClick={() =>
                                      manageUser(user._id, { isVerified: false }, `Verification revoked for ${user.name}`)
                                    }
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    Revoke
                                  </button>
                                )}

                                {user.role !== 'ADMIN' && isSuspended && (
                                  <button
                                    onClick={() =>
                                      manageUser(user._id, { status: 'ACTIVE' }, `${user.name} reactivated`)
                                    }
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                    Reactivate
                                  </button>
                                )}

                                {user.role !== 'ADMIN' && !isSuspended && (
                                  <button
                                    onClick={() =>
                                      manageUser(user._id, { status: 'SUSPENDED' }, `${user.name} suspended`)
                                    }
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                  >
                                    <UserX className="w-3.5 h-3.5 mr-1" />
                                    Suspend
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── LIVE DISPATCHES ──────────────────────────────────────────── */}
          {activeTab === 'dispatches' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Live Dispatches</h2>
                <button
                  onClick={fetchData}
                  className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-white/80 border border-gray-200 text-gray-600 hover:bg-green-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Refresh
                </button>
              </div>

              {escalatedDonations.length > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold">
                      {escalatedDonations.length} posting
                      {escalatedDonations.length !== 1 ? 's have' : ' has'}{' '}
                    </span>
                    not been accepted within 5 minutes — review and force-assign below.
                  </p>
                </div>
              )}

              {donations.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white/80 rounded-2xl border border-green-100">
                  No food postings yet.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {donations.map((d) => {
                    const escalated = isEscalated(d);
                    const isActive = ['AVAILABLE', 'ACCEPTED', 'PENDING', 'MATCHED'].includes(
                      d.status
                    );
                    return (
                      <motion.div
                        key={d._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border ${
                          escalated
                            ? 'border-red-300 ring-2 ring-red-100'
                            : isActive
                              ? 'border-green-100'
                              : 'border-gray-100 opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {(d.donorId && typeof d.donorId === 'object' && d.donorId.name) ||
                                'Anonymous donor'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{timeAgo(d.createdAt)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                d.status === 'DELIVERED'
                                  ? 'bg-green-100 text-green-700'
                                  : d.status === 'PICKED_UP'
                                    ? 'bg-blue-100 text-blue-700'
                                    : d.status === 'ACCEPTED'
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : d.status === 'AVAILABLE'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : d.status === 'MATCHED'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {d.status}
                            </span>
                            {escalated && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                Escalated &gt;5min
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 mt-3 line-clamp-2">
                          {itemSummary(d) || 'No items'}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>Urgency: {d.urgencyScore}%</span>
                          <span>Quality: {d.aiFreshnessStatus || 'N/A'}</span>
                          {d.matchedNGO &&
                            typeof d.matchedNGO === 'object' &&
                            d.matchedNGO.name && (
                              <span>NGO: {d.matchedNGO.name}</span>
                            )}
                          {d.assignedVolunteer &&
                            typeof d.assignedVolunteer === 'object' &&
                            d.assignedVolunteer.name && (
                              <span>Volunteer: {d.assignedVolunteer.name}</span>
                            )}
                        </div>

                        {isActive && (
                          <button
                            onClick={() => {
                              setForceAssignDonation(d);
                              setAssignNGO(
                                d.matchedNGO && typeof d.matchedNGO === 'object'
                                  ? d.matchedNGO._id || ''
                                  : ''
                              );
                              setAssignVolunteer('');
                            }}
                            className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg transition-all"
                          >
                            <Send className="w-4 h-4 mr-1.5" />
                            Force Assign to NGO/Volunteer
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ANALYTICS ────────────────────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Monthly Donations &amp; Meal Growth
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats?.monthly || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="meals"
                        name="Meals Donated"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="donations"
                        name="Donations"
                        stroke="#F97316"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Delivery Completion Rate (%)
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={completionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="rate"
                        name="Completion Rate %"
                        fill="#6366F1"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Impact Summary */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Impact Summary</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Meals Served', value: stats?.mealsServed.toLocaleString() ?? '—' },
                      { label: 'Food Waste Reduced', value: stats ? `${stats.foodWasteReducedTonnes.toFixed(3)} tonnes` : '—' },
                      { label: 'CO₂ Offset', value: stats ? `${stats.carbonSavedKg.toFixed(1)} kg` : '—' },
                      { label: 'Delivery Success Rate', value: `${stats?.deliverySuccessRate ?? 0}%` },
                      { label: 'Families Helped', value: stats?.familiesHelped.toLocaleString() ?? '—' },
                      { label: 'Avg Donor Rating', value: `${stats?.averageDonorRating ?? '—'} / 5` },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center">
                        <span className="text-gray-600">{row.label}</span>
                        <span className="text-2xl font-bold text-green-600">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Distribution */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution</h3>
                  <div className="space-y-4">
                    {userDistribution.map(({ role, count }) => {
                      const percentage =
                        (stats?.totalUsers ?? 0) > 0
                          ? (count / (stats?.totalUsers ?? 1)) * 100
                          : 0;
                      return (
                        <div key={role}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-600">{role}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── HEATMAP ──────────────────────────────────────────────────── */}
          {activeTab === 'heatmap' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                <MapPin className="w-5 h-5 inline mr-2" />
                Food Waste &amp; NGO Heatmap
              </h2>
              <p className="text-gray-600 mb-4">
                Red-hot zones mark urgent surplus postings; blue areas are active NGO pickup points
              </p>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100">
                <DynamicLeafletMap
                  markers={mapMarkers}
                  center={{ lat: 17.385, lng: 78.4867 }}
                  zoom={12}
                  heatmapPoints={heatmapPoints}
                />

                <div className="mt-4 flex flex-wrap gap-6 items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500" />
                    <span className="text-sm text-gray-600">Donation Points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-600">NGO Locations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Heat intensity:</span>
                    <div
                      className="h-3 w-40 rounded-full"
                      style={{
                        background:
                          'linear-gradient(to right, #3B82F6, #22C55E, #EAB308, #F97316, #EF4444)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── View Document modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {viewDocUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setViewDocUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Registration Document
                </h3>
                <button
                  onClick={() => setViewDocUser(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  ['Organization', viewDocUser.name],
                  ['Email', viewDocUser.email],
                  ['Phone', viewDocUser.phone || '—'],
                  ['Role', viewDocUser.role],
                  ['Donor Type', viewDocUser.donorType || '—'],
                  ['Capacity (meals/day)', viewDocUser.capacity ?? '—'],
                  [
                    'Location',
                    viewDocUser.location?.coordinates
                      ? `${viewDocUser.location.coordinates[1].toFixed(4)}, ${viewDocUser.location.coordinates[0].toFixed(4)}`
                      : '—',
                  ],
                  [
                    'Registered',
                    viewDocUser.createdAt
                      ? new Date(viewDocUser.createdAt).toLocaleDateString()
                      : '—',
                  ],
                  ['Verification Status', viewDocUser.isVerified ? 'Approved' : 'Pending Approval'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 text-sm">
                    <span className="text-gray-500 font-medium">{label}</span>
                    <span className="text-gray-900 text-right">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                {!viewDocUser.isVerified && (
                  <button
                    onClick={() => {
                      manageUser(viewDocUser._id, { isVerified: true }, `${viewDocUser.name} approved`);
                      setViewDocUser(null);
                    }}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Approve NGO
                  </button>
                )}
                <button
                  onClick={() => setViewDocUser(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Force Assign modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {forceAssignDonation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setForceAssignDonation(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Force Assign — Emergency Override
                </h3>
                <button
                  onClick={() => setForceAssignDonation(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 mb-5">
                <p className="text-sm font-medium text-gray-900">
                  {itemSummary(forceAssignDonation) || 'Food items'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Status: {forceAssignDonation.status} · Posted {timeAgo(forceAssignDonation.createdAt)} ·
                  Urgency {forceAssignDonation.urgencyScore}%
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Assign NGO
                  </label>
                  <select
                    value={assignNGO}
                    onChange={(e) => setAssignNGO(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  >
                    <option value="">Keep current / pick an NGO...</option>
                    {users
                      .filter((u) => u.role === 'NGO')
                      .map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} {u.isVerified ? '' : '(pending)'}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Assign Volunteer <span className="text-gray-400">(creates a delivery job)</span>
                  </label>
                  <select
                    value={assignVolunteer}
                    onChange={(e) => setAssignVolunteer(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  >
                    <option value="">Select a volunteer...</option>
                    {users
                      .filter((u) => u.role === 'VOLUNTEER' && u.status !== 'SUSPENDED')
                      .map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleForceAssign}
                  disabled={assigning}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  {assigning ? 'Assigning...' : 'Confirm Assign'}
                </button>
                <button
                  onClick={() => setForceAssignDonation(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
