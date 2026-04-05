import { NextResponse } from 'next/server';
import { isPersistenceConfigured } from '@/lib/server/env';
import { getAiStatus } from '@/lib/server/gemini-settings';

export async function GET() {
  const aiStatus = await getAiStatus();
  return NextResponse.json({
    ok: true,
    aiConfigured: aiStatus.configured,
    aiSource: aiStatus.source,
    aiModel: aiStatus.model,
    persistenceConfigured: isPersistenceConfigured()
  });
}
