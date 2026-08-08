import { NextRequest, NextResponse } from 'next/server';
import { connectDB, canUseMongo } from '@/lib/db';
import Donation from '@/models/Donation';
import Delivery from '@/models/Delivery';
import { withAuth } from '@/middleware/auth';
import { generatePickupQR, generateDeliveryQR, verifyQRCode } from '@/services/qrService';
import { notifyDelivery, notifyUser } from '@/lib/socket';
import { invalidateActiveDonations } from '@/lib/redis';
import {
  localGetDelivery,
  localGetDonation,
  localUpdateDelivery,
  localUpdateDonation,
  localDeliveryToResponse,
} from '@/services/localStore';

/**
 * POST /api/donations/qr
 *
 * Two modes:
 *  1. Verification — body { qrToken, deliveryId, action: 'PICKUP' | 'DROPOFF' }.
 *     The raw token scanned by the volunteer camera is a JWT signed with
 *     JWT_SECRET; it is verified here and matched against the delivery's
 *     donation in MongoDB. On success the Delivery (and Donation) status is
 *     updated and HTTP 200 is returned. On failure: 400 "Invalid or Expired
 *     QR Code".
 *  2. Generation — body { donationId, type: 'PICKUP' | 'DELIVERY' }.
 *     Issues a fresh signed QR token and persists it on the donation.
 */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user;
    const body = await request.json();

    // ── Verification mode ──────────────────────────────────────────────────
    if (body.qrToken) {
      const { qrToken, deliveryId, action } = body as {
        qrToken: string;
        deliveryId: string;
        action?: 'PICKUP' | 'DROPOFF';
      };

      if (!qrToken || !deliveryId || !action) {
        return NextResponse.json(
          { success: false, error: 'qrToken, deliveryId and action are required' },
          { status: 400 }
        );
      }
      if (action !== 'PICKUP' && action !== 'DROPOFF') {
        return NextResponse.json(
          { success: false, error: 'Invalid or Expired QR Code' },
          { status: 400 }
        );
      }

      // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
      if (!(await canUseMongo())) {
        const localResult = verifyQRCode(qrToken);
        if (!localResult.valid || !localResult.data) {
          return NextResponse.json(
            { success: false, error: localResult.error || 'Invalid or Expired QR Code' },
            { status: 400 }
          );
        }
        const localExpectedType = action === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
        if (localResult.data.type !== localExpectedType) {
          return NextResponse.json(
            { success: false, error: 'Invalid or Expired QR Code' },
            { status: 400 }
          );
        }
        const localDelivery = localGetDelivery(deliveryId);
        if (!localDelivery || localResult.data.donationId !== localDelivery.donationId) {
          return NextResponse.json(
            { success: false, error: 'Invalid or Expired QR Code' },
            { status: 400 }
          );
        }
        if (user.role === 'VOLUNTEER' && localDelivery.volunteerId !== user.id) {
          return NextResponse.json(
            { success: false, error: 'You are not assigned to this delivery' },
            { status: 403 }
          );
        }

        if (action === 'PICKUP') {
          localUpdateDelivery(deliveryId, { status: 'IN_TRANSIT' });
          localUpdateDonation(localDelivery.donationId, { status: 'PICKED_UP' });
        } else {
          const localDonation = localGetDonation(localDelivery.donationId);
          localUpdateDelivery(deliveryId, {
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
            mealsProvided: localDonation
              ? localDonation.items.reduce((sum, i) => sum + i.qty, 0)
              : 0,
          });
          localUpdateDonation(localDelivery.donationId, { status: 'DELIVERED' });
        }

        const updatedLocal = localGetDelivery(deliveryId);
        return NextResponse.json({
          success: true,
          storage: 'local',
          message: action === 'PICKUP' ? 'Pickup verified' : 'Delivery completed',
          data: {
            delivery: updatedLocal ? localDeliveryToResponse(updatedLocal) : null,
            donation: {
              _id: localDelivery.donationId,
              status: action === 'PICKUP' ? 'PICKED_UP' : 'DELIVERED',
            },
          },
        });
      }

      await connectDB();

      // 1. Verify the JWT signature + expiry against JWT_SECRET
      const result = verifyQRCode(qrToken);
      if (!result.valid || !result.data) {
        return NextResponse.json(
          { success: false, error: result.error || 'Invalid or Expired QR Code' },
          { status: 400 }
        );
      }

      const expectedType = action === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
      if (result.data.type !== expectedType) {
        return NextResponse.json(
          { success: false, error: 'Invalid or Expired QR Code' },
          { status: 400 }
        );
      }

      // 2. Match the QR payload against the delivery's donation in MongoDB
      const delivery = await Delivery.findById(deliveryId).exec();
      if (!delivery) {
        return NextResponse.json(
          { success: false, error: 'Invalid or Expired QR Code' },
          { status: 400 }
        );
      }

      if (delivery.donationId.toString() !== result.data.donationId) {
        return NextResponse.json(
          { success: false, error: 'Invalid or Expired QR Code' },
          { status: 400 }
        );
      }

      // 3. Only the assigned volunteer can verify their own delivery
      if (user.role === 'VOLUNTEER' && delivery.volunteerId.toString() !== user.id) {
        return NextResponse.json(
          { success: false, error: 'You are not assigned to this delivery' },
          { status: 403 }
        );
      }

      const donation = await Donation.findById(delivery.donationId).exec();
      if (!donation) {
        return NextResponse.json(
          { success: false, error: 'Donation not found' },
          { status: 404 }
        );
      }

      const now = new Date();

      // 4. Update statuses — PICKUP → IN_TRANSIT, DROPOFF → COMPLETED
      if (action === 'PICKUP') {
        delivery.status = 'IN_TRANSIT';
        delivery.pickupVerifiedAt = now;
        donation.status = 'PICKED_UP';
        await donation.save();
      } else {
        const meals = donation.items.reduce((sum, item) => sum + item.qty, 0);
        delivery.status = 'COMPLETED';
        delivery.deliveryVerifiedAt = now;
        delivery.completedAt = now;
        delivery.mealsProvided = meals;
        delivery.carbonSavedKg = Math.round(delivery.routeInfo.distance * 0.2 * 100) / 100;

        donation.status = 'DELIVERED';
        donation.mealsProvided = meals;
        donation.carbonSavedKg = delivery.carbonSavedKg;
        await donation.save();
      }

      await delivery.save();

      // The feed changed — drop the cache.
      await invalidateActiveDonations();

      // Notify the donor about the pickup / completion
      notifyUser(donation.donorId.toString(), 'donation:status:update', {
        donationId: donation._id,
        status: donation.status,
      });
      notifyDelivery(deliveryId, 'delivery:status:update', {
        deliveryId,
        status: delivery.status,
      });

      return NextResponse.json({
        success: true,
        message: action === 'PICKUP' ? 'Pickup verified' : 'Delivery completed',
        data: {
          delivery,
          donation: { _id: donation._id, status: donation.status },
        },
      });
    }

    // ── Generation mode ────────────────────────────────────────────────────
    const { donationId, type } = body as { donationId?: string; type?: string };

    if (!donationId || !type) {
      return NextResponse.json(
        { success: false, error: 'Donation ID and type are required' },
        { status: 400 }
      );
    }

    if (type !== 'PICKUP' && type !== 'DELIVERY') {
      return NextResponse.json(
        { success: false, error: 'Type must be PICKUP or DELIVERY' },
        { status: 400 }
      );
    }

    // ── Smart Hybrid: local generation (JWT + QR data URL — no DB needed) ──
    if (!(await canUseMongo())) {
      const localQr =
        type === 'PICKUP'
          ? await generatePickupQR(donationId)
          : await generateDeliveryQR(donationId);
      return NextResponse.json({
        success: true,
        storage: 'local',
        data: { qrData: localQr.qrData, qrCodeUrl: localQr.qrCodeUrl },
      });
    }

    await connectDB();

    // Find the donation
    const donation = await Donation.findById(donationId).exec();
    if (!donation) {
      return NextResponse.json(
        { success: false, error: 'Donation not found' },
        { status: 404 }
      );
    }

    // Generate QR code
    let qrResult;
    if (type === 'PICKUP') {
      qrResult = await generatePickupQR(donationId);
      donation.pickupQrCode = qrResult.qrData;
    } else {
      qrResult = await generateDeliveryQR(donationId);
      donation.deliveryQrCode = qrResult.qrData;
    }

    await donation.save();

    return NextResponse.json({
      success: true,
      data: {
        qrData: qrResult.qrData,
        qrCodeUrl: qrResult.qrCodeUrl,
      },
    });
  } catch (error) {
    console.error('Error in QR route:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process QR code' },
      { status: 500 }
    );
  }
});
