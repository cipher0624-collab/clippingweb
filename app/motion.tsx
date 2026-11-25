'use client';

import { useEffect } from 'react';

export default function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('motion-ready');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return () => root.classList.remove('motion-ready');
    const items = document.querySelectorAll<HTMLElement>('.reveal, .reveal-stagger');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    items.forEach(item => observer.observe(item));
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        root.style.setProperty('--scroll-shift', `${Math.min(window.scrollY * 0.08, 42)}px`);
        queued = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); root.classList.remove('motion-ready'); };
  }, []);
  return null;
}
