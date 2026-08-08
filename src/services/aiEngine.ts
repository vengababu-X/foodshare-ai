import User from '@/models/User';
import Donation from '@/models/Donation';
import { Coordinates } from '@/types';
import { analyzeFoodQuality, QualityAnalysisResult } from './qualityAnalyzer';

// Score weights
const SCORE_WEIGHTS = {
  proximity: 0.4,
  expiryUrgency: 0.3,
  ngoCapacity: 0.2,
  trafficPenalty: 0.1,
};

// Calculate distance between two points using Haversine formula
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Calculate proximity score (0-100)
export function calculateProximityScore(distanceKm: number, maxDistanceKm: number = 50): number {
  if (distanceKm <= 0) return 100;
  if (distanceKm >= maxDistanceKm) return 0;
  
  // Exponential decay for proximity scoring
  const score = 100 * Math.exp(-0.05 * distanceKm);
  return Math.round(Math.max(0, Math.min(100, score)));
}

// Calculate expiry urgency score (0-100)
export function calculateExpiryUrgencyScore(expiresAt: Date): number {
  const now = new Date();
  const totalMs = expiresAt.getTime() - now.getTime();
  const totalHours = totalMs / (1000 * 60 * 60);
  
  // Food expires in less than 2 hours = high urgency (100)
  // Food expires in 24+ hours = low urgency (10)
  if (totalHours <= 0) return 100; // Already expired or about to expire
  if (totalHours <= 2) return 95;
  if (totalHours <= 6) return 80;
  if (totalHours <= 12) return 60;
  if (totalHours <= 24) return 40;
  return Math.max(10, 100 - (totalHours * 2));
}

// Calculate NGO capacity match score (0-100)
export function calculateNGOCapacityScore(ngoCapacity: number, donationSize: number): number {
  if (ngoCapacity <= 0) return 0;
  
  // If NGO capacity matches donation size perfectly = 100
  // If NGO is much larger = slightly lower (might waste resources)
  // If NGO is too small = much lower (can't handle)
  
  const ratio = donationSize / ngoCapacity;
  
  if (ratio <= 1) {
    // NGO can handle the donation
    return Math.round(100 - Math.abs(1 - ratio) * 50);
  } else {
    // NGO is too small
    return Math.round(Math.max(0, 100 - (ratio - 1) * 100));
  }
}

// Calculate traffic delay penalty (0-100)
export function calculateTrafficPenalty(trafficDelayMinutes: number): number {
  // 0 delay = 0 penalty
  // 30+ minutes delay = 100 penalty
  return Math.min(100, Math.round(trafficDelayMinutes * 3.33));
}

// Main scoring function
export function calculateMatchScore(params: {
  distanceKm: number;
  expiresAt: Date;
  ngoCapacity: number;
  donationSize: number;
  trafficDelayMinutes: number;
}): number {
  const proximityScore = calculateProximityScore(params.distanceKm);
  const expiryScore = calculateExpiryUrgencyScore(params.expiresAt);
  const capacityScore = calculateNGOCapacityScore(params.ngoCapacity, params.donationSize);
  const trafficPenalty = calculateTrafficPenalty(params.trafficDelayMinutes);

  const totalScore =
    SCORE_WEIGHTS.proximity * proximityScore +
    SCORE_WEIGHTS.expiryUrgency * expiryScore +
    SCORE_WEIGHTS.ngoCapacity * capacityScore -
    SCORE_WEIGHTS.trafficPenalty * trafficPenalty;

  return Math.round(Math.max(0, Math.min(100, totalScore)));
}

// Perform AI quality analysis on donation
export async function performQualityAnalysis(donationId: string): Promise<QualityAnalysisResult> {
  const donation = await Donation.findById(donationId).exec();
  if (!donation) {
    throw new Error('Donation not found');
  }

  const result = analyzeFoodQuality({
    photoUrl: donation.photoUrl,
    cookedAt: donation.cookedAt,
    expiresAt: donation.expiresAt,
    items: donation.items,
    notes: donation.notes,
  });

  // Update donation with quality analysis results
  donation.aiQualityScore = result.score;
  donation.aiFreshnessStatus = result.status;
  await donation.save();

  return result;
}

// Find best matching NGOs for a donation
export async function findMatchingNGOs(donationId: string): Promise<{
  ngoId: string;
  score: number;
  distance: number;
}[]> {
  const donation = await Donation.findById(donationId).exec();
  if (!donation) {
    throw new Error('Donation not found');
  }

  const donationLocation = {
    lat: donation.location.coordinates[1],
    lng: donation.location.coordinates[0],
  };

  // Calculate total donation size in portions
  const donationSize = donation.items.reduce((total, item) => total + item.qty, 0);

  // Find all verified NGOs within 50km
  const ngos = await User.find({
    role: 'NGO',
    isVerified: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: donation.location.coordinates,
        },
        $maxDistance: 50000, // 50km in meters
      },
    },
  }).exec();

  // Score each NGO
  const scoredNGOs = ngos.map((ngo) => {
    const ngoLocation = {
      lat: ngo.location.coordinates[1],
      lng: ngo.location.coordinates[0],
    };

    const distance = calculateDistance(donationLocation, ngoLocation);
    
    // Simulate traffic delay (in production, use a routing API)
    const trafficDelay = distance * 0.5; // Rough estimate: 0.5 minutes per km

    const score = calculateMatchScore({
      distanceKm: distance,
      expiresAt: donation.expiresAt,
      ngoCapacity: ngo.capacity,
      donationSize: donationSize,
      trafficDelayMinutes: trafficDelay,
    });

    return {
      ngoId: ngo._id.toString(),
      score,
      distance,
    };
  });

  // Sort by score (highest first)
  scoredNGOs.sort((a, b) => b.score - a.score);

  return scoredNGOs;
}

// Get urgency score for a donation
export function getUrgencyScore(donation: {
  cookedAt: Date;
  expiresAt: Date;
}): number {
  const now = new Date();
  const cookedTime = donation.cookedAt.getTime();
  const expireTime = donation.expiresAt.getTime();
  const currentTime = now.getTime();

  // Calculate freshness (0-100)
  const totalShelfLife = expireTime - cookedTime;
  const remainingShelfLife = expireTime - currentTime;
  const freshness = Math.max(0, (remainingShelfLife / totalShelfLife) * 100);

  // Calculate urgency based on remaining time
  const hoursRemaining = remainingShelfLife / (1000 * 60 * 60);
  
  if (hoursRemaining <= 0) return 100; // Expired
  if (hoursRemaining <= 2) return 95;  // Critical
  if (hoursRemaining <= 6) return 80;  // High
  if (hoursRemaining <= 12) return 60; // Medium
  if (hoursRemaining <= 24) return 40; // Low
  
  return Math.max(10, freshness * 0.5);
}

export default {
  calculateDistance,
  calculateProximityScore,
  calculateExpiryUrgencyScore,
  calculateNGOCapacityScore,
  calculateTrafficPenalty,
  calculateMatchScore,
  performQualityAnalysis,
  findMatchingNGOs,
  getUrgencyScore,
};