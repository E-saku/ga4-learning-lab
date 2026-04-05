import { HomeClient } from '@/components/home-client';
import { isPersistenceConfigured } from '@/lib/server/env';
import { getAiStatus } from '@/lib/server/gemini-settings';

export default async function HomePage() {
  const aiStatus = await getAiStatus();

  return (
    <HomeClient
      initialHealth={{
        aiStatus,
        persistenceConfigured: isPersistenceConfigured()
      }}
    />
  );
}
