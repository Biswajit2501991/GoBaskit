'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLocationStore } from '@/store/locationStore';
import { useConfigStore } from '@/store/configStore';
import { pinIsServiceable } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DeliveryEtaButton from '@/components/Header/DeliveryEtaButton';

export default function LocationBar() {
  const { pin, city, setPin, setCity } = useLocationStore();
  const { serviceablePins, serviceableCities, fetchConfig } = useConfigStore();
  const [open, setOpen] = useState(false);
  const [draftPin, setDraftPin] = useState('');
  const [draftCity, setDraftCity] = useState('');
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
    const p = draftPin.trim();
    const c = draftCity.trim();

    if (!p && !c) {
      setError('Enter your 6-digit PIN code or city.');
      return;
    }

    if (p) {
      if (!/^\d{6}$/.test(p)) {
        setError('Enter a valid 6-digit PIN code.');
        return;
      }
      if (!pinIsServiceable(serviceablePins, p)) {
        setError("We're not delivering to your location just yet — we're expanding fast, so please check back soon!");
        return;
      }
      setPin(p);
    }

    if (c) {
      const matched = serviceableCities.some((cityOption) => cityOption.toLowerCase() === c.toLowerCase());
      if (!matched) {
        setError("We're not delivering to your location just yet — we're expanding fast, so please check back soon!");
        return;
      }
      setCity(c);
    }
    setError('');
    setOpen(false);
  }

  const label = pin ? `Delivering to ${pin}` : city ? `Delivering to ${city}` : 'Select delivery location';

  return (
    <div className="relative" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 border-b border-gray-100">
        <div className="pr-2 mr-1 border-r border-gray-200 shrink-0">
          <DeliveryEtaButton variant="inline" className="text-[11px] font-bold text-gray-800 max-w-[9.5rem] sm:max-w-none" />
        </div>
        <button
          type="button"
          onClick={() => {
            setDraftPin(pin);
            setDraftCity(city);
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
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-[min(20rem,calc(100vw-2rem))] bg-white rounded-xl border border-gray-200 shadow-lg p-4 space-y-3">
          <p className="text-sm font-bold text-gray-900">Set your delivery location</p>
          <p className="text-xs text-gray-500">Enter your PIN code or your city to check availability.</p>
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={draftPin}
              maxLength={6}
              inputMode="numeric"
              placeholder="6-digit PIN"
              onChange={(e) => {
                setDraftPin(e.target.value.replace(/\D/g, ''));
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
          <Input
            value={draftCity}
            placeholder="Or your city"
            onChange={(e) => {
              setDraftCity(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
              }
            }}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
