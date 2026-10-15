import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve strictly to server root .uploads/attendance_photos
const UPLOAD_DIR = path.resolve(__dirname, '../../.uploads/attendance_photos');
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
 * Generates an authorized upload reference for the user with an expiration window of 30 minutes.
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
    { expiresIn: '30m' }
  );

  return {
    uploadUrl: '/api/v1/attendance/upload-photo',
    photoObjectKey,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    fields: {
      photoObjectKey,
      token,
    },
  };
}

/**
 * Generates a signed download URL (7 days expiration) for private attendance photos.
 */
export function generateSignedDownloadUrl(photoObjectKey: string, userId?: string): string {
  const token = jwt.sign(
    {
      photoObjectKey,
      userId,
      purpose: 'ATTENDANCE_PHOTO_VIEW',
    },
    STORAGE_SECRET,
    { expiresIn: '7d' }
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
