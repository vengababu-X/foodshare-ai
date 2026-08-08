import { NextRequest, NextResponse } from 'next/server';
import { connectDB, canUseMongo, isDbConnectionError } from '@/lib/db';
import User from '@/models/User';
import { withAuth, withRole } from '@/middleware/auth';
import { POST as registerUser } from '@/app/api/auth/register/route';
import {
  localListUsers,
  localFindUserById,
  localUpdateUser,
} from '@/services/localStore';
import type { LocalUser } from '@/services/localStore';

// GET /api/users - Get all users (with filters)
export const GET = withRole(['ADMIN'])(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const verified = searchParams.get('verified');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
    if (!(await canUseMongo())) {
      const all = localListUsers().filter((u) => {
        if (role && u.role !== role) return false;
        if (verified !== null && u.isVerified !== (verified === 'true')) return false;
        if (status && u.status !== status) return false;
        return true;
      });
      const sliced = all.slice(skip, skip + limit);
      const localUsers = sliced.map((u) => ({
        _id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        donorType: u.donorType,
        phone: u.phone || '',
        isVerified: u.isVerified ?? false,
        status: u.status || 'ACTIVE',
        capacity: u.capacity ?? 0,
        rating: 5,
        location: u.coordinates ? { coordinates: u.coordinates } : undefined,
        createdAt: u.createdAt,
      }));
      return NextResponse.json({
        success: true,
        storage: 'local',
        data: {
          users: localUsers,
          pagination: {
            total: all.length,
            page,
            limit,
            pages: Math.ceil(all.length / limit),
          },
        },
      });
    }

    await connectDB();

    // Build query
    const query: Record<string, unknown> = {};
    if (role) query.role = role;
    if (verified !== null) query.isVerified = verified === 'true';
    if (status) query.status = status;

    // Get users with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      User.countDocuments(query).exec(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    if (isDbConnectionError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again in a moment.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
});

// POST /api/users - Alias for /api/auth/register (single source of truth for
// account creation; kept so legacy callers keep working).
export const POST = registerUser;

// PUT /api/users - Update user profile
export const PUT = withAuth(async (request: NextRequest) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authUser = (request as any).user;
    const body = await request.json();
    const { userId, name, phone, location, capacity, isVerified, status } = body;
    const isAdmin = authUser?.role === 'ADMIN';

    // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
    if (!(await canUseMongo())) {
      // Admin managing another user (approve/reject/suspend)
      if (userId && userId !== authUser?.id) {
        if (!isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Only admins can manage other users' },
            { status: 403 }
          );
        }
        const target = localFindUserById(userId);
        if (!target) {
          return NextResponse.json(
            { success: false, error: 'User not found' },
            { status: 404 }
          );
        }
        const patch: Partial<LocalUser> = {};
        if (name) patch.name = name;
        if (phone !== undefined) patch.phone = phone;
        if (location?.coordinates) patch.coordinates = location.coordinates;
        if (capacity !== undefined && target.role === 'NGO') patch.capacity = capacity;
        if (isVerified !== undefined && target.role === 'NGO') patch.isVerified = isVerified;
        if (status !== undefined && ['ACTIVE', 'SUSPENDED'].includes(status)) {
          patch.status = status;
        }
        const updated = localUpdateUser(userId, patch);
        return NextResponse.json({ success: true, storage: 'local', data: updated });
      }

      // Self profile update
      const patch: Partial<LocalUser> = {};
      if (name) patch.name = name;
      if (phone !== undefined) patch.phone = phone;
      if (location?.coordinates) patch.coordinates = location.coordinates;
      if (capacity !== undefined) patch.capacity = capacity;
      const updated = localUpdateUser(authUser?.id, patch);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, storage: 'local', data: updated });
    }

    await connectDB();

    // ── Admin managing ANOTHER user (approve/reject NGO, suspend, etc.) ─────
    if (userId && userId !== authUser?.id) {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only admins can manage other users' },
          { status: 403 }
        );
      }

      const target = await User.findById(userId).exec();
      if (!target) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      // Build admin update object
      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (location) updateData.location = location;
      if (capacity !== undefined && target.role === 'NGO') updateData.capacity = capacity;
      if (isVerified !== undefined && target.role === 'NGO') updateData.isVerified = isVerified;
      if (status !== undefined && ['ACTIVE', 'SUSPENDED'].includes(status)) {
        updateData.status = status;
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password').exec();

      return NextResponse.json({ success: true, data: updatedUser });
    }

    // ── Self profile update ─────────────────────────────────────────────────
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (location) updateData.location = location;
    if (capacity !== undefined) updateData.capacity = capacity;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      authUser?.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password').exec();

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    if (isDbConnectionError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again in a moment.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
});