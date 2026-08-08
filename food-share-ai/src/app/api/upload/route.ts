import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { withAuth } from '@/middleware/auth';

/**
 * POST /api/upload (authenticated)
 *
 * Server-side image upload using the Cloudinary SDK (configured via the
 * CLOUDINARY_URL environment variable). Returns the HTTPS CDN URL:
 *   { success: true, url: "https://res.cloudinary.com/..." }
 */

export const dynamic = 'force-dynamic';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image must be less than 5MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Zero-dependency fallback: when CLOUDINARY_URL is not configured, return a
    // data URI so photo uploads work out-of-the-box on any serverless host
    // with no external keys. The client compresses images (canvas, max 1280px,
    // JPEG) before upload; the 2MB cap here keeps the Base64 payload well
    // inside MongoDB's 16MB document limit even for direct API callers.
    if (!process.env.CLOUDINARY_URL) {
      if (buffer.length > 2 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'Image must be less than 2MB for data-URI storage' },
          { status: 400 }
        );
      }
      const base64 = buffer.toString('base64');
      const dataUri = `data:${file.type || 'image/jpeg'};base64,${base64}`;
      return NextResponse.json({
        success: true,
        url: dataUri,
        storage: 'data-uri',
      });
    }

    // Upload through the Cloudinary SDK (uses CLOUDINARY_URL from env)
    const result = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'food-share-ai', resource_type: 'image' },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error || new Error('Cloudinary upload failed'));
            return;
          }
          resolve({
            secure_url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
          });
        }
      );
      stream.end(buffer);
    });

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          'Failed to upload image. Check that CLOUDINARY_URL is configured.',
      },
      { status: 500 }
    );
  }
});
