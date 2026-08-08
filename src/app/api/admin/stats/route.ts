import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import { canUseMongo } from '@/lib/db';
import { getPlatformStats, getLocalPlatformStats } from '@/services/statsService';

// This route reads live MongoDB aggregations — never statically prerender it.
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats - Aggregate platform statistics (admin only).
 *
 * Smart Hybrid: when MongoDB is unreachable (DNS/querySrv blocked on a
 * restricted network), the same KPI shape is computed from the real local
 * JSON files (data/users.json, data/donations.json) so the admin dashboard
 * loads with live numbers instead of a 500.
 */
export const GET = withRole(['ADMIN'])(async () => {
  try {
    if (!(await canUseMongo())) {
      const stats = await getLocalPlatformStats();
      return NextResponse.json({ success: true, storage: 'local', data: stats });
    }

    const stats = await getPlatformStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch platform statistics' },
      { status: 500 }
    );
  }
});
