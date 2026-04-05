import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ALLOWED_GEMINI_MODELS,
  clearGeminiSettingsCookie,
  resolveGeminiModel,
  saveGeminiSettingsToCookie
} from '@/lib/server/gemini-settings';
import { getServerEnv } from '@/lib/server/env';
import { assertSameOriginMutation, jsonError } from '@/lib/server/http';

const geminiSettingsSchema = z.object({
  apiKey: z.string().trim().min(10).max(2048),
  model: z.enum(ALLOWED_GEMINI_MODELS).default('gemini-2.5-flash')
});

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const payload = geminiSettingsSchema.parse(await request.json());
    await saveGeminiSettingsToCookie(payload);

    return NextResponse.json({
      ok: true,
      status: {
        configured: true,
        source: 'cookie',
        model: payload.model
      }
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOriginMutation(request);
    await clearGeminiSettingsCookie();
    const env = getServerEnv();
    const hasEnv = Boolean(env.GEMINI_API_KEY);

    return NextResponse.json({
      ok: true,
      status: {
        configured: hasEnv,
        source: hasEnv ? 'env' : 'none',
        model: hasEnv ? resolveGeminiModel(env.GEMINI_MODEL) : null
      }
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}
