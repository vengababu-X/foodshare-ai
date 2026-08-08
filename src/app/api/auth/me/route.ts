import { NextRequest, NextResponse } from 'next/server';
import { connectDB, canUseMongo } from '@/lib/db';
import User from '@/models/User';
import { withAuth } from '@/middleware/auth';
import { localFindUserById, localSanitizeUser } from '@/services/localStore';

// GET /api/auth/me - Return the currently authenticated user
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authUser = (request as any).user as { id: string } | undefined;
    if (!authUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Smart Hybrid: local JSON store when MongoDB is unreachable.
    if (!(await canUseMongo())) {
      const localUser = localFindUserById(authUser.id);
      if (!localUser) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        storage: 'local',
        data: { user: localSanitizeUser(localUser) },
      });
    }

    const user = await User.findById(authUser.id).select('-password').exec();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
});
