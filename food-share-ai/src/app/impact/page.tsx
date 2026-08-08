'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Utensils,
  Users,
  Truck,
  Leaf,
  Award,
  Heart,
  BarChart3,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import DynamicLeafletMap from '@/components/maps/DynamicLeafletMap';

interface ImpactStats {
  mealsDonated: number;
  mealsServed: number;
  ngosConnected: number;
  activeVolunteers: number;
  foodWasteReducedTonnes: number;
  co2Saved: number;
  successfulDeliveries: number;
  familiesHelped: number;
  averageDonorRating: number;
  totalDonations: number;
  deliverySuccessRate: number;
  monthly: { month: string; donations: number; meals: number; delivered: number }[];
  demo?: boolean;
}

const EMPTY_STATS: ImpactStats = {
  mealsDonated: 0,
  mealsServed: 0,
  ngosConnected: 0,
  activeVolunteers: 0,
  foodWasteReducedTonnes: 0,
  co2Saved: 0,
  successfulDeliveries: 0,
  familiesHelped: 0,
  averageDonorRating: 0,
  totalDonations: 0,
  deliverySuccessRate: 0,
  monthly: [],
};

export default function ImpactPage() {
  const [stats, setStats] = useState<ImpactStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchImpactData = async () => {
      try {
        const res = await fetch('/api/impact/stats');
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data) {
          setStats({
            mealsDonated: data.data.mealsDonated ?? 0,
            mealsServed: data.data.mealsServed ?? 0,
            ngosConnected: data.data.verifiedNGOs ?? 0,
            activeVolunteers: data.data.volunteers ?? 0,
            foodWasteReducedTonnes: data.data.foodWasteReducedTonnes ?? 0,
            co2Saved: data.data.carbonSavedKg ?? 0,
            successfulDeliveries: data.data.successfulDeliveries ?? 0,
            familiesHelped: data.data.familiesHelped ?? 0,
            averageDonorRating: data.data.averageDonorRating ?? 0,
            totalDonations: data.data.totalDonations ?? 0,
            deliverySuccessRate: data.data.deliverySuccessRate ?? 0,
            monthly: Array.isArray(data.data.monthly) ? data.data.monthly : [],
            demo: data.data.demo,
          });
        }
      } catch (error) {
        console.error('Error fetching impact data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchImpactData();
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = [
    { icon: Utensils, label: 'Meals Donated', value: stats.mealsDonated.toLocaleString(), color: 'from-orange-500 to-red-500' },
    { icon: Users, label: 'NGOs Connected', value: stats.ngosConnected, color: 'from-blue-500 to-cyan-500' },
    { icon: Truck, label: 'Active Volunteers', value: stats.activeVolunteers, color: 'from-purple-500 to-pink-500' },
    { icon: Leaf, label: 'Food Waste Reduced', value: `${stats.foodWasteReducedTonnes.toFixed(3)} T`, color: 'from-green-500 to-emerald-500' },
    { icon: TrendingUp, label: 'CO₂ Saved', value: `${stats.co2Saved.toFixed(1)} kg`, color: 'from-teal-500 to-green-500' },
    { icon: Award, label: 'Successful Deliveries', value: stats.successfulDeliveries.toLocaleString(), color: 'from-indigo-500 to-purple-500' },
    { icon: Heart, label: 'Families Helped', value: stats.familiesHelped.toLocaleString(), color: 'from-pink-500 to-rose-500' },
    { icon: BarChart3, label: 'Avg Donor Rating', value: stats.averageDonorRating.toFixed(1), color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-gray-900 mb-2"
        >
          Impact Dashboard
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-600 flex items-center justify-center gap-2"
        >
          Real-time tracking of our collective impact on fighting food waste
          {stats.demo && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              offline demo data
            </span>
          )}
        </motion.p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4">Loading impact data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100 hover:shadow-xl transition-shadow"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Impact Over Time */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            Meals &amp; Donations Over Time
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stats.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="meals"
                name="Meals Donated"
                stroke="#F97316"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="donations"
                name="Donations"
                stroke="#10B981"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Delivery Performance */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Impact Summary
          </h2>
          <div className="space-y-4">
            {[
              { label: 'Meals Served', value: stats.mealsServed.toLocaleString() },
              { label: 'Total Donations', value: stats.totalDonations.toLocaleString() },
              { label: 'Successful Deliveries', value: stats.successfulDeliveries.toLocaleString() },
              {
                label: 'Delivery Success Rate',
                value: `${stats.deliverySuccessRate}%`,
              },
              { label: 'Families Helped', value: stats.familiesHelped.toLocaleString() },
              {
                label: 'Avg Donor Rating',
                value: `${stats.averageDonorRating.toFixed(1)} / 5`,
              },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <span className="text-gray-600">{row.label}</span>
                <span className="text-2xl font-bold text-green-600">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Global Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Global Impact Heatmap
        </h2>
        <DynamicLeafletMap
          markers={[
            {
              id: '1',
              position: { lat: 17.385, lng: 78.4867 },
              title: 'Hyderabad Hub',
              type: 'donation',
              info: `${stats.mealsServed.toLocaleString()} meals served`,
            },
            {
              id: '2',
              position: { lat: 19.076, lng: 72.8777 },
              title: 'Mumbai Hub',
              type: 'ngo',
              info: 'NGO Partner',
            },
            {
              id: '3',
              position: { lat: 28.6139, lng: 77.209 },
              title: 'Delhi Hub',
              type: 'volunteer',
              info: 'Volunteer Network',
            },
          ]}
          center={{ lat: 20.5937, lng: 78.9629 }}
          zoom={5}
        />
      </motion.div>

      {/* Carbon Offset Explanation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 text-white"
      >
        <div className="max-w-3xl mx-auto text-center">
          <Leaf className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">
            Your Environmental Impact
          </h2>
          <p className="text-green-100 mb-6">
            Every food donation helps reduce carbon emissions and food waste.
            By redirecting surplus food to those in need, we're creating a
            more sustainable future together.
          </p>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-3xl font-bold">{stats.co2Saved.toFixed(1)} kg</p>
              <p className="text-green-100 text-sm">CO₂ Emissions Saved</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.foodWasteReducedTonnes.toFixed(3)} T</p>
              <p className="text-green-100 text-sm">Food Waste Reduced</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.familiesHelped}</p>
              <p className="text-green-100 text-sm">Families Helped</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
