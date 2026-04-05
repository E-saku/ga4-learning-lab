import { describe, expect, it } from 'vitest';
import {
  buildSiteCheckResult,
  isPublicIpAddress,
  normalizeSiteUrlInput
} from '@/lib/server/site-check';

describe('site check helpers', () => {
  it('normalizes bare domains to https urls', () => {
    expect(normalizeSiteUrlInput('example.com').toString()).toBe('https://example.com/');
    expect(normalizeSiteUrlInput('https://example.com/path').toString()).toBe(
      'https://example.com/path'
    );
  });

  it('rejects private, loopback and documentation ip ranges', () => {
    expect(isPublicIpAddress('8.8.8.8')).toBe(true);
    expect(isPublicIpAddress('10.0.0.1')).toBe(false);
    expect(isPublicIpAddress('127.0.0.1')).toBe(false);
    expect(isPublicIpAddress('192.168.1.10')).toBe(false);
    expect(isPublicIpAddress('192.0.2.10')).toBe(false);
    expect(isPublicIpAddress('198.51.100.10')).toBe(false);
    expect(isPublicIpAddress('203.0.113.10')).toBe(false);
    expect(isPublicIpAddress('::1')).toBe(false);
    expect(isPublicIpAddress('fc00::1')).toBe(false);
    expect(isPublicIpAddress('2001:4860:4860::8888')).toBe(true);
  });

  it('extracts measurement and page quality signals from html', () => {
    const html = `
      <html>
        <head>
          <title>Example Site</title>
          <meta name="description" content="Site description" />
          <meta name="robots" content="index,follow" />
          <link rel="canonical" href="https://example.com/" />
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST1234"></script>
          <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}</script>
        </head>
        <body>Hello</body>
      </html>
    `;

    const result = buildSiteCheckResult(
      new URL('https://example.com'),
      new URL('https://example.com'),
      200,
      html
    );

    expect(result.measurementIds).toEqual(['G-TEST1234']);
    expect(result.hasGtag).toBe(true);
    expect(result.hasDataLayer).toBe(true);
    expect(result.title).toBe('Example Site');
    expect(result.description).toBe('Site description');
    expect(result.canonicalUrl).toBe('https://example.com/');
    expect(result.findings.some((finding) => finding.title.includes('GA4 測定ID'))).toBe(true);
  });
});
