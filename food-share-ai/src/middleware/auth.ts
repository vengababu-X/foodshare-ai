import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import User from '@/models/User';
import { connectDB, canUseMongo } from '@/lib/db';
import { JWT_SECRET } from '@/lib/jwtConfig';
import { UserRole } from '@/types';
import { localFindUserById } from '@/services/localStore';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequestContext = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequestHandler = (request: NextRequest, context?: RequestContext) => Promise<NextResponse>;

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

/** Set the httpOnly JWT session cookie on a response (shared by all auth paths). */
export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
  return response;
}

export async function authenticateUser(
  request: NextRequest
): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    // Get token from cookies or Authorization header
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return { user: null, error: 'No token provided' };
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return { user: null, error: 'Invalid token' };
    }

    // Verify the user still exists — a signed token alone is never trusted.
    // Smart Hybrid: MongoDB first (probe respects the 30s failure cooldown so
    // an outage doesn't stall every request), local JSON store when down.
    if (await canUseMongo()) {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return { user: null, error: 'User not found' };
      }
    } else if (!localFindUserById(decoded.id)) {
      return { user: null, error: 'User not found' };
    }

    return { user: decoded };
  } catch {
    return { user: null, error: 'Authentication failed' };
  }
}

export function withAuth(handler: RequestHandler) {
  return async (request: NextRequest, context?: RequestContext) => {
    const { user, error } = await authenticateUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Add user to request context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).user = user;
    
    return handler(request, context);
  };
}

export function withRole(roles: UserRole[]) {
  return (handler: RequestHandler) => {
    return async (request: NextRequest, context?: RequestContext) => {
      const { user, error } = await authenticateUser(request);
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: error || 'Unauthorized' },
          { status: 401 }
        );
      }

      if (!roles.includes(user.role)) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      // Add user to request context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (request as any).user = user;
      
      return handler(request, context);
    };
  };
}

export default {
  generateToken,
  verifyToken,
  setSessionCookie,
  authenticateUser,
  withAuth,
  withRole,
};