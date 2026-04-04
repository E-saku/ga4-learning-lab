import { createHash, randomBytes, randomUUID } from 'node:crypto';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function createWorkspaceToken(): string {
  return randomBytes(24).toString('base64url');
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export function hashWorkspaceToken(token: string, secret: string): string {
  return createHash('sha256').update(`${token}:${secret}`).digest('hex');
}

export function createWorkspaceExpiryDate(): Date {
  return new Date(Date.now() + THIRTY_DAYS_MS);
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function makeShareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/w/${token}`;
}

export function coerceClientIp(raw: string | null): string {
  if (!raw) return 'unknown';
  return raw.split(',')[0]?.trim() || 'unknown';
}
