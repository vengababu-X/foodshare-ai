import { NextRequest, NextResponse } from 'next/server';
import { connectDB, canUseMongo } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { generateToken, setSessionCookie } from '@/middleware/auth';
import { localCreateUser, localSanitizeUser } from '@/services/localStore';

/**
 * POST /api/auth/register — create a real account (no demo/fallback users).
 *
 * Robust by design:
 *  - Every failure returns a detailed `{ success: false, error }` JSON body.
 *  - Field validation happens before any database work, with per-field messages.
 *  - Duplicate emails return 409 (normalized lower-case check + E11000 race guard).
 *  - Mongoose validation errors return 400 with the schema's message details.
 *  - MongoDB connection failures return a clear 500 instead of a generic crash.
 *  - On success the httpOnly JWT session cookie is set, so the new user lands
 *    straight on their dashboard.
 */

const VALID_ROLES = ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] as const;
type Role = (typeof VALID_ROLES)[number];

const DEFAULT_LOCATION = { type: 'Point' as const, coordinates: [78.4867, 17.385] }; // Hyderabad, India

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body. Send JSON.' },
      { status: 400 }
    );
  }

  const { name, email, password } = body as Record<string, unknown>;
  const phone = typeof body.phone === 'string' ? body.phone : '';
  const capacity = typeof body.capacity === 'number' ? body.capacity : 0;
  const donorType = typeof body.donorType === 'string' ? body.donorType : undefined;

  // Role defaults to DONOR when omitted, then normalizes to upper-case.
  const rawRole = body.role;
  const role: Role =
    typeof rawRole === 'string' && rawRole.trim() !== ''
      ? (rawRole.trim().toUpperCase() as Role)
      : 'DONOR';

  // ── Client-side field validation with detailed messages ──────────────────
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
  }
  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
  }
  if (typeof password !== 'string' || !password) {
    return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { success: false, error: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { success: false, error: 'Invalid role. Choose DONOR, NGO, VOLUNTEER or ADMIN' },
      { status: 400 }
    );
  }

  // ── Smart Hybrid: use MongoDB when reachable, else the local JSON store ──
  if (!(await canUseMongo())) {
    try {
      const localUser = localCreateUser({
        name: name as string,
        email: email as string,
        password: password as string,
        role: role as 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN',
        phone,
        donorType,
      });

      const token = generateToken({
        id: localUser.id,
        email: localUser.email,
        role: localUser.role,
      });

      const response = NextResponse.json(
        { success: true, storage: 'local', data: { user: localSanitizeUser(localUser), token } },
        { status: 201 }
      );
      return setSessionCookie(response, token);
    } catch (localError) {
      if (
        typeof localError === 'object' &&
        localError !== null &&
        (localError as { message?: string }).message?.includes('already exists')
      ) {
        return NextResponse.json(
          { success: false, error: (localError as { message: string }).message },
          { status: 409 }
        );
      }
      console.error('Local fallback registration error:', localError);
      return NextResponse.json(
        { success: false, error: 'Failed to create user. Please try again.' },
        { status: 500 }
      );
    }
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Duplicate check on the NORMALIZED email — the schema lowercases on save,
    // so comparing raw input here would let "Foo@Bar.com" slip past and crash
    // with a duplicate-key error instead of a friendly 409.
    const existingUser = await User.findOne({ email: normalizedEmail }).exec();
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Try logging in instead.' },
        { status: 409 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      donorType: role === 'DONOR' ? donorType || 'Individual' : undefined,
      phone,
      location: DEFAULT_LOCATION,
      capacity: role === 'NGO' ? capacity : 0,
    });

    await user.save();

    // Auto-login: issue the session token and set the httpOnly cookie
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      location: user.location,
      isVerified: user.isVerified,
      capacity: user.capacity,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const response = NextResponse.json(
      { success: true, data: { user: userResponse, token } },
      { status: 201 }
    );

    return setSessionCookie(response, token);
  } catch (error) {
    // Duplicate-key race (two sign-ups at the same instant) → friendly 409
    if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Try logging in instead.' },
        { status: 409 }
      );
    }

    // Mongoose schema validation → detailed 400 with the failing field message
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { name?: string }).name === 'ValidationError'
    ) {
      const validation = error as {
        errors: Record<string, { message: string }>;
      };
      const messages = Object.values(validation.errors).map((e) => e.message);
      return NextResponse.json(
        { success: false, error: messages.join('; ') || 'Invalid input' },
        { status: 400 }
      );
    }

    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user. Please try again.' },
      { status: 500 }
    );
  }
}
