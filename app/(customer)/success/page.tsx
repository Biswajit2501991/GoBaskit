'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header/Header';
import { Button } from '@/components/ui/button';

export default function SuccessPage() {
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [orderSource, setOrderSource] = useState<'website' | 'whatsapp'>('whatsapp');

  useEffect(() => {
    try {
      const url = sessionStorage.getItem('gobaskit_last_whatsapp_url');
      if (url) setWhatsappUrl(url);
      const source = sessionStorage.getItem('gobaskit_last_order_source');
      if (source === 'website' || source === 'whatsapp') setOrderSource(source);
    } catch {
      /* ignore */
    }
  }, []);

  const isWebsite = orderSource === 'website';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-20 h-20 bg-blinkit-green-light rounded-full flex items-center justify-center mb-5">
          <svg className="w-10 h-10 text-blinkit-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {isWebsite ? 'Order placed successfully!' : 'Order sent on WhatsApp!'}
        </h1>
        <p className="text-gray-500 text-sm max-w-sm mb-6">
          {isWebsite
            ? 'Your order has been received. We will confirm shortly and deliver in ~15 minutes.'
            : 'Your order has been shared with GoBaskit. We will confirm shortly and deliver in ~15 minutes.'}
        </p>
        {!isWebsite && whatsappUrl && (
          <Button asChild variant="outline" className="mb-4">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              Open WhatsApp again
            </a>
          </Button>
        )}
        {isWebsite && (
          <Button asChild variant="outline" className="mb-4">
            <Link href="/account">Track my order</Link>
          </Button>
        )}
        <Button asChild><Link href="/">Continue Shopping</Link></Button>
      </main>
    </div>
  );
}
