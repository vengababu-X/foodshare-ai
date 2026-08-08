import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { JWT_SECRET } from '@/lib/jwtConfig';

/**
 * Next.js Edge middleware protecting the role-based dashboards.
 *
 * Verifies the JWT stored in the httpOnly `token` cookie using the Web Crypto
 * API (Edge-runtime safe — no Node-only dependencies, no mongoose imports).
 * The signing secret is shared with the API auth helpers via src/lib/jwtConfig.ts.
 */

type Role = 'ADMIN' | 'DONOR' | 'NGO' | 'VOLUNTEER';

const PROTECTED_ROUTES: Record<string, Role> = {
  '/admin': 'ADMIN',
  '/donor': 'DONOR',
  '/ngo': 'NGO',
  '/volunteer': 'VOLUNTEER',
};

const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  DONOR: '/donor',
  NGO: '/ngo',
  VOLUNTEER: '/volunteer',
};

// ---------------------------------------------------------------------------
// Minimal HS256 JWT verification (Edge-safe, mirrors jsonwebtoken defaults)
// ---------------------------------------------------------------------------

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface TokenPayload {
  id?: string;
  email?: string;
  role?: Role;
  exp?: number;
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      new TextEncoder().encode(`${header}.${payload}`)
    );

    if (!valid) return null;

    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as TokenPayload;
    if (!decoded.id || !decoded.role) return null;
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;

    return decoded;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware logic
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;
  const user = token ? await verifyToken(token) : null;

  // Authenticated users should not linger on /login — send them to their dashboard
  if (pathname === '/login') {
    if (user?.role && ROLE_HOME[user.role]) {
      return NextResponse.redirect(new URL(ROLE_HOME[user.role], request.url));
    }
    return NextResponse.next();
  }

  // Extract the top-level segment, e.g. /admin or /admin/anything -> /admin
  const topLevel = `/${pathname.split('/')[1] || ''}`;
  const requiredRole = PROTECTED_ROUTES[topLevel];
  if (!requiredRole) return NextResponse.next();

  // Unauthenticated -> login with a redirect back to the requested page
  if (!user || !user.role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Wrong role -> send them to their own dashboard
  if (user.role !== requiredRole) {
    return NextResponse.redirect(new URL(ROLE_HOME[user.role] || '/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/admin/:path*', '/donor/:path*', '/ngo/:path*', '/volunteer/:path*'],
};
