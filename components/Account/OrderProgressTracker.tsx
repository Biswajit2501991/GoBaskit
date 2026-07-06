'use client';

import type { OrderStatus } from '@prisma/client';
import { Check, Package, ShoppingBag, Truck, XCircle } from 'lucide-react';
import { TRACKING_STEPS, getTrackingHeadline, getTrackingStepIndex } from '@/utils/orderTracking';

export default function OrderProgressTracker({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-red-800">Order cancelled</h2>
        <p className="text-sm text-red-600 mt-1">This order was cancelled and will not be delivered.</p>
      </div>
    );
  }

  const currentStep = getTrackingStepIndex(status);
  const icons = [ShoppingBag, Package, Truck, Check];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-gray-500">Order status</p>
        <h2 className="text-xl font-bold text-gray-900 mt-1">{getTrackingHeadline(status)}</h2>
      </div>

      <div className="relative px-2">
        <div className="absolute left-8 right-8 top-5 h-0.5 bg-gray-200" aria-hidden />
        <div
          className="absolute left-8 top-5 h-0.5 bg-blinkit-green transition-all duration-500"
          style={{
            width:
              status === 'DELIVERED'
                ? 'calc(100% - 4rem)'
                : currentStep <= 0
                  ? '0%'
                  : `calc(${(currentStep / (TRACKING_STEPS.length - 1)) * 100}% - 4rem)`,
            maxWidth: 'calc(100% - 4rem)',
          }}
          aria-hidden
        />

        <ol className="relative grid grid-cols-4 gap-2">
          {TRACKING_STEPS.map((step, index) => {
            const Icon = icons[index];
            const done = status === 'DELIVERED' ? true : index < currentStep;
            const active = status !== 'DELIVERED' && index === currentStep;
            const upcoming = !done && !active;

            return (
              <li key={step.id} className="flex flex-col items-center text-center">
                <div
                  className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    done
                      ? 'border-blinkit-green bg-blinkit-green text-white'
                      : active
                        ? 'border-blinkit-green bg-white text-blinkit-green ring-4 ring-blinkit-green/20'
                        : 'border-gray-200 bg-white text-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p
                  className={`mt-2 text-[11px] font-semibold leading-tight ${
                    upcoming ? 'text-gray-400' : active ? 'text-blinkit-green' : 'text-gray-800'
                  }`}
                >
                  {step.label}
                </p>
                {active && (
                  <p className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">{step.description}</p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {status === 'DELIVERED' && (
        <p className="text-center text-sm text-blinkit-green font-medium">Item has been delivered. Thank you for shopping with GoBaskit!</p>
      )}
    </div>
  );
}
