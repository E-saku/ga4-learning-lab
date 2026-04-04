import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WorkspaceClient } from '@/components/workspace-client';
import { getRequestOrigin } from '@/lib/server/http';
import { getWorkspaceView } from '@/lib/server/workspaces';

type WorkspacePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: {
      index: false,
      follow: false
    }
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { token } = await params;
  const origin = await getRequestOrigin();
  const workspace = await getWorkspaceView(token, origin);

  if (!workspace) {
    notFound();
  }

  return <WorkspaceClient initialView={workspace} workspaceToken={token} />;
}
