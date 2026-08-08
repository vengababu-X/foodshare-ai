// AI Quality Analysis Service
// Simulates a vision engine analyzing food photo freshness and safety

export interface QualityAnalysisResult {
  score: number; // 0-100%
  status: 'APPROVED' | 'REJECTED';
  factors: {
    freshness: number;
    safety: number;
    presentation: number;
    quantity: number;
  };
  recommendations: string[];
}

// Analyze food quality based on metadata and simulated image analysis
export function analyzeFoodQuality(params: {
  photoUrl?: string;
  cookedAt: Date;
  expiresAt: Date;
  items: Array<{ name: string; qty: number; unit: string }>;
  notes?: string;
}): QualityAnalysisResult {
  const now = new Date();
  const cookedTime = params.cookedAt.getTime();
  const expireTime = params.expiresAt.getTime();
  const currentTime = now.getTime();

  // Calculate time-based factors
  const totalShelfLife = expireTime - cookedTime;
  const remainingShelfLife = expireTime - currentTime;
  const timeElapsed = currentTime - cookedTime;
  
  // Freshness score (0-100)
  // Based on how much shelf life remains
  const freshnessRatio = Math.max(0, remainingShelfLife / totalShelfLife);
  let freshnessScore = Math.round(freshnessRatio * 100);
  
  // Penalize if cooked more than 4 hours ago
  const hoursElapsed = timeElapsed / (1000 * 60 * 60);
  if (hoursElapsed > 4) {
    freshnessScore = Math.max(0, freshnessScore - 20);
  }
  if (hoursElapsed > 8) {
    freshnessScore = Math.max(0, freshnessScore - 30);
  }

  // Safety score (0-100)
  // Based on time until expiry
  const hoursUntilExpiry = remainingShelfLife / (1000 * 60 * 60);
  let safetyScore = 100;
  
  if (hoursUntilExpiry <= 0) {
    safetyScore = 0; // Expired
  } else if (hoursUntilExpiry <= 1) {
    safetyScore = 20; // Critical
  } else if (hoursUntilExpiry <= 2) {
    safetyScore = 40; // Warning
  } else if (hoursUntilExpiry <= 4) {
    safetyScore = 60; // Acceptable
  } else if (hoursUntilExpiry <= 8) {
    safetyScore = 80; // Good
  }

  // Presentation score (0-100)
  // Simulated based on photo availability and item quality
  let presentationScore = 50; // Base score
  if (params.photoUrl) {
    presentationScore += 30; // Bonus for having a photo
  }
  if (params.items.length > 0 && params.items.every(item => item.name && item.qty > 0)) {
    presentationScore += 20; // Bonus for complete item info
  }
  presentationScore = Math.min(100, presentationScore);

  // Quantity score (0-100)
  // Based on total portions
  const totalPortions = params.items.reduce((sum, item) => sum + item.qty, 0);
  let quantityScore = 50; // Base score
  if (totalPortions >= 10) {
    quantityScore = 80;
  } else if (totalPortions >= 5) {
    quantityScore = 70;
  } else if (totalPortions >= 2) {
    quantityScore = 60;
  }
  quantityScore = Math.min(100, quantityScore);

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    (freshnessScore * 0.35) +
    (safetyScore * 0.35) +
    (presentationScore * 0.15) +
    (quantityScore * 0.15)
  );

  // Determine status
  const status: 'APPROVED' | 'REJECTED' = overallScore >= 60 ? 'APPROVED' : 'REJECTED';

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (freshnessScore < 60) {
    recommendations.push('Food appears less fresh. Consider donating sooner.');
  }
  if (safetyScore < 50) {
    recommendations.push('Food is approaching expiry. Expedite delivery.');
  }
  if (!params.photoUrl) {
    recommendations.push('Add a photo to improve quality assessment.');
  }
  if (totalPortions < 5) {
    recommendations.push('Consider combining with other donations for efficiency.');
  }
  if (hoursElapsed > 4) {
    recommendations.push('Food was cooked more than 4 hours ago. Ensure proper storage.');
  }

  return {
    score: overallScore,
    status,
    factors: {
      freshness: freshnessScore,
      safety: safetyScore,
      presentation: presentationScore,
      quantity: quantityScore,
    },
    recommendations,
  };
}

// Get quality status color for UI
export function getQualityStatusColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-100';
  if (score >= 60) return 'text-yellow-600 bg-yellow-100';
  if (score >= 40) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
}

// Get quality status text
export function getQualityStatusText(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export default {
  analyzeFoodQuality,
  getQualityStatusColor,
  getQualityStatusText,
};