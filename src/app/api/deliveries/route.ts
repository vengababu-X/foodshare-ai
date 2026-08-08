import { NextRequest, NextResponse } from 'next/server';
import { connectDB, canUseMongo } from '@/lib/db';
import {
  localListDeliveries,
  localGetDelivery,
  localUpdateDelivery,
  localGetDonation,
  localUpdateDonation,
  localDeliveryToResponse,
} from '@/services/localStore';
import type { LocalDelivery } from '@/services/localStore';
import Delivery from '@/models/Delivery';
import Donation from '@/models/Donation';
import User from '@/models/User';
import { withAuth, withRole } from '@/middleware/auth';
import { notifyDelivery, notifyUser } from '@/lib/socket';
import { invalidateActiveDonations } from '@/lib/redis';
import { verifyQRCode } from '@/services/qrService';

// GET /api/deliveries - Get deliveries (volunteers see their own by default)
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const volunteerId = searchParams.get('volunteerId');
    const ngoId = searchParams.get('ngoId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const skip = (page - 1) * limit;

    // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
    if (!(await canUseMongo())) {
      const effectiveVolunteerId =
        user.role === 'VOLUNTEER' && !volunteerId ? user.id : volunteerId || undefined;
      const deliveries = localListDeliveries(effectiveVolunteerId, limit)
        .filter((d) => (status ? d.status === status : true))
        .map((d) => localDeliveryToResponse(d));
      const payload = {
        deliveries,
        pagination: {
          total: deliveries.length,
          page,
          limit,
          pages: Math.ceil(deliveries.length / limit),
        },
      };
      return NextResponse.json({ success: true, storage: 'local', data: payload });
    }

    await connectDB();

    // Build query — volunteers always query by their real logged-in ID unless
    // an admin explicitly filters by another volunteer.
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (user.role === 'VOLUNTEER' && !volunteerId) {
      query.volunteerId = user.id;
    } else if (volunteerId) {
      query.volunteerId = volunteerId;
    }
    if (ngoId) query.assignedNGO = ngoId;

    // Get deliveries with pagination
    const [deliveries, total] = await Promise.all([
      Delivery.find(query)
        .populate('donationId')
        .populate('assignedNGO', 'name email phone location')
        .populate('volunteerId', 'name email phone location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Delivery.countDocuments(query).exec(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        deliveries,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
});

// POST /api/deliveries - Create a new delivery (NGO / admin force-assign)
export const POST = withRole(['NGO', 'ADMIN'])(async (request: NextRequest) => {
  try {
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user;
    const body = await request.json();
    const { donationId, volunteerId, routeInfo, notes, ngoId } = body;

    // Validate required fields
    if (!donationId || !volunteerId) {
      return NextResponse.json(
        { success: false, error: 'Donation ID and Volunteer ID are required' },
        { status: 400 }
      );
    }

    // Get the donation
    const donation = await Donation.findById(donationId).exec();
    if (!donation) {
      return NextResponse.json(
        { success: false, error: 'Donation not found' },
        { status: 404 }
      );
    }

    // Check if donation is claimable
    if (!['ACCEPTED', 'MATCHED'].includes(donation.status)) {
      return NextResponse.json(
        { success: false, error: 'Donation is not available for delivery' },
        { status: 400 }
      );
    }

    // Admins may override the assigned NGO (force-assign flow). The NGO is
    // validated so the delivery can never be attributed to the admin account.
    let assignedNGO = user.id;
    if (user.role === 'ADMIN' && ngoId) {
      const ngoUser = await User.findById(ngoId).select('role').exec();
      if (ngoUser && ngoUser.role === 'NGO') {
        assignedNGO = ngoId;
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid NGO selected for assignment' },
          { status: 400 }
        );
      }
    }

    // Drop-off location is the assigned NGO's registered location
    let dropoffLocation = donation.location;
    const assignedNgo = await User.findById(assignedNGO).exec();
    if (assignedNgo?.location?.coordinates?.length) {
      dropoffLocation = assignedNgo.location;
    }

    // Create delivery
    const delivery = new Delivery({
      donationId,
      assignedNGO,
      volunteerId,
      routeInfo: routeInfo || {
        distance: 0,
        duration: 0,
        steps: [],
      },
      pickupLocation: donation.location,
      dropoffLocation,
      notes,
    });

    await delivery.save();

    // Update donation status
    donation.status = 'PICKED_UP';
    donation.assignedVolunteer = volunteerId;
    await donation.save();

    await invalidateActiveDonations();

    // Notify volunteer
    notifyUser(volunteerId, 'delivery:assigned', {
      deliveryId: delivery._id,
      donationId,
      ngoId: assignedNGO,
    });

    // Notify donor
    if (donation.donorId) {
      notifyUser(donation.donorId.toString(), 'donation:status:update', {
        donationId,
        status: 'PICKED_UP',
      });
    }

    return NextResponse.json({
      success: true,
      data: delivery,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating delivery:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create delivery' },
      { status: 500 }
    );
  }
});

// PUT /api/deliveries - Update delivery status (NGO / admin / volunteer)
export const PUT = withAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user;
    const body = await request.json();
    const { deliveryId, status, location, proofPhotoUrl, qrData } = body;

    if (!deliveryId || !status) {
      return NextResponse.json(
        { success: false, error: 'Delivery ID and status are required' },
        { status: 400 }
      );
    }

    // Find the delivery
    const delivery = await Delivery.findById(deliveryId).exec();
    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    // Check authorization
    const isVolunteer = delivery.volunteerId.toString() === user.id;
    const isNGO = delivery.assignedNGO.toString() === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isVolunteer && !isNGO && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to update this delivery' },
        { status: 403 }
      );
    }

    // QR verification for pickup / delivery steps — the scanned token is a JWT
    // signed with JWT_SECRET and must reference this delivery's donation.
    if (status === 'PICKUP_VERIFIED' || status === 'DELIVERY_VERIFIED') {
      if (!qrData) {
        return NextResponse.json(
          { success: false, error: 'QR code data is required for verification' },
          { status: 400 }
        );
      }

      const expectedType = status === 'PICKUP_VERIFIED' ? 'PICKUP' : 'DELIVERY';
      const result = verifyQRCode(qrData);
      if (
        !result.valid ||
        !result.data ||
        result.data.type !== expectedType ||
        result.data.donationId !== delivery.donationId.toString()
      ) {
        return NextResponse.json(
          { success: false, error: 'QR code verification failed: code does not match this delivery' },
          { status: 400 }
        );
      }
    }

    // Update delivery
    delivery.status = status;
    if (location) {
      delivery.currentLocation = {
        type: 'Point',
        coordinates: [location.lng, location.lat],
      };
    }
    if (proofPhotoUrl) delivery.proofPhotoUrl = proofPhotoUrl;

    // Record verification timestamps and drive the donation status machine
    if (status === 'PICKUP_VERIFIED') {
      delivery.pickupVerifiedAt = new Date();
      await Donation.findByIdAndUpdate(delivery.donationId, {
        status: 'PICKED_UP',
      }).exec();
    }
    if (status === 'DELIVERY_VERIFIED') {
      delivery.deliveryVerifiedAt = new Date();
    }

    // If completed, set completion time and calculate carbon saved + meals
    if (status === 'COMPLETED') {
      delivery.completedAt = new Date();
      // Rough estimate: 0.2 kg CO2 saved per km
      delivery.carbonSavedKg = delivery.routeInfo.distance * 0.2;

      // Update donation status and capture impact metrics
      const donation = await Donation.findById(delivery.donationId).exec();
      if (donation) {
        const meals = donation.items.reduce((sum: number, item) => sum + item.qty, 0);
        delivery.mealsProvided = meals;
        donation.status = 'DELIVERED';
        donation.mealsProvided = meals;
        donation.carbonSavedKg = delivery.carbonSavedKg;
        await donation.save();
      } else {
        await Donation.findByIdAndUpdate(delivery.donationId, {
          status: 'DELIVERED',
        }).exec();
      }

      await invalidateActiveDonations();
    }

    await delivery.save();

    // Notify relevant parties
    notifyDelivery(deliveryId, 'delivery:status:update', {
      deliveryId,
      status,
      location,
    });

    return NextResponse.json({
      success: true,
      data: delivery,
    });
  } catch (error) {
    console.error('Error updating delivery:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update delivery' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/deliveries - Volunteer-scoped updates.
 *
 * The logged-in volunteer can only update deliveries assigned to them:
 * GPS location pings, IN_TRANSIT transitions and proof-of-delivery photos.
 * Verification statuses (PICKUP_VERIFIED / DELIVERY_VERIFIED / COMPLETED)
 * are handled by /api/donations/qr after a real camera scan.
 */
export const PATCH = withRole(['VOLUNTEER'])(async (request: NextRequest) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user;
    const body = await request.json();
    const { deliveryId, status, location, proofPhotoUrl } = body;

    if (!deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Delivery ID is required' },
        { status: 400 }
      );
    }

    // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
    if (!(await canUseMongo())) {
      const delivery = localGetDelivery(deliveryId);
      if (!delivery) {
        return NextResponse.json(
          { success: false, error: 'Delivery not found' },
          { status: 404 }
        );
      }
      if (delivery.volunteerId !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Not authorized to update this delivery' },
          { status: 403 }
        );
      }
      if (status && !['ASSIGNED', 'IN_TRANSIT', 'COMPLETED'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Verification statuses require a QR scan' },
          { status: 400 }
        );
      }

      const patch: Partial<LocalDelivery> = {};
      if (status) patch.status = status as LocalDelivery['status'];
      if (status === 'COMPLETED' && !delivery.completedAt) {
        patch.completedAt = new Date().toISOString();
        const donation = localGetDonation(delivery.donationId);
        patch.mealsProvided = donation
          ? donation.items.reduce((sum, i) => sum + i.qty, 0)
          : 0;
        localUpdateDonation(delivery.donationId, { status: 'DELIVERED' });
      }

      const updated = localUpdateDelivery(deliveryId, patch);
      return NextResponse.json({
        success: true,
        storage: 'local',
        data: updated ? localDeliveryToResponse(updated) : null,
      });
    }

    await connectDB();

    const delivery = await Delivery.findById(deliveryId).exec();
    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    // Real logged-in volunteer ID ownership check
    if (delivery.volunteerId.toString() !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to update this delivery' },
        { status: 403 }
      );
    }

    if (status) {
      if (!['ASSIGNED', 'IN_TRANSIT', 'COMPLETED'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Verification statuses require a QR scan' },
          { status: 400 }
        );
      }
      delivery.status = status;
    }

    if (location) {
      delivery.currentLocation = {
        type: 'Point',
        coordinates: [location.lng, location.lat],
      };
    }

    if (proofPhotoUrl) delivery.proofPhotoUrl = proofPhotoUrl;

    // COMPLETED via PATCH — record impact metrics and mark the donation
    // delivered (the QR route also does this after a DROPOFF scan).
    if (status === 'COMPLETED' && !delivery.completedAt) {
      delivery.completedAt = new Date();
      delivery.carbonSavedKg =
        Math.round(delivery.routeInfo.distance * 0.2 * 100) / 100;

      const donation = await Donation.findById(delivery.donationId).exec();
      if (donation) {
        const meals = donation.items.reduce((sum, item) => sum + item.qty, 0);
        delivery.mealsProvided = meals;
        donation.status = 'DELIVERED';
        donation.mealsProvided = meals;
        donation.carbonSavedKg = delivery.carbonSavedKg;
        await donation.save();
      }

      await invalidateActiveDonations();
      notifyUser(delivery.assignedNGO.toString(), 'delivery:status:update', {
        deliveryId,
        status: 'COMPLETED',
      });
    }

    await delivery.save();

    if (location) {
      notifyDelivery(deliveryId, 'volunteer:location:update', {
        volunteerId: user.id,
        deliveryId,
        location,
      });
    }

    return NextResponse.json({
      success: true,
      data: delivery,
    });
  } catch (error) {
    console.error('Error patching delivery:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update delivery' },
      { status: 500 }
    );
  }
});
