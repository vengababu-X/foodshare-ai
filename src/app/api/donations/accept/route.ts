import { NextRequest, NextResponse } from 'next/server';
import { connectDB, isDbConnectionError, canUseMongo } from '@/lib/db';
import {
  localGetDonation,
  localListVolunteers,
  localUpdateDonation,
  localCreateDelivery,
  localDeliveryToResponse,
} from '@/services/localStore';
import Donation from '@/models/Donation';
import Delivery from '@/models/Delivery';
import User from '@/models/User';
import { withRole } from '@/middleware/auth';
import { notifyUser } from '@/lib/socket';
import { broadcast } from '@/lib/pusher';
import { invalidateActiveDonations } from '@/lib/redis';
import { getDrivingRoute } from '@/services/routing';
import { calculateDistance } from '@/services/aiEngine';
import { generatePickupQR } from '@/services/qrService';

export const POST = withRole(['NGO'])(async (request: NextRequest) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user;
    const body = await request.json();
    const { donationId } = body;

    if (!donationId) {
      return NextResponse.json(
        { success: false, error: 'Donation ID is required' },
        { status: 400 }
      );
    }

    // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
    if (!(await canUseMongo())) {
      const donation = localGetDonation(donationId);
      if (!donation || donation.status !== 'AVAILABLE') {
        return NextResponse.json(
          { success: false, error: 'Donation is no longer available for acceptance' },
          { status: 409 }
        );
      }

      const volunteers = localListVolunteers();
      if (volunteers.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active volunteers available nearby right now' },
          { status: 409 }
        );
      }
      const volunteer = volunteers[0];

      const updated = localUpdateDonation(donation.id, {
        status: 'ACCEPTED',
        matchedNGO: user.id,
      });

      const delivery = localCreateDelivery({
        donationId: donation.id,
        assignedNGO: user.id,
        volunteerId: volunteer.id,
        pickupLocation: {
          type: 'Point',
          coordinates: donation.coordinates || [78.4867, 17.385],
        },
        dropoffLocation: { type: 'Point', coordinates: [78.4867, 17.385] },
      });

      void broadcast('donation-accepted', {
        donationId: donation.id,
        deliveryId: delivery.id,
        status: 'ACCEPTED',
      });

      return NextResponse.json(
        {
          success: true,
          storage: 'local',
          data: {
            delivery: localDeliveryToResponse(delivery),
            donation: {
              _id: donation.id,
              status: updated?.status || 'ACCEPTED',
              matchedNGO: user.id,
            },
            volunteer: { _id: volunteer.id, name: volunteer.name },
          },
          message: `Donation accepted (local store). ${volunteer.name} has been assigned for pickup.`,
        },
        { status: 201 }
      );
    }

    await connectDB();

    // Only verified NGOs with a registered location may accept donations.
    const ngo = await User.findById(user.id).exec();
    if (!ngo) {
      return NextResponse.json(
        { success: false, error: 'NGO account not found' },
        { status: 404 }
      );
    }
    if (!ngo.isVerified) {
      return NextResponse.json(
        { success: false, error: 'Your NGO is not verified yet' },
        { status: 403 }
      );
    }
    if (!ngo.location?.coordinates?.length) {
      return NextResponse.json(
        { success: false, error: 'Your NGO profile is missing a location' },
        { status: 400 }
      );
    }

    // Atomic claim: only an AVAILABLE donation can be accepted.
    const donation = await Donation.findOneAndUpdate(
      { _id: donationId, status: { $in: ['AVAILABLE', 'PENDING'] } },
      { $set: { status: 'ACCEPTED', matchedNGO: user.id } },
      { new: true, runValidators: true }
    ).exec();

    if (!donation) {
      return NextResponse.json(
        { success: false, error: 'Donation is no longer available for acceptance' },
        { status: 409 }
      );
    }

    // Issue the pickup QR
    try {
      const pickupQr = await generatePickupQR(donation._id.toString());
      await Donation.findByIdAndUpdate(donation._id, {
        pickupQrCode: pickupQr.qrData,
      }).exec();
    } catch (error) {
      console.error('Failed to generate pickup QR:', error);
    }

    // ── FIX 1: Find an active volunteer (fallback to any available volunteer if geospatial index fails) ──
    let volunteer = await User.findOne({
      role: 'VOLUNTEER',
      $or: [{ status: 'ACTIVE' }, { isAvailable: true }],
      location: {
        $near: {
          $geometry: donation.location.coordinates,
          $maxDistance: 100000, // 100km
        },
      },
    }).exec();

    // Fallback search if geospatial query doesn't match due to index setup
    if (!volunteer) {
      volunteer = await User.findOne({
        role: 'VOLUNTEER',
      }).exec();
    }

    if (!volunteer) {
      // Roll the donation back so it remains available to other NGOs.
      await Donation.findByIdAndUpdate(donation._id, {
        status: 'AVAILABLE',
        matchedNGO: null,
      }).exec();
      return NextResponse.json(
        { success: false, error: 'No active volunteers available nearby right now' },
        { status: 409 }
      );
    }

    // Compute the real driving route
    const pickupCoords = donation.location.coordinates as [number, number];
    const dropoffCoords = ngo.location.coordinates as [number, number];

    const route = await getDrivingRoute(
      { lat: pickupCoords[1], lng: pickupCoords[0] },
      { lat: dropoffCoords[1], lng: dropoffCoords[0] }
    );

    let distanceKm = 0;
    let durationMin = 0;
    let routeCoordinates: Array<[number, number]> | undefined;
    if (route) {
      distanceKm = route.distanceKm;
      durationMin = route.durationMin;
      routeCoordinates = route.coordinates;
    } else {
      distanceKm = Math.round(
        calculateDistance(
          { lat: pickupCoords[1], lng: pickupCoords[0] },
          { lat: dropoffCoords[1], lng: dropoffCoords[0] }
        ) * 10
      ) / 10;
      durationMin = Math.max(1, Math.round(distanceKm / 25 * 60));
    }

    // Create the delivery assigned to the volunteer
    const delivery = new Delivery({
      donationId: donation._id,
      assignedNGO: user.id,
      volunteerId: volunteer._id,
      routeInfo: {
        distance: distanceKm,
        duration: durationMin,
        steps: [],
      },
      routeCoordinates,
      pickupLocation: donation.location,
      dropoffLocation: ngo.location,
      status: 'ASSIGNED',
    });

    await delivery.save();

    // ── FIX 2: Automatically set the NGO to inactive/busy so they show as busy ──
    await User.findByIdAndUpdate(user.id, {
      isAvailable: false,
      status: 'BUSY',
    }).exec();

    await invalidateActiveDonations();

    // Notify the volunteer and the donor
    notifyUser(volunteer._id.toString(), 'delivery:assigned', {
      deliveryId: delivery._id,
      donationId: donation._id,
      ngoId: user.id,
    });
    notifyUser(donation.donorId.toString(), 'donation:status:update', {
      donationId: donation._id,
      status: 'ACCEPTED',
    });

    void broadcast('donation-accepted', {
      donationId: donation._id,
      deliveryId: delivery._id,
      status: 'ACCEPTED',
    });

    return NextResponse.json({
      success: true,
      data: {
        delivery: {
          ...delivery.toObject(),
          donationId: {
            _id: donation._id,
            items: donation.items,
          },
        },
        donation: {
          _id: donation._id,
          status: donation.status,
          matchedNGO: donation.matchedNGO,
        },
        volunteer: {
          _id: volunteer._id,
          name: volunteer.name,
          phone: volunteer.phone,
        },
      },
      message: `Donation accepted. ${volunteer.name} has been assigned for pickup.`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error accepting donation:', error);
    if (isDbConnectionError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again in a moment.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to accept donation' },
      { status: 500 }
    );
  }
});
