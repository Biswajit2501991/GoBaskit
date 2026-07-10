'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markOrderCelebration } from '@/components/Cart/OrderCelebration';

/**
 * Legacy /success deep links still work: soft-redirect home and show celebration.
 */
export default function SuccessPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const orderNumber = sessionStorage.getItem('gobaskit_last_order_number');
      markOrderCelebration(orderNumber ?? undefined);
    } catch {
      markOrderCelebration();
    }
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Taking you home…</p>
    </div>
  );
}
