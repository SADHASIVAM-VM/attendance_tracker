import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const UPLOAD_DIR = path.resolve(process.cwd(), '.uploads', 'attendance_photos');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const STORAGE_SECRET = process.env.STORAGE_SECRET || 'attendance_storage_secret_key_2026';

export interface UploadAuthorization {
  uploadUrl: string;
  photoObjectKey: string;
  expiresAt: string;
  fields: {
    photoObjectKey: string;
    token: string;
  };
}

/**
 * Generates an authorized upload reference for the user with an expiration window of 10 minutes.
 */
export function generateUploadAuthorization(userId: string): UploadAuthorization {
  const photoObjectKey = `selfies/${userId}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.jpg`;
  
  const token = jwt.sign(
    {
      userId,
      photoObjectKey,
      purpose: 'ATTENDANCE_PHOTO_UPLOAD',
    },
    STORAGE_SECRET,
    { expiresIn: '10m' }
  );

  return {
    uploadUrl: '/api/v1/attendance/upload-photo',
    photoObjectKey,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    fields: {
      photoObjectKey,
      token,
    },
  };
}

/**
 * Generates a short-lived signed download URL (15 minutes expiration) for private photos.
 */
export function generateSignedDownloadUrl(photoObjectKey: string, userId?: string): string {
  const token = jwt.sign(
    {
      photoObjectKey,
      userId,
      purpose: 'ATTENDANCE_PHOTO_VIEW',
    },
    STORAGE_SECRET,
    { expiresIn: '15m' }
  );

  return `/api/v1/storage/file?token=${encodeURIComponent(token)}`;
}

/**
 * Validates and saves an uploaded photo file.
 */
export async function savePhoto(photoObjectKey: string, buffer: Buffer): Promise<string> {
  const safeFilename = photoObjectKey.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const filePath = path.join(UPLOAD_DIR, safeFilename);

  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Resolves the private file buffer from a verified photoObjectKey.
 */
export async function getPhotoBuffer(photoObjectKey: string): Promise<Buffer | null> {
  const safeFilename = photoObjectKey.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const filePath = path.join(UPLOAD_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    return await fs.promises.readFile(filePath);
  }
  return null;
}

/**
 * Verifies download token.
 */
export function verifyStorageToken(token: string): { photoObjectKey: string; userId?: string } | null {
  try {
    const payload = jwt.verify(token, STORAGE_SECRET) as any;
    return payload;
  } catch (err) {
    return null;
  }
}
