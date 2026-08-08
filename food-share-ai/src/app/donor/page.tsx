'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Plus,
  Clock,
  MapPin,
  Trash2,
  AlertCircle,
  CheckCircle,
  Leaf,
  Users,
  Sparkles,
  Award,
  Utensils,
} from 'lucide-react';
import DynamicLeafletMap from '@/components/maps/DynamicLeafletMap';
import AuthPrompt from '@/components/ui/AuthPrompt';
import PhotoUpload from '@/components/ui/PhotoUpload';
import QRCodeDisplay from '@/components/ui/QRCodeDisplay';
import ESGCertificate from '@/components/ui/ESGCertificate';
import {
  DONATE_EVENT,
  consumeDonationModalRequest,
  consumeScrollAction,
} from '@/lib/headerActions';
import { useRealtime } from '@/hooks/useRealtime';

interface DonationItem {
  name: string;
  qty: number;
  unit: string;
}

interface Donation {
  _id: string;
  items: DonationItem[];
  cookedAt: string;
  expiresAt: string;
  urgencyScore: number;
  aiQualityScore?: number;
  aiFreshnessStatus?: 'APPROVED' | 'REJECTED';
  status: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  image?: string;
  photoUrl?: string;
  notes?: string;
  matchedNGO?: {
    name: string;
  };
  pickupQrCode?: string;
  deliveryQrCode?: string;
  mealsProvided?: number;
  carbonSavedKg?: number;
  createdAt: string;
}

interface QualityAnalysis {
  score: number;
  status: 'APPROVED' | 'REJECTED';
  factors: {
    freshness: number;
    safety: number;
    presentation: number;
    quantity: number;
  };
  recommendations: string[];
}

export default function DonorPortal() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<'login' | 'forbidden' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysis | null>(null);
  const [showCertificate, setShowCertificate] = useState<Donation | null>(null);
  const [showQRCode, setShowQRCode] = useState<Donation | null>(null);
  const [donorType, setDonorType] = useState<string>('Restaurant');
  const [cancelDonation, setCancelDonation] = useState<Donation | null>(null);
  const [cancelledIds, setCancelledIds] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    items: [{ name: '', qty: 1, unit: 'portions' }] as DonationItem[],
    cookedAt: '',
    expiresAt: '',
    notes: '',
    image: '',
  });

  // Header quick actions: "+ Post Food" opens this modal from any page, and
  // "My Activity" scrolls to the donations list below.
  useEffect(() => {
    if (consumeDonationModalRequest()) setShowForm(true);
    const openModal = () => setShowForm(true);
    window.addEventListener(DONATE_EVENT, openModal);
    consumeScrollAction();
    return () => window.removeEventListener(DONATE_EVENT, openModal);
  }, []);

  // Fetch donations
  useEffect(() => {
    fetchDonations();
    // Auto-detect GPS location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Default to Hyderabad
          setUserLocation({ lat: 17.3850, lng: 78.4867 });
        }
      );
    } else {
      setUserLocation({ lat: 17.3850, lng: 78.4867 });
    }
  }, []);

  const fetchDonations = async () => {
    try {
      const response = await fetch('/api/donations?limit=10');

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
      setLoading(false);
    }
  };

  // Real-time sync (Pusher): when an NGO accepts / a volunteer completes this
  // donor's listing, the status change pushes in and the feed refreshes.
  useRealtime('donation:status:update', fetchDonations);

  // Perform AI quality analysis
  const performQualityCheck = async () => {
    try {
      // Simulate AI analysis based on form data
      const now = new Date();
      const cookedAt = formData.cookedAt ? new Date(formData.cookedAt) : now;
      const expiresAt = formData.expiresAt ? new Date(formData.expiresAt) : new Date(now.getTime() + 4 * 60 * 60 * 1000);

      const totalShelfLife = expiresAt.getTime() - cookedAt.getTime();
      const remainingShelfLife = expiresAt.getTime() - now.getTime();
      const freshnessRatio = Math.max(0, remainingShelfLife / totalShelfLife);
      
      let freshnessScore = Math.round(freshnessRatio * 100);
      const hoursElapsed = (now.getTime() - cookedAt.getTime()) / (1000 * 60 * 60);
      if (hoursElapsed > 4) freshnessScore = Math.max(0, freshnessScore - 20);

      const hoursUntilExpiry = remainingShelfLife / (1000 * 60 * 60);
      let safetyScore = 100;
      if (hoursUntilExpiry <= 0) safetyScore = 0;
      else if (hoursUntilExpiry <= 2) safetyScore = 40;
      else if (hoursUntilExpiry <= 4) safetyScore = 60;

      let presentationScore = 50;
      if (formData.image) presentationScore += 30;
      if (formData.items.length > 0 && formData.items.every(item => item.name && item.qty > 0)) {
        presentationScore += 20;
      }

      const totalPortions = formData.items.reduce((sum, item) => sum + item.qty, 0);
      let quantityScore = 50;
      if (totalPortions >= 10) quantityScore = 80;
      else if (totalPortions >= 5) quantityScore = 70;
      else if (totalPortions >= 2) quantityScore = 60;

      const overallScore = Math.round(
        (freshnessScore * 0.35) +
        (safetyScore * 0.35) +
        (presentationScore * 0.15) +
        (quantityScore * 0.15)
      );

      const recommendations: string[] = [];
      if (freshnessScore < 60) recommendations.push('Food appears less fresh. Consider donating sooner.');
      if (safetyScore < 50) recommendations.push('Food is approaching expiry. Expedite delivery.');
      if (!formData.image) recommendations.push('Add a photo to improve quality assessment.');
      if (totalPortions < 5) recommendations.push('Consider combining with other donations.');

      setQualityAnalysis({
        score: overallScore,
        status: overallScore >= 60 ? 'APPROVED' : 'REJECTED',
        factors: {
          freshness: freshnessScore,
          safety: safetyScore,
          presentation: presentationScore,
          quantity: quantityScore,
        },
        recommendations,
      });
    } catch (error) {
      console.error('Quality analysis error:', error);
    }
  };

  // Run quality analysis when form data changes
  useEffect(() => {
    if (formData.cookedAt && formData.expiresAt) {
      performQualityCheck();
    }
  }, [formData.cookedAt, formData.expiresAt, formData.image, formData.items]);

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: '', qty: 1, unit: 'portions' }],
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (
    index: number,
    field: keyof DonationItem,
    value: string | number
  ) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          donorType,
          location: userLocation ? {
            type: 'Point',
            coordinates: [userLocation.lng, userLocation.lat],
          } : undefined,
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
          message: 'Donation created successfully! NGOs are being notified.',
        });
        setShowForm(false);
        setFormData({
          items: [{ name: '', qty: 1, unit: 'portions' }],
          cookedAt: '',
          expiresAt: '',
          notes: '',
          image: '',
        });
        setQualityAnalysis(null);
        fetchDonations();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Failed to create donation. Please try again.',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'Network error. Failed to create donation. Please try again.',
      });
    } finally {
      setSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800';
      case 'ACCEPTED': return 'bg-blue-100 text-blue-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'MATCHED': return 'bg-indigo-100 text-indigo-800';
      case 'PICKED_UP': return 'bg-purple-100 text-purple-800';
      case 'DELIVERED': return 'bg-emerald-100 text-emerald-800';
      case 'EXPIRED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  // Donations excluding locally-cancelled listings
  const visibleDonations = donations.filter(
    (d) => !cancelledIds.includes(d._id)
  );
  // Total meals donated (updates live when a listing is posted/cancelled)
  const mealsDonated = visibleDonations.reduce(
    (sum, d) => sum + (d.items || []).reduce((a, i) => a + (i.qty || 0), 0),
    0
  );

  // Cancel an active listing
  const handleCancelListing = async () => {
    if (!cancelDonation) return;
    const listing = cancelDonation;
    setCancelledIds((prev) => [...prev, listing._id]);
    setCancelDonation(null);
    setNotification({
      type: 'success',
      message: 'Listing cancelled successfully.',
    });
    try {
      const response = await fetch('/api/donations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId: listing._id, status: 'EXPIRED' }),
      });
      if (response.status === 401) {
        setAuthError('login');
        return;
      }
      if (response.status === 403) {
        setAuthError('forbidden');
        return;
      }
      // 503 / offline: the local removal is already applied (silent)
    } catch {
      // Offline — local state already updated
    }
    setTimeout(() => setNotification(null), 4000);
  };

  // Prepare map markers (skip donations with missing coordinates)
  const mapMarkers = visibleDonations
    .filter((donation) => donation.location?.coordinates?.length === 2)
    .map((donation) => ({
      id: donation._id,
      position: {
        lat: donation.location.coordinates[1],
        lng: donation.location.coordinates[0],
      },
      title: (donation.items || []).map((item) => item.name).join(', '),
      type: 'donation' as const,
      info: `Status: ${donation.status} | Urgency: ${donation.urgencyScore}%`,
    }));

  // If the API told us we're not authenticated (or lack permission), show a
  // clean prompt instead of a blank/broken dashboard.
  if (authError) {
    return <AuthPrompt mode={authError} redirectTo="/donor" />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Donor Portal</h1>
          <p className="text-gray-600 mt-1">
            Share your surplus food and make a difference
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Post Donation
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
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {visibleDonations.filter((d) => d.status !== 'EXPIRED').length}
              </p>
              <p className="text-sm text-gray-500">Active Donations</p>
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
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {visibleDonations.filter((d) => d.status === 'DELIVERED').length}
              </p>
              <p className="text-sm text-gray-500">Delivered</p>
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
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {visibleDonations.filter((d) => d.matchedNGO).length}
              </p>
              <p className="text-sm text-gray-500">NGOs Helped</p>
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
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {(visibleDonations.filter((d) => d.status === 'DELIVERED').length * 0.5).toFixed(1)}kg
              </p>
              <p className="text-sm text-gray-500">CO₂ Saved</p>
            </div>
          </div>
        </motion.div>

        {/* Meals Donated — updates live as listings are posted */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Utensils className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {mealsDonated.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Meals Donated</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Live Map */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          <MapPin className="w-5 h-5 inline mr-2" />
          Your Donations Map
        </h2>
        <DynamicLeafletMap
          markers={mapMarkers}
          center={userLocation || { lat: 17.3850, lng: 78.4867 }}
          zoom={12}
        />
      </motion.div>

      {/* Donation Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Post New Donation
                  </h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Donor Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Donor Type
                  </label>
                  <select
                    value={donorType}
                    onChange={(e) => setDonorType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="Restaurant">Restaurant</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Hostel">Hostel</option>
                    <option value="Event">Event</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food Photo
                  </label>
                  <PhotoUpload
                    onUpload={(url) => setFormData({ ...formData, image: url })}
                    currentImage={formData.image}
                  />
                </div>

                {/* AI Quality Preview */}
                {qualityAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`p-4 rounded-xl border ${
                      qualityAnalysis.status === 'APPROVED'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Sparkles className={`w-5 h-5 ${
                        qualityAnalysis.status === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                      }`} />
                      <span className={`font-semibold ${
                        qualityAnalysis.status === 'APPROVED' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        AI Quality Score: {qualityAnalysis.score}%
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQualityColor(qualityAnalysis.score)}`}>
                        {qualityAnalysis.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {Object.entries(qualityAnalysis.factors).map(([key, value]) => (
                        <div key={key} className="text-center">
                          <div className="text-sm font-medium text-gray-700 capitalize">{key}</div>
                          <div className="text-lg font-bold text-gray-900">{value}%</div>
                        </div>
                      ))}
                    </div>

                    {qualityAnalysis.recommendations.length > 0 && (
                      <div className="text-sm text-gray-600">
                        <strong>Recommendations:</strong>
                        <ul className="mt-1 list-disc list-inside">
                          {qualityAnalysis.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Food Items */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food Items
                  </label>
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', parseInt(e.target.value) || 1)}
                        className="w-20 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="w-28 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="portions">Portions</option>
                        <option value="kg">Kg</option>
                        <option value="pieces">Pieces</option>
                        <option value="liters">Liters</option>
                      </select>
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="mt-2 inline-flex items-center text-sm text-green-600 hover:text-green-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add another item
                  </button>
                </div>

                {/* Time Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Cooked At
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.cookedAt}
                      onChange={(e) => setFormData({ ...formData, cookedAt: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Expires At
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Any special instructions or notes about the food..."
                  />
                </div>

                {/* GPS Location */}
                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">GPS Location</span>
                  </div>
                  {userLocation ? (
                    <p className="text-sm text-green-700">
                      Lat: {userLocation.lat.toFixed(4)}, Lng: {userLocation.lng.toFixed(4)}
                    </p>
                  ) : (
                    <p className="text-sm text-green-600">Detecting location...</p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (qualityAnalysis?.status === 'REJECTED')}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Post Donation'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Donations List */}
      <div id="activity" className="scroll-mt-24">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Your Donations
        </h2>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Loading donations...</p>
          </div>
        ) : visibleDonations.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-green-100">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No donations yet
            </h3>
            <p className="text-gray-500 mb-6">
              Start sharing your surplus food with those in need
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-5 h-5 mr-2" />
              Post Your First Donation
            </button>
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {(donation.image || donation.photoUrl) && (
                    <img
                      src={donation.image || donation.photoUrl}
                      alt={(donation.items || []).map((item) => item.name).join(', ')}
                      className="w-full md:w-44 h-32 md:h-24 object-cover rounded-xl shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(donation.status)}`}>
                        {donation.status}
                      </span>
                      <span className={`text-sm font-medium ${getUrgencyColor(donation.urgencyScore)}`}>
                        Urgency: {donation.urgencyScore}%
                      </span>
                      {donation.aiQualityScore !== undefined && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getQualityColor(donation.aiQualityScore)}`}>
                          AI Score: {donation.aiQualityScore}%
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {donation.items.map((item) => item.name).join(', ')}
                    </h3>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Expires: {new Date(donation.expiresAt).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {donation.location?.coordinates?.[1]?.toFixed(4) ?? 'N/A'}, {donation.location?.coordinates?.[0]?.toFixed(4) ?? 'N/A'}
                      </span>
                    </div>

                    {donation.matchedNGO && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                        <p className="text-sm text-blue-800">
                          <strong>Matched with:</strong> {donation.matchedNGO.name}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total portions</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {donation.items.reduce((sum, item) => sum + item.qty, 0)}
                      </p>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2">
                      {donation.status === 'DELIVERED' && (
                        <button
                          onClick={() => setShowCertificate(donation)}
                          className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                        >
                          <Award className="w-4 h-4 inline mr-1" />
                          Download ESG Certificate
                        </button>
                      )}
                      {donation.pickupQrCode && (
                        <button
                          onClick={() => setShowQRCode(donation)}
                          className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                        >
                          QR Code
                        </button>
                      )}
                      {(donation.status === 'PENDING' ||
                        donation.status === 'MATCHED') && (
                        <button
                          onClick={() => setCancelDonation(donation)}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" />
                          Cancel Listing
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Listing Confirmation Modal */}
      <AnimatePresence>
        {cancelDonation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCancelDonation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="text-center mb-5">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Cancel this listing?
                </h3>
                <p className="text-sm text-gray-500">
                  {(cancelDonation.items || [])
                    .map((i) => i.name)
                    .join(', ')}{' '}
                  will be removed from the active feed.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancelDonation(null)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Keep Listing
                </button>
                <button
                  onClick={handleCancelListing}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors"
                >
                  Cancel Listing
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Certificate Modal */}
      <AnimatePresence>
        {showCertificate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCertificate(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <ESGCertificate
                donorName="Your Restaurant"
                donorType={donorType}
                totalDonations={1}
                mealsProvided={showCertificate.mealsProvided || showCertificate.items.reduce((sum, item) => sum + item.qty, 0)}
                carbonSavedKg={showCertificate.carbonSavedKg || 0.5}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRCode && showQRCode.pickupQrCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowQRCode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <QRCodeDisplay
                data={showQRCode.pickupQrCode}
                title="Pickup QR Code"
                subtitle="Show this to the volunteer for verification"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}