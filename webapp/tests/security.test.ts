import { describe, expect, it } from 'vitest';
import {
  createId,
  createWorkspaceExpiryDate,
  createWorkspaceToken,
  hashWorkspaceToken,
  sanitizeFileName
} from '@/lib/server/security';

describe('security helpers', () => {
  it('creates stable token hashes and non-empty random tokens', () => {
    const token = createWorkspaceToken();
    const hashA = hashWorkspaceToken(token, 'secret');
    const hashB = hashWorkspaceToken(token, 'secret');

    expect(token.length).toBeGreaterThan(20);
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashWorkspaceToken(token, 'other-secret'));
  });

  it('creates ids, future expiry dates and sanitized filenames', () => {
    expect(createId('ws')).toMatch(/^ws_/);
    expect(createWorkspaceExpiryDate().getTime()).toBeGreaterThan(Date.now());
    expect(sanitizeFileName('日本語 csv (draft).csv')).toContain('csv');
  });
});
