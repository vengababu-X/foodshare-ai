import { NextRequest, NextResponse } from 'next/server';
import { connectDB, isDbConnectionError, canUseMongo } from '@/lib/db';
import {
  localListDonations,
  localCreateDonation,
  localDonationToResponse,
} from '@/services/localStore';
import Donation from '@/models/Donation';
import User from '@/models/User';
import { withAuth, withRole } from '@/middleware/auth';
import { getUrgencyScore } from '@/services/aiEngine';
import { notifyDonation } from '@/lib/socket';
import { broadcast } from '@/lib/pusher';
import {
  cacheActiveDonations,
  getCachedActiveDonations,
  invalidateActiveDonations,
} from '@/lib/redis';

// GET /api/donations - Get donations (with filters).
// The unfiltered feed is served from the Upstash `active_donations` cache
// (30s TTL) and invalidated on every mutation.
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const donorId = searchParams.get('donorId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const skip = (page - 1) * limit;

    // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
    if (!(await canUseMongo())) {
      const filtered = localListDonations(status || undefined, limit).filter(
        (d) => (donorId ? d.donorId === donorId : true)
      );
      const localDonations = filtered.map((d) => localDonationToResponse(d));
      const payload = {
        donations: localDonations,
        pagination: {
          total: localDonations.length,
          page,
          limit,
          pages: Math.ceil(localDonations.length / limit),
        },
      };
      return NextResponse.json({ success: true, storage: 'local', data: payload });
    }

    await connectDB();

    // The general active feed is cached in Redis for 30 seconds.
    if (!status && !donorId && page === 1) {
      const cached = await getCachedActiveDonations(limit);
      if (cached) {
        return NextResponse.json({ success: true, cached: true, data: cached });
      }
    }

    // Build query
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (donorId) query.donorId = donorId;

    // Get donations with pagination
    const [donations, total] = await Promise.all([
      Donation.find(query)
        .populate('donorId', 'name email phone location')
        .populate('matchedNGO', 'name email phone location')
        .populate('assignedVolunteer', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Donation.countDocuments(query).exec(),
    ]);

    const payload = {
      donations,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };

    // Cache only the general active feed (no status filter) so donors and
    // dashboards benefit while NGO status queries always read fresh data.
    if (!status && !donorId && page === 1) {
      await cacheActiveDonations(payload);
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    console.error('Error fetching donations:', error);
    if (isDbConnectionError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again in a moment.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch donations' },
      { status: 500 }
    );
  }
});

// POST /api/donations - Create a new donation
export const POST = withRole(['DONOR'])(async (request: NextRequest) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user;
    const body = await request.json();
    const { items, cookedAt, expiresAt, image, photoUrl, notes, location, donorType } = body;

    // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
    if (!(await canUseMongo())) {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one item is required' },
          { status: 400 }
        );
      }
      if (!cookedAt || !expiresAt) {
        return NextResponse.json(
          { success: false, error: 'Cooking and expiration times are required' },
          { status: 400 }
        );
      }

      const imageUrl = image || photoUrl || undefined;
      const coords: [number, number] | undefined =
        Array.isArray(location?.coordinates) && location.coordinates.length === 2
          ? [location.coordinates[0], location.coordinates[1]]
          : undefined;

      const cooked = new Date(cookedAt);
      const expires = new Date(expiresAt);
      const localDonation = localCreateDonation({
        donorId: user.id,
        donorEmail: user.email,
        donorType,
        items,
        cookedAt: cooked.toISOString(),
        expiresAt: expires.toISOString(),
        urgencyScore: getUrgencyScore({ cookedAt: cooked, expiresAt: expires }),
        image: imageUrl,
        notes,
        coordinates: coords,
      });

      // Keep connected portals in sync (no-op without Pusher keys).
      void broadcast('donation-created', {
        donationId: localDonation.id,
        status: localDonation.status,
        createdAt: localDonation.createdAt,
      });

      return NextResponse.json(
        {
          success: true,
          storage: 'local',
          data: localDonationToResponse(localDonation),
          message: 'Donation created (local store) and now available for NGOs',
        },
        { status: 201 }
      );
    }

    await connectDB();

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one item is required' },
        { status: 400 }
      );
    }

    if (!cookedAt || !expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Cooking and expiration times are required' },
        { status: 400 }
      );
    }

    // Get donor location if not provided
    let donationLocation = location;
    if (!donationLocation) {
      const donor = await User.findById(user.id).exec();
      if (!donor) {
        return NextResponse.json(
          { success: false, error: 'Donor not found' },
          { status: 404 }
        );
      }
      donationLocation = donor.location;
    }

    // Cloudinary image URL (canonical `image` field; `photoUrl` mirrors it for
    // legacy consumers such as the AI quality analyzer).
    const imageUrl = image || photoUrl || undefined;

    // Create the donation as AVAILABLE in the live NGO feed
    const donation = new Donation({
      donorId: user.id,
      donorType,
      items,
      cookedAt: new Date(cookedAt),
      expiresAt: new Date(expiresAt),
      location: donationLocation,
      image: imageUrl,
      photoUrl: imageUrl,
      notes,
      status: 'AVAILABLE',
    });

    // Calculate urgency score
    donation.urgencyScore = getUrgencyScore({
      cookedAt: donation.cookedAt,
      expiresAt: donation.expiresAt,
    });

    await donation.save();

    // Invalidate the cached active feed — a new donation is live immediately.
    await invalidateActiveDonations();

    // Populate and broadcast a MINIMAL payload on the public food-channel —
    // never donor PII (email/phone/location). Subscribers refetch the full
    // record through the authenticated API.
    await donation.populate('donorId', 'name email phone location');
    void broadcast('donation-created', {
      donationId: donation._id,
      status: donation.status,
      createdAt: donation.createdAt,
    });

    return NextResponse.json({
      success: true,
      data: donation,
      message: 'Donation created and now available for NGOs',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating donation:', error);
    if (isDbConnectionError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again in a moment.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create donation' },
      { status: 500 }
    );
  }
});

// PUT /api/donations - Update donation status (decline, cancel, etc.)
export const PUT = withAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user;
    const body = await request.json();
    const { donationId, status, matchedNGO, assignedVolunteer, declined } = body;

    if (!donationId || !status) {
      return NextResponse.json(
        { success: false, error: 'Donation ID and status are required' },
        { status: 400 }
      );
    }

    // Find the donation
    const donation = await Donation.findById(donationId).exec();
    if (!donation) {
      return NextResponse.json(
        { success: false, error: 'Donation not found' },
        { status: 404 }
      );
    }

    // Check authorization
    const isOwner = donation.donorId.toString() === user.id;
    const isNGO = user.role === 'NGO' && donation.matchedNGO?.toString() === user.id;
    const isVolunteer = user.role === 'VOLUNTEER' && donation.assignedVolunteer?.toString() === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isNGO && !isVolunteer && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to update this donation' },
        { status: 403 }
      );
    }

    // NGO explicitly declined — return the donation to the available feed so
    // other NGOs can accept it.
    if (declined) {
      const reset = await Donation.findByIdAndUpdate(
        donationId,
        { $set: { status: 'AVAILABLE' }, $unset: { matchedNGO: 1 } },
        { new: true, runValidators: true }
      ).exec();
      await invalidateActiveDonations();
      return NextResponse.json({
        success: true,
        data: reset,
        message: 'Declined. Donation returned to the available feed.',
      });
    }

    // Update donation
    donation.status = status;
    if (matchedNGO) donation.matchedNGO = matchedNGO;
    if (assignedVolunteer) donation.assignedVolunteer = assignedVolunteer;

    await donation.save();

    // Any status change affects the active feed — drop the cache.
    await invalidateActiveDonations();

    // Notify relevant parties
    notifyDonation(donationId, 'donation:status:update', {
      donationId,
      status,
    });

    return NextResponse.json({
      success: true,
      data: donation,
    });
  } catch (error) {
    console.error('Error updating donation:', error);
    if (isDbConnectionError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again in a moment.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update donation' },
      { status: 500 }
    );
  }
});
