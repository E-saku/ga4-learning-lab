import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'GA4 Learning Lab',
  description: 'GA4のCSVを読みながら、初心者向けに次に見るべきレポートを案内する保存可能なWebアプリ'
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
