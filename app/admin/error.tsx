'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Errors that usually mean the browser is on a stale build after a deploy. */
function isStaleDeployError(error: Error): boolean {
  const name = error.name || '';
  const message = error.message || '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to load chunk/i.test(message) ||
    /Cannot find module/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /router state header/i.test(message)
  );
}

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error);
    // After a deploy, soft navigations / refreshes can request stale JS chunks.
    // A full reload picks up the new build instead of leaving staff on this screen.
    if (isStaleDeployError(error) && typeof window !== 'undefined') {
      const key = 'gobaskit_admin_chunk_reload';
      const last = Number(sessionStorage.getItem(key) || '0');
      if (Date.now() - last > 15_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900">This admin page could not load</h2>
        <p className="text-sm text-gray-500">
          This often happens right after a site update. Use Reload page once — that usually
          clears it. If it continues, open another tab from the menu.
        </p>
        {(error.message || error.digest) && (
          <p className="text-[11px] text-gray-400 break-all px-2">
            {error.name ? `${error.name}: ` : ''}
            {error.message || 'Unknown error'}
            {error.digest ? ` (${error.digest})` : ''}
          </p>
        )}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            onClick={() => {
              reset();
              window.location.replace(window.location.pathname + window.location.search);
            }}
          >
            Reload page
          </Button>
          <Button variant="secondary" onClick={() => { window.location.href = '/admin/dashboard'; }}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
