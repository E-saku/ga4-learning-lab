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

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
