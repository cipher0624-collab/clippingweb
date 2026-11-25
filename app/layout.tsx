import type { Metadata } from 'next';
import './globals.css';
import Analytics from './analytics';
import Motion from './motion';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://clippingrewards.com'),
  title: 'Clipping Rewards | Short-Form Content & Clipping Agency',
  description: 'Turn podcasts, interviews, livestreams and long-form content into short-form videos built for TikTok, Instagram Reels and YouTube Shorts.',
  openGraph: { title: 'Clipping Rewards', description: 'Long-form stories. Short-form reach.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Clipping Rewards', description: 'Short-form content, built from your best long-form moments.' },
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Motion /><Analytics /></body></html>;
}
