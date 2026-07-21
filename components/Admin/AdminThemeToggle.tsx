'use client';

import { useCallback, useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

export type AdminColorPreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'gobaskit_admin_color_mode';

function resolveMode(pref: AdminColorPreference): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyResolved(mode: 'light' | 'dark') {
  document.documentElement.dataset.adminTheme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function useAdminTheme() {
  const [preference, setPreferenceState] = useState<AdminColorPreference>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let initial: AdminColorPreference = 'system';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') initial = saved;
    } catch {
      /* ignore */
    }
    setPreferenceState(initial);
    const mode = resolveMode(initial);
    setResolved(mode);
    applyResolved(mode);
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const mode = resolveMode('system');
      setResolved(mode);
      applyResolved(mode);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.adminTheme;
      document.documentElement.style.removeProperty('color-scheme');
    };
  }, []);

  const setPreference = useCallback((next: AdminColorPreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    const mode = resolveMode(next);
    setResolved(mode);
    applyResolved(mode);
  }, []);

  return { preference, resolved, setPreference };
}

const OPTIONS: Array<{
  id: AdminColorPreference;
  label: string;
  icon: typeof Sun;
}> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export default function AdminThemeToggle() {
  const { preference, setPreference } = useAdminTheme();

  return (
    <div
      className="admin-theme-toggle inline-flex items-center rounded-full border border-gray-200 bg-gray-50/90 p-0.5 shadow-sm"
      role="group"
      aria-label="Color theme"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = preference === id;
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setPreference(id)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-all ${
              active
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        );
      })}
    </div>
  );
}
