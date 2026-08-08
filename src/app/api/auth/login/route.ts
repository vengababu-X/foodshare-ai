import { NextRequest, NextResponse } from 'next/server';
import { connectDB, isDbConnectionError, canUseMongo } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { generateToken, setSessionCookie } from '@/middleware/auth';
import {
  localFindUserByEmail,
  localVerifyPassword,
  localSanitizeUser,
} from '@/services/localStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // ── Smart Hybrid: local JSON store when MongoDB is unreachable ──────────
    if (!(await canUseMongo())) {
      if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
        return NextResponse.json(
          { success: false, error: 'Email and password are required' },
          { status: 400 }
        );
      }
      const localUser = localFindUserByEmail(email);
      if (!localUser || !localVerifyPassword(localUser, password)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        );
      }
      const token = generateToken({
        id: localUser.id,
        email: localUser.email,
        role: localUser.role,
      });
      const response = NextResponse.json({
        success: true,
        storage: 'local',
        data: { user: localSanitizeUser(localUser), token },
      });
      return setSessionCookie(response, token);
    }

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Look up the user (password field is hidden by default — re-select it).
    // Register-only: accounts must be created through /register — there are
    // no demo credentials or fallback accounts.
    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select('+password')
      .exec();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate token
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Return user without password - create a copy without the password field
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

    // Set token in an httpOnly cookie — the session rides along on every
    // subsequent same-origin fetch automatically.
    const response = NextResponse.json({
      success: true,
      data: {
        user: userResponse,
        token,
      },
    });

    return setSessionCookie(response, token);
  } catch (error) {
    console.error('Login error:', error);
    if (isDbConnectionError(error)) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again in a moment.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to login' },
      { status: 500 }
    );
  }
}
