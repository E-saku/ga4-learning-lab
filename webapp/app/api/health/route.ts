import { NextResponse } from 'next/server';
import { isAiConfigured, isPersistenceConfigured } from '@/lib/server/env';

export async function GET() {
  return NextResponse.json({
    ok: true,
    aiConfigured: isAiConfigured(),
    persistenceConfigured: isPersistenceConfigured()
  });
}
