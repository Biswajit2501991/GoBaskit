'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, ChevronDown, Clock } from 'lucide-react';
import { useLocationStore } from '@/store/locationStore';
import { useConfigStore } from '@/store/configStore';
import { pinIsServiceable } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LocationBar() {
  const { pin, setPin } = useLocationStore();
  const { serviceablePins, fetchConfig } = useConfigStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function confirm() {
    const p = draft.trim();
    if (!/^\d{6}$/.test(p)) {
      setError('Enter a valid 6-digit PIN code.');
      return;
    }
    if (!pinIsServiceable(serviceablePins, p)) {
      setError(`We don't deliver to ${p} yet. We serve: ${serviceablePins.join(', ')}.`);
      return;
    }
    setPin(p);
    setError('');
    setOpen(false);
  }

  const label = pin ? `Delivering to ${pin}` : 'Select delivery location';

  return (
    <div className="relative" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 border-b border-gray-100">
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-gray-800 pr-2 mr-1 border-r border-gray-200">
          <Clock className="w-3.5 h-3.5 text-blinkit-green" />
          <span>
            Delivery in <span className="text-blinkit-green">15 mins</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(pin);
            setError('');
            setOpen((v) => !v);
          }}
          className="flex items-center gap-1.5 min-w-0 group"
        >
          <MapPin className="w-4 h-4 text-blinkit-green flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900 truncate group-hover:text-blinkit-green">{label}</span>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
      </div>

      {open && (
        <div className="absolute left-4 top-full mt-1 z-50 w-[280px] bg-white rounded-xl border border-gray-200 shadow-lg p-4 space-y-3">
          <p className="text-sm font-bold text-gray-900">Set your delivery location</p>
          <p className="text-xs text-gray-500">Enter your PIN code to check availability.</p>
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={draft}
              maxLength={6}
              inputMode="numeric"
              placeholder="6-digit PIN"
              onChange={(e) => {
                setDraft(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirm();
                }
              }}
            />
            <Button type="button" size="sm" onClick={confirm}>
              Apply
            </Button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-[11px] text-gray-400">Currently serving: {serviceablePins.join(', ')}</p>
        </div>
      )}
    </div>
  );
}
