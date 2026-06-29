import Link from 'next/link';
import Header from '@/components/Header/Header';
import { Button } from '@/components/ui/button';

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-20 h-20 bg-blinkit-green-light rounded-full flex items-center justify-center mb-5">
          <svg className="w-10 h-10 text-blinkit-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Order sent on WhatsApp!</h1>
        <p className="text-gray-500 text-sm max-w-sm mb-8">
          Your order has been shared with GoBaskit. We&apos;ll confirm shortly and deliver in ~15 minutes.
        </p>
        <Button asChild><Link href="/">Continue Shopping</Link></Button>
      </main>
    </div>
  );
}
