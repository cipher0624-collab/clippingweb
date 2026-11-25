'use client';

import Script from 'next/script';
import { useEffect } from 'react';

const id = process.env.NEXT_PUBLIC_ANALYTICS_ID;

declare global {
  interface Window { dataLayer: unknown[]; gtag: (...args: unknown[]) => void }
}

export default function Analytics() {
  useEffect(() => {
    if (!id) return;
    const send = (event: string) => window.gtag?.('event', event);
    const booking = () => { send('book_a_call_clicked'); send('booking_page_opened'); };
    const chat = () => send('chatbot_opened');
    window.addEventListener('booking-click', booking);
    window.addEventListener('chat-open', chat);
    const results = document.querySelector('#results');
    const observer = results ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { send('results_section_viewed'); observer?.disconnect(); }
    }, { threshold: 0.25 }) : null;
    if (results) observer?.observe(results);
    return () => { window.removeEventListener('booking-click', booking); window.removeEventListener('chat-open', chat); observer?.disconnect(); };
  }, []);

  if (!id) return null;
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
    <Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer = window.dataLayer || []; function gtag(){window.dataLayer.push(arguments);} window.gtag = gtag; gtag('js', new Date()); gtag('config', '${id}');`}</Script>
  </>;
}
