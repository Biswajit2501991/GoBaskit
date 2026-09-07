'use client';

import { logoutEverywhere } from '@/utils/logoutEverywhere';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        void logoutEverywhere('/');
      }}
      className="w-full text-left text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl px-3 py-2"
    >
      Logout
    </button>
  );
}
