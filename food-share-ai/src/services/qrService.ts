import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { JWT_SECRET } from '@/lib/jwtConfig';

/**
 * QR verification codes are cryptographically signed JWTs. The volunteer
 * scanner extracts the raw token and the server verifies it against
 * JWT_SECRET, so a tampered or expired QR can never pass verification.
 */

export interface QRCodeData {
  donationId: string;
  type: 'PICKUP' | 'DELIVERY';
  timestamp: number;
}

const QR_TOKEN_TTL = '24h';

function signQrToken(payload: QRCodeData): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: QR_TOKEN_TTL });
}

/** Build a QR data URL (PNG) from a token string. */
async function tokenToDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

// Generate QR code data for pickup verification
export async function generatePickupQR(donationId: string): Promise<{
  qrData: string;
  qrCodeUrl: string;
}> {
  const qrData: QRCodeData = {
    donationId,
    type: 'PICKUP',
    timestamp: Date.now(),
  };

  const token = signQrToken(qrData);
  const qrCodeUrl = await tokenToDataUrl(token);

  return {
    qrData: token,
    qrCodeUrl,
  };
}

// Generate QR code data for delivery verification
export async function generateDeliveryQR(donationId: string): Promise<{
  qrData: string;
  qrCodeUrl: string;
}> {
  const qrData: QRCodeData = {
    donationId,
    type: 'DELIVERY',
    timestamp: Date.now(),
  };

  const token = signQrToken(qrData);
  const qrCodeUrl = await tokenToDataUrl(token);

  return {
    qrData: token,
    qrCodeUrl,
  };
}

/**
 * Verify a scanned QR token. Returns the parsed payload when the signature is
 * valid and the code has not expired, or an error describing the failure.
 */
export function verifyQRCode(qrData: string): {
  valid: boolean;
  data?: QRCodeData;
  error?: string;
} {
  try {
    const parsed = jwt.verify(qrData, JWT_SECRET) as Partial<QRCodeData>;

    // Validate the required fields
    if (!parsed.donationId || !parsed.type || typeof parsed.timestamp !== 'number') {
      return { valid: false, error: 'Invalid QR code format' };
    }

    // Validate type
    if (parsed.type !== 'PICKUP' && parsed.type !== 'DELIVERY') {
      return { valid: false, error: 'Invalid QR code type' };
    }

    // Double-check age (the JWT exp claim already enforces 24h, this guards
    // against any token issued without one)
    const hoursOld = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
    if (hoursOld > 24) {
      return { valid: false, error: 'QR code has expired' };
    }

    return {
      valid: true,
      data: {
        donationId: String(parsed.donationId),
        type: parsed.type,
        timestamp: parsed.timestamp,
      },
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'QR code has expired' };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'Invalid QR code signature' };
    }
    return { valid: false, error: 'Invalid QR code data' };
  }
}

// Generate QR code as buffer (for printing)
export async function generateQRBuffer(qrData: string): Promise<Buffer> {
  return QRCode.toBuffer(qrData, {
    width: 400,
    margin: 2,
  });
}

export default {
  generatePickupQR,
  generateDeliveryQR,
  verifyQRCode,
  generateQRBuffer,
};
