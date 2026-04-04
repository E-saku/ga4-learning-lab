import { HomeClient } from '@/components/home-client';
import { isAiConfigured, isPersistenceConfigured } from '@/lib/server/env';

export default function HomePage() {
  return (
    <HomeClient
      initialHealth={{
        aiConfigured: isAiConfigured(),
        persistenceConfigured: isPersistenceConfigured()
      }}
    />
  );
}
