'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900">This admin page could not load</h2>
        <p className="text-sm text-gray-500">
          The server hit an error while loading this section. Try again, or open another tab from the menu.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button onClick={reset}>Reload page</Button>
          <Button variant="secondary" onClick={() => { window.location.href = '/admin/dashboard'; }}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
