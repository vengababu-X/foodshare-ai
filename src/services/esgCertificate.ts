export interface ESGCertificateData {
  donorName: string;
  donorType?: string;
  totalDonations: number;
  mealsProvided: number;
  carbonSavedKg: number;
  foodWasteReducedKg: number;
  period: {
    from: Date;
    to: Date;
  };
  certificateId: string;
  issuedAt: Date;
}

// Generate certificate ID
function generateCertificateId(): string {
  const prefix = 'FS';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Calculate food waste reduced (estimated)
export function calculateFoodWasteReduced(mealsProvided: number): number {
  // Average meal weight is approximately 0.5 kg
  const averageMealWeightKg = 0.5;
  return mealsProvided * averageMealWeightKg;
}

// Generate ESG Certificate data
export function generateCertificateData(params: {
  donorName: string;
  donorType?: string;
  totalDonations: number;
  mealsProvided: number;
  carbonSavedKg: number;
  period?: { from: Date; to: Date };
}): ESGCertificateData {
  const now = new Date();
  const defaultPeriod = {
    from: new Date(now.getFullYear(), 0, 1), // Start of current year
    to: now,
  };

  return {
    donorName: params.donorName,
    donorType: params.donorType,
    totalDonations: params.totalDonations,
    mealsProvided: params.mealsProvided,
    carbonSavedKg: params.carbonSavedKg,
    foodWasteReducedKg: calculateFoodWasteReduced(params.mealsProvided),
    period: params.period || defaultPeriod,
    certificateId: generateCertificateId(),
    issuedAt: now,
  };
}

// Generate HTML certificate for download/print
export function generateCertificateHTML(data: ESGCertificateData): string {
  const fromDate = data.period.from.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const toDate = data.period.to.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const issuedDate = data.issuedAt.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESG Impact Certificate - FoodShare AI</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background: #f0fdf4;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    
    .certificate {
      background: white;
      max-width: 800px;
      width: 100%;
      border-radius: 1rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    
    .certificate-header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 2.5rem;
      text-align: center;
    }
    
    .certificate-header h1 {
      font-family: 'Playfair Display', serif;
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    .certificate-header p {
      opacity: 0.9;
      font-size: 0.9rem;
    }
    
    .certificate-body {
      padding: 2.5rem;
    }
    
    .donor-info {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 2px dashed #e5e7eb;
    }
    
    .donor-info h2 {
      font-family: 'Playfair Display', serif;
      font-size: 1.5rem;
      color: #065f46;
      margin-bottom: 0.5rem;
    }
    
    .donor-info p {
      color: #6b7280;
      font-size: 0.9rem;
    }
    
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .metric {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-radius: 0.75rem;
      padding: 1.25rem;
      text-align: center;
    }
    
    .metric-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #059669;
    }
    
    .metric-label {
      font-size: 0.8rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }
    
    .period {
      text-align: center;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
    }
    
    .period p {
      color: #6b7280;
      font-size: 0.85rem;
    }
    
    .certificate-footer {
      text-align: center;
      padding-top: 1.5rem;
      border-top: 1px solid #e5e7eb;
    }
    
    .certificate-id {
      font-family: monospace;
      font-size: 0.8rem;
      color: #9ca3af;
    }
    
    .issued-date {
      font-size: 0.85rem;
      color: #6b7280;
      margin-top: 0.5rem;
    }
    
    .badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 2rem;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 1rem;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .certificate {
        box-shadow: none;
        border: 1px solid #e5e7eb;
      }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="certificate-header">
      <h1>🌱 ESG Impact Certificate</h1>
      <p>FoodShare AI - Fighting Food Waste, Nourishing Communities</p>
    </div>
    
    <div class="certificate-body">
      <div class="donor-info">
        <h2>${data.donorName}</h2>
        <p>${data.donorType ? data.donorType + ' Partner' : 'Community Partner'}</p>
      </div>
      
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${data.totalDonations}</div>
          <div class="metric-label">Total Donations</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.mealsProvided.toLocaleString()}</div>
          <div class="metric-label">Meals Provided</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.carbonSavedKg.toFixed(1)} kg</div>
          <div class="metric-label">CO₂ Emissions Saved</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.foodWasteReducedKg.toFixed(1)} kg</div>
          <div class="metric-label">Food Waste Reduced</div>
        </div>
      </div>
      
      <div class="period">
        <p><strong>Coverage Period:</strong> ${fromDate} - ${toDate}</p>
      </div>
      
      <div class="certificate-footer">
        <div class="certificate-id">Certificate ID: ${data.certificateId}</div>
        <div class="issued-date">Issued on: ${issuedDate}</div>
        <div class="badge">✓ Verified Impact Partner</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export default {
  generateCertificateData,
  generateCertificateHTML,
  calculateFoodWasteReduced,
};