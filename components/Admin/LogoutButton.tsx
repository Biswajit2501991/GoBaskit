'use client';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/auth/staff-login', { method: 'DELETE' }).catch(() => null);
        window.location.href = '/';
      }}
      className="text-sm text-red-500 hover:text-red-600 px-3 py-2"
    >
      Logout
    </button>
  );
}
