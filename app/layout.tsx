import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')),
  title: 'WINTER SHOWDOWN 2026 | TrIvanta 6-a-Side Futsal Tournament',
  description: 'Live scores, fixtures, standings, knockout bracket and stats — Winter Showdown 2026 by TrIvanta Events, 13 Nov 2026 at OFFSIDE – Home of Football, Mirpur.',
  icons: { icon: '/brand/favicon.png', apple: '/brand/favicon.png' },
  openGraph: { title: 'Winter Showdown 2026 — Live', description: 'Live scores, standings and stats', images: ['/brand/hero-bg.jpg'] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, themeColor: '#050B1E' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,600;0,700;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Russo+One&family=Teko:wght@600;700&family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
