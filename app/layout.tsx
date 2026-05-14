import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '600', '800'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'The Rhyme Game',
  description: 'A web game for freestyle rap practice',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
