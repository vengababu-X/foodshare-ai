'use client';

import { useState } from 'react';
import { Download, Printer, Award, Leaf, Utensils, Truck } from 'lucide-react';

interface ESGCertificateProps {
  donorName: string;
  donorType?: string;
  totalDonations: number;
  mealsProvided: number;
  carbonSavedKg: number;
  period?: { from: Date; to: Date };
}

export default function ESGCertificate({
  donorName,
  donorType,
  totalDonations,
  mealsProvided,
  carbonSavedKg,
  period,
}: ESGCertificateProps) {
  const [downloading, setDownloading] = useState(false);

  const foodWasteReducedKg = mealsProvided * 0.5; // Average meal weight

  const fromDate = (period?.from || new Date(new Date().getFullYear(), 0, 1)).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const toDate = (period?.to || new Date()).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const generateCertificateId = () => {
    const prefix = 'FS';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const handleDownload = async () => {
    setDownloading(true);
    
    // Create HTML content for download
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESG Impact Certificate - FoodShare AI</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
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
    
    .certificate-header p { opacity: 0.9; font-size: 0.9rem; }
    
    .certificate-body { padding: 2.5rem; }
    
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
    
    .donor-info p { color: #6b7280; font-size: 0.9rem; }
    
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
    
    .metric-value { font-size: 1.75rem; font-weight: 700; color: #059669; }
    .metric-label { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }
    
    .period {
      text-align: center;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
    }
    
    .period p { color: #6b7280; font-size: 0.85rem; }
    
    .certificate-footer { text-align: center; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
    .certificate-id { font-family: monospace; font-size: 0.8rem; color: #9ca3af; }
    .issued-date { font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem; }
    
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
      body { background: white; padding: 0; }
      .certificate { box-shadow: none; border: 1px solid #e5e7eb; }
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
        <h2>${donorName}</h2>
        <p>${donorType ? donorType + ' Partner' : 'Community Partner'}</p>
      </div>
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${totalDonations}</div>
          <div class="metric-label">Total Donations</div>
        </div>
        <div class="metric">
          <div class="metric-value">${mealsProvided.toLocaleString()}</div>
          <div class="metric-label">Meals Provided</div>
        </div>
        <div class="metric">
          <div class="metric-value">${carbonSavedKg.toFixed(1)} kg</div>
          <div class="metric-label">CO₂ Emissions Saved</div>
        </div>
        <div class="metric">
          <div class="metric-value">${foodWasteReducedKg.toFixed(1)} kg</div>
          <div class="metric-label">Food Waste Reduced</div>
        </div>
      </div>
      <div class="period">
        <p><strong>Coverage Period:</strong> ${fromDate} - ${toDate}</p>
      </div>
      <div class="certificate-footer">
        <div class="certificate-id">Certificate ID: ${generateCertificateId()}</div>
        <div class="issued-date">Issued on: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div class="badge">✓ Verified Impact Partner</div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Create and download the file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESG-Certificate-${donorName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-green-100">
      {/* Certificate Preview */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white text-center">
        <Award className="w-12 h-12 mx-auto mb-3" />
        <h2 className="text-2xl font-bold">ESG Impact Certificate</h2>
        <p className="text-green-100 text-sm">FoodShare AI Verified Partner</p>
      </div>

      <div className="p-6">
        {/* Donor Info */}
        <div className="text-center mb-6 pb-6 border-b-2 border-dashed border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">{donorName}</h3>
          <p className="text-gray-500 text-sm">{donorType ? `${donorType} Partner` : 'Community Partner'}</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{totalDonations}</div>
            <div className="text-xs text-gray-600 mt-1">Total Donations</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{mealsProvided.toLocaleString()}</div>
            <div className="text-xs text-gray-600 mt-1">Meals Provided</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{carbonSavedKg.toFixed(1)} kg</div>
            <div className="text-xs text-gray-600 mt-1">CO₂ Saved</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{foodWasteReducedKg.toFixed(1)} kg</div>
            <div className="text-xs text-gray-600 mt-1">Waste Reduced</div>
          </div>
        </div>

        {/* Period */}
        <div className="bg-gray-50 rounded-lg p-3 text-center text-sm text-gray-600 mb-6">
          <strong>Period:</strong> {fromDate} - {toDate}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 transition-all"
          >
            <Download className="w-5 h-5 mr-2" />
            {downloading ? 'Generating...' : 'Download Certificate'}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}