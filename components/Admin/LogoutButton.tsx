'use client';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await Promise.all([
          fetch('/api/auth/login', { method: 'DELETE' }),
          fetch('/api/auth/staff-login', { method: 'DELETE' }),
        ]);
        window.location.href = '/';
      }}
      className="text-sm text-red-500 hover:text-red-600 px-3 py-2"
    >
      Logout
    </button>
  );
}
