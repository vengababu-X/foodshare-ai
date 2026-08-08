import { NextResponse } from 'next/server';
import { getPlatformStats } from '@/services/statsService';

// This route reads live MongoDB aggregations — never statically prerender it.
export const dynamic = 'force-dynamic';

// GET /api/impact/stats - Aggregate impact statistics (public)
export const GET = async () => {
  try {
    const stats = await getPlatformStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching impact stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch impact statistics' },
      { status: 500 }
    );
  }
};
