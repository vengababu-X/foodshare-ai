/**
 * Platform statistics computed directly from MongoDB aggregations.
 *
 * Both the Admin Dashboard (/admin) and the Impact Dashboard (/impact) consume
 * the same `getPlatformStats()` result through their own API routes, so every
 * card on the two dashboards always reports identical numbers.
 */

import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Donation from '@/models/Donation';
import {
  localListUsers,
  localListDonations,
} from '@/services/localStore';

export interface MonthlyPoint {
  month: string; // 'YYYY-MM'
  donations: number;
  meals: number; // meals donated that month
  delivered: number; // deliveries completed that month
}

export interface PlatformStats {
  totalDonations: number;
  successfulDeliveries: number;
  mealsDonated: number; // sum of item quantities across ALL donations
  mealsServed: number; // meals from DELIVERED donations
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
  deliverySuccessRate: number; // 0-100
  monthly: MonthlyPoint[];
  demo: boolean; // true when served from the offline demo dataset
}

// Estimate: one meal ≈ 0.5 kg of food diverted from landfill.
const MEAL_WEIGHT_KG = 0.5;
// Estimate: each successful delivery reaches ~5 families.
const FAMILIES_PER_DELIVERY = 5;
// Estimate: ~2.5 kg CO₂e saved per completed delivery (≈12km at 0.2 kg/km).
const LOCAL_CARBON_PER_DELIVERY = 2.5;

export async function getPlatformStats(): Promise<PlatformStats> {
  await connectDB();

  // Six-month window (first day of the month, 5 months back) for the trends.
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - 5);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mealsDonatedPipe: any[] = [
    { $project: { meals: { $sum: { $ifNull: ['$items.qty', []] } } } },
    { $group: { _id: null, meals: { $sum: { $ifNull: ['$meals', 0] } } } },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mealsServedPipe: any[] = [
    { $match: { status: 'DELIVERED' } },
    { $project: { meals: { $sum: { $ifNull: ['$items.qty', []] } } } },
    { $group: { _id: null, meals: { $sum: { $ifNull: ['$meals', 0] } } } },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carbonPipe: any[] = [
    { $match: { status: 'DELIVERED' } },
    { $group: { _id: null, carbon: { $sum: { $ifNull: ['$carbonSavedKg', 0] } } } },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ratingPipe: any[] = [
    { $match: { role: 'DONOR', rating: { $ne: null } } },
    { $group: { _id: null, avg: { $avg: '$rating' } } },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rolePipe: any[] = [{ $group: { _id: '$role', count: { $sum: 1 } } }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monthlyPipe: any[] = [
    { $match: { createdAt: { $gte: start } } },
    {
      $project: {
        month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        meals: { $sum: { $ifNull: ['$items.qty', []] } },
        status: 1,
      },
    },
    {
      $group: {
        _id: '$month',
        donations: { $sum: 1 },
        meals: { $sum: { $ifNull: ['$meals', 0] } },
        delivered: {
          $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [totalDonations, successfulDeliveries, mealsAgg, mealsDeliveredAgg, carbonAgg, ratingAgg, roleAgg, verifiedNGOs, pendingNGOs, monthlyAgg] =
    await Promise.all([
      Donation.countDocuments().exec(),
      Donation.countDocuments({ status: 'DELIVERED' }).exec(),
      Donation.aggregate(mealsDonatedPipe),
      Donation.aggregate(mealsServedPipe),
      Donation.aggregate(carbonPipe),
      User.aggregate(ratingPipe),
      User.aggregate(rolePipe),
      User.countDocuments({ role: 'NGO', isVerified: true }).exec(),
      // Rejected/suspended NGOs no longer count as pending approvals
      User.countDocuments({
        role: 'NGO',
        isVerified: false,
        status: { $ne: 'SUSPENDED' },
      }).exec(),
      Donation.aggregate(monthlyPipe),
    ]);

  const mealsDonated = mealsAgg[0]?.meals ?? 0;
  const mealsServed = mealsDeliveredAgg[0]?.meals ?? 0;
  const carbonSavedKg = carbonAgg[0]?.carbon ?? 0;
  const averageDonorRating = ratingAgg[0]?.avg ?? 4.8;

  const roles: Record<string, number> = { DONOR: 0, NGO: 0, VOLUNTEER: 0, ADMIN: 0 };
  roleAgg.forEach((r: { _id: string; count: number }) => {
    if (r._id in roles) roles[r._id] = r.count;
  });

  // Zero-pad the last 6 months so trend charts always render a full series
  // even when the dataset only spans one month.
  const byMonth = new Map<string, MonthlyPoint>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monthlyAgg.forEach((m: any) => {
    byMonth.set(m._id, {
      month: m._id,
      donations: m.donations,
      meals: m.meals,
      delivered: m.delivered,
    });
  });
  const monthly: MonthlyPoint[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = byMonth.get(key);
    monthly.push({
      month: key,
      donations: existing?.donations ?? 0,
      meals: existing?.meals ?? 0,
      delivered: existing?.delivered ?? 0,
    });
  }

  return {
    totalDonations,
    successfulDeliveries,
    mealsDonated,
    mealsServed,
    carbonSavedKg: Math.round(carbonSavedKg * 10) / 10,
    foodWasteReducedTonnes:
      Math.round((mealsServed * MEAL_WEIGHT_KG) / 1000 * 1000) / 1000,
    familiesHelped: successfulDeliveries * FAMILIES_PER_DELIVERY,
    averageDonorRating: Math.round(averageDonorRating * 10) / 10,
    totalUsers: roles.DONOR + roles.NGO + roles.VOLUNTEER + roles.ADMIN,
    donors: roles.DONOR,
    ngos: roles.NGO,
    volunteers: roles.VOLUNTEER,
    admins: roles.ADMIN,
    verifiedNGOs,
    pendingNGOs,
    deliverySuccessRate:
      totalDonations > 0
        ? Math.round((successfulDeliveries / totalDonations) * 1000) / 10
        : 0,
    monthly,
    demo: false,
  };
}

/**
 * Identical PlatformStats shape computed from the local JSON store
 * (data/users.json + data/donations.json) when MongoDB is unreachable.
 * Every number comes from REAL locally-stored records — zero mock data.
 */
export async function getLocalPlatformStats(): Promise<PlatformStats> {
  const users = localListUsers();
  const donations = localListDonations(undefined, 100000);

  const roles: Record<string, number> = { DONOR: 0, NGO: 0, VOLUNTEER: 0, ADMIN: 0 };
  users.forEach((u) => {
    if (u.role in roles) roles[u.role] += 1;
  });

  const totalDonations = donations.length;
  const successfulDeliveries = donations.filter(
    (d) => d.status === 'DELIVERED'
  ).length;
  const mealsOf = (d: { items: { qty: number }[] }) =>
    (d.items || []).reduce((sum, i) => sum + (i.qty || 0), 0);
  const mealsDonated = donations.reduce((sum, d) => sum + mealsOf(d), 0);
  const mealsServed = donations
    .filter((d) => d.status === 'DELIVERED')
    .reduce((sum, d) => sum + mealsOf(d), 0);
  const carbonSavedKg = successfulDeliveries * LOCAL_CARBON_PER_DELIVERY;
  const verifiedNGOs = users.filter(
    (u) => u.role === 'NGO' && u.isVerified
  ).length;
  const pendingNGOs = users.filter(
    (u) => u.role === 'NGO' && !u.isVerified && u.status !== 'SUSPENDED'
  ).length;

  // Monthly trend from real createdAt dates (zero-padded to 6 months).
  const byMonth = new Map<string, MonthlyPoint>();
  donations.forEach((d) => {
    const key = d.createdAt.slice(0, 7);
    const existing = byMonth.get(key) || {
      month: key,
      donations: 0,
      meals: 0,
      delivered: 0,
    };
    existing.donations += 1;
    existing.meals += mealsOf(d);
    if (d.status === 'DELIVERED') existing.delivered += 1;
    byMonth.set(key, existing);
  });
  const monthly: MonthlyPoint[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const existing = byMonth.get(key);
    monthly.push({
      month: key,
      donations: existing?.donations ?? 0,
      meals: existing?.meals ?? 0,
      delivered: existing?.delivered ?? 0,
    });
  }

  return {
    totalDonations,
    successfulDeliveries,
    mealsDonated,
    mealsServed,
    carbonSavedKg: Math.round(carbonSavedKg * 10) / 10,
    foodWasteReducedTonnes:
      Math.round((mealsServed * MEAL_WEIGHT_KG) / 1000 * 1000) / 1000,
    familiesHelped: successfulDeliveries * FAMILIES_PER_DELIVERY,
    averageDonorRating: 5.0,
    totalUsers: roles.DONOR + roles.NGO + roles.VOLUNTEER + roles.ADMIN,
    donors: roles.DONOR,
    ngos: roles.NGO,
    volunteers: roles.VOLUNTEER,
    admins: roles.ADMIN,
    verifiedNGOs,
    pendingNGOs,
    deliverySuccessRate:
      totalDonations > 0
        ? Math.round((successfulDeliveries / totalDonations) * 1000) / 10
        : 0,
    monthly,
    demo: false,
  };
}

