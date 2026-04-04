import { queryDb } from '@/lib/server/db';

type RateLimitInput = {
  scope: string;
  identifier: string;
  windowKey: string;
  limit: number;
};

export async function incrementRateLimit({
  scope,
  identifier,
  windowKey,
  limit
}: RateLimitInput) {
  const [row] = await queryDb<{ count: number }>`
    INSERT INTO rate_limit_counters (scope, identifier, window_key, count)
    VALUES (${scope}, ${identifier}, ${windowKey}, 1)
    ON CONFLICT (scope, identifier, window_key)
    DO UPDATE
    SET count = rate_limit_counters.count + 1,
        updated_at = now()
    RETURNING count
  `;

  return {
    count: row?.count ?? 1,
    limited: (row?.count ?? 1) > limit
  };
}

export function createHourlyWindowKey(date = new Date()) {
  return date.toISOString().slice(0, 13);
}

export function createDailyWindowKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
