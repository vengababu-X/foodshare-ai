'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer } from 'lucide-react';

interface QRCodeDisplayProps {
  data: string;
  title: string;
  subtitle?: string;
  onDownload?: () => void;
}

export default function QRCodeDisplay({
  data,
  title,
  subtitle,
  onDownload,
}: QRCodeDisplayProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 2rem;
            }
            h2 { margin-bottom: 0.5rem; }
            p { color: #666; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h2>${title}</h2>
            ${subtitle ? `<p>${subtitle}</p>` : ''}
            <img src="data:image/svg+xml;base64,${btoa(document.querySelector('.qr-code svg')?.outerHTML || '')}" />
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      
      <div className="flex justify-center mb-4">
        <div className="qr-code p-4 bg-white rounded-xl border-2 border-gray-100">
          <QRCodeSVG
            value={data}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>
      </div>
      
      <div className="flex gap-2 justify-center">
        {onDownload && (
          <button
            onClick={onDownload}
            className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </button>
        )}
        <button
          onClick={handlePrint}
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print
        </button>
      </div>
    </div>
  );
}