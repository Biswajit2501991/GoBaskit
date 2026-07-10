'use client';

import { logoutEverywhere } from '@/utils/logoutEverywhere';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        void logoutEverywhere('/');
      }}
      className="text-sm text-red-500 hover:text-red-600 px-3 py-2"
    >
      Logout
    </button>
  );
}
