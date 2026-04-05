import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000';
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

export async function getClientIpFromHeaders() {
  const headerStore = await headers();
  return headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip');
}

export function assertSameOriginMutation(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');

  if (originHeader) {
    if (originHeader !== requestOrigin) {
      throw new Error('Cross-site request was rejected.');
    }
    return;
  }

  if (refererHeader) {
    const refererOrigin = new URL(refererHeader).origin;
    if (refererOrigin !== requestOrigin) {
      throw new Error('Cross-site request was rejected.');
    }
    return;
  }

  throw new Error('Origin header is required.');
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
