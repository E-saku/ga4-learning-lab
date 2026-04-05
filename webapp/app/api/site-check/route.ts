import { siteCheckRequestSchema } from '@/lib/ga4/schemas';
import { createHourlyWindowKey, incrementRateLimit } from '@/lib/server/rate-limit';
import { auditPublicSite } from '@/lib/server/site-check';
import { assertSameOriginMutation, getClientIpFromHeaders, jsonError } from '@/lib/server/http';
import { coerceClientIp } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const payload = siteCheckRequestSchema.parse(await request.json());
    const clientIp = coerceClientIp(await getClientIpFromHeaders());
    const rateLimit = await incrementRateLimit({
      scope: 'site-check',
      identifier: clientIp,
      windowKey: createHourlyWindowKey(),
      limit: 20
    });

    if (rateLimit.limited) {
      return jsonError('サイト確認の回数が上限に達しました。1時間ほど空けて再度お試しください。', 429);
    }

    const result = await auditPublicSite(payload.siteUrl);
    return Response.json({
      ok: true,
      result
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}
