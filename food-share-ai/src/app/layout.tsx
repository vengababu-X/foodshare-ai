import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/ui/Navbar';
import WelcomeBanner from '@/components/ui/WelcomeBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FoodShare AI - AI-Powered Food Donation & Distribution Platform',
  description: 'Connect donors with NGOs and volunteers to reduce food waste and fight hunger using AI-powered matching and QR code verification',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
          {/* Header */}
          <Navbar />

          {/* Personalized welcome banner (shown after registration) */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <WelcomeBanner />
          </div>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white/50 border-t border-green-100 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="text-sm text-gray-500">
                  © 2026 FreeBuff AI. All rights reserved.
                </div>
                <div className="flex space-x-6 mt-4 md:mt-0">
                  <a href="#" className="text-sm text-gray-500 hover:text-green-600 transition-colors">
                    Privacy Policy
                  </a>
                  <a href="#" className="text-sm text-gray-500 hover:text-green-600 transition-colors">
                    Terms of Service
                  </a>
                  <a href="#" className="text-sm text-gray-500 hover:text-green-600 transition-colors">
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}