import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { AiStatus } from '@/lib/ga4/types';
import { getServerEnv } from '@/lib/server/env';

const GEMINI_COOKIE_NAME = 'ga4_lab_gemini';
const GEMINI_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const ALLOWED_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const;
const DEFAULT_GEMINI_MODEL = ALLOWED_GEMINI_MODELS[0];

type StoredGeminiSettings = {
  apiKey: string;
  model: string;
};

export type RuntimeAiSettings = StoredGeminiSettings & {
  source: 'cookie' | 'env';
};

export async function getAiStatus(): Promise<AiStatus> {
  const settings = await getRuntimeAiSettings();
  return {
    configured: Boolean(settings),
    source: settings?.source ?? 'none',
    model: settings?.model ?? null
  };
}

export async function getRuntimeAiSettings(): Promise<RuntimeAiSettings | null> {
  const cookieSettings = await readGeminiSettingsFromCookie();
  if (cookieSettings) {
    return {
      ...cookieSettings,
      source: 'cookie'
    };
  }

  const env = getServerEnv();
  if (env.GEMINI_API_KEY) {
    return {
      apiKey: env.GEMINI_API_KEY,
      model: resolveGeminiModel(env.GEMINI_MODEL),
      source: 'env'
    };
  }

  return null;
}

export async function saveGeminiSettingsToCookie(input: StoredGeminiSettings) {
  const secret = getCookieSecret();
  if (!secret) {
    throw new Error('Gemini キーの暗号化には WORKSPACE_TOKEN_SECRET が必要です。');
  }

  const cookieStore = await cookies();
  cookieStore.set(
    GEMINI_COOKIE_NAME,
    encryptGeminiSettings(
      {
        ...input,
        model: resolveGeminiModel(input.model)
      },
      secret
    ),
    {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GEMINI_COOKIE_MAX_AGE
    }
  );
}

export async function clearGeminiSettingsCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(GEMINI_COOKIE_NAME);
}

export function encryptGeminiSettings(input: StoredGeminiSettings, secret: string) {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(secret).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(input), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    data: encrypted.toString('base64url')
  });
}

export function decryptGeminiSettings(value: string, secret: string): StoredGeminiSettings | null {
  try {
    const payload = JSON.parse(value) as {
      iv: string;
      tag: string;
      data: string;
    };
    const key = createHash('sha256').update(secret).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64url')),
      decipher.final()
    ]);
    const parsed = JSON.parse(decrypted.toString('utf8')) as StoredGeminiSettings;

    if (!parsed.apiKey || !parsed.model) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function readGeminiSettingsFromCookie() {
  const secret = getCookieSecret();
  if (!secret) return null;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(GEMINI_COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  return decryptGeminiSettings(cookieValue, secret);
}

function getCookieSecret() {
  return getServerEnv().WORKSPACE_TOKEN_SECRET ?? null;
}

export function isAllowedGeminiModel(model: string) {
  return ALLOWED_GEMINI_MODELS.includes(model as (typeof ALLOWED_GEMINI_MODELS)[number]);
}

export function resolveGeminiModel(model: string | null | undefined) {
  if (model && isAllowedGeminiModel(model)) {
    return model;
  }

  return DEFAULT_GEMINI_MODEL;
}
