import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const manrope = Manrope({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '600', '800'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'The Rhyme Game',
  description: 'A web game for freestyle rap practice',
  icons: {
    icon: [
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/brand/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/brand/favicon-192.png' },
    ],
  },
  openGraph: {
    title: 'The Rhyme Game',
    description: 'A web game for freestyle rap practice',
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'rhymefor.fun' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
