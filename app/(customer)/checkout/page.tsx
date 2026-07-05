'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Header from '@/components/Header/Header';
import { useCartStore } from '@/store/cartStore';
import { useConfigStore } from '@/store/configStore';
import { useLocationStore } from '@/store/locationStore';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import { deliveryChargeFrom, pinIsServiceable } from '@/constants';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { checkoutSchema, type CheckoutSchema } from '@/lib/validations';
import { buildWhatsAppMessage, buildWhatsAppUrl, openWhatsAppUrl } from '@/utils/whatsapp';
import { formatCurrency } from '@/utils/formatter';
import { WHATSAPP_NUMBER, STORE_NAME } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useCartHydrated();
  const { items, getSubtotal, clearCart } = useCartStore();
  const { serviceablePins, serviceableCities, deliverySlabs, minOrderValue, fetchConfig } = useConfigStore();

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const subtotal = getSubtotal();
  const deliveryCharge = deliveryChargeFrom(deliverySlabs, subtotal);
  const grandTotal = subtotal + deliveryCharge;
  const belowMinimum = minOrderValue > 0 && subtotal < minOrderValue;

  const locationPin = useLocationStore((s) => s.pin);
  const locationCity = useLocationStore((s) => s.city);
  const checkedMobile = useStaffPortalStore((s) => s.checkedMobile);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutSchema>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      paymentMethod: 'COD',
      alternateMobile: '',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '',
    },
  });

  // Prefill the pincode from the delivery location the customer picked in the header.
  useEffect(() => {
    if (locationPin && !getValues('pincode')) {
      setValue('pincode', locationPin, { shouldValidate: true });
    }
  }, [locationPin, getValues, setValue]);

  useEffect(() => {
    if (locationCity && !getValues('city')) {
      setValue('city', locationCity, { shouldValidate: true });
    }
  }, [locationCity, getValues, setValue]);

  const formValues = watch();
  const pincodeValue = formValues.pincode ?? '';
  const pinChecked = /^\d{6}$/.test(pincodeValue);
  const pinServiceable = pinChecked ? pinIsServiceable(serviceablePins, pincodeValue) : null;
  const cityValue = (formValues.city ?? '').trim();
  const cityServiceable = cityValue
    ? serviceableCities.some((city) => city.toLowerCase() === cityValue.toLowerCase())
    : null;
  const enteredMobile = (formValues.mobile ?? '').trim();
  const isWhatsAppPatternValid = /^\d{10}$/.test(enteredMobile);
  const [whatsAppConfirmed, setWhatsAppConfirmed] = useState(false);

  useEffect(() => {
    if (checkedMobile && !getValues('mobile')) {
      setValue('mobile', checkedMobile, { shouldValidate: true });
    }
  }, [checkedMobile, getValues, setValue]);

  useEffect(() => {
    setWhatsAppConfirmed(false);
  }, [enteredMobile]);

  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) router.replace('/cart');
  }, [items, router, hydrated]);

  const whatsappMessage = useMemo(() => {
    if (!formValues.firstName || !formValues.mobile) return '';
    return buildWhatsAppMessage({
      items,
      customer: formValues,
      subtotal,
      deliveryCharge,
      grandTotal,
      storeName: STORE_NAME,
    });
  }, [items, formValues, subtotal, deliveryCharge, grandTotal]);

  async function onSubmit(data: CheckoutSchema) {
    if (belowMinimum) return;
    if (!pinIsServiceable(serviceablePins, data.pincode)) return;
    if (!serviceableCities.some((city) => city.toLowerCase() === data.city.trim().toLowerCase())) return;

    const message = buildWhatsAppMessage({
      items,
      customer: data,
      subtotal,
      deliveryCharge,
      grandTotal,
      storeName: STORE_NAME,
    });
    const url = buildWhatsAppUrl(WHATSAPP_NUMBER, message);

    // Open WhatsApp immediately (before await) so the browser keeps the click gesture.
    openWhatsAppUrl(url);

    try {
      await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: data,
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            unit: i.unit,
          })),
          paymentMethod: data.paymentMethod,
        }),
      });
    } catch {
      // Order already opened in WhatsApp; DB save is best-effort
    }

    clearCart();
    router.push('/success');
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showSearch={false} />
        <div className="max-w-lg mx-auto p-4 space-y-4 mt-4">
          <div className="h-8 w-32 skeleton rounded" />
          <div className="h-64 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-28 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/cart" className="text-gray-400 hover:text-gray-600">←</Link>
          <h2 className="text-lg font-bold">Checkout</h2>
        </div>

        {belowMinimum && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            Minimum order is {formatCurrency(minOrderValue)}. Add {formatCurrency(minOrderValue - subtotal)} more from the store.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <h3 className="font-bold text-sm">Customer Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input {...register('firstName')} placeholder="John" className="mt-1" />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input {...register('lastName')} placeholder="Smith" className="mt-1" />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>
            <div>
              <Label>WhatsApp Number *</Label>
              <Input {...register('mobile')} placeholder="10-digit WhatsApp number" maxLength={10} inputMode="numeric" className="mt-1" />
              <p className="text-[11px] text-gray-400 mt-1">We&apos;ll confirm your order on this WhatsApp number.</p>
              {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile.message}</p>}
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={whatsAppConfirmed}
                onChange={(e) => setWhatsAppConfirmed(e.target.checked)}
                className="mt-0.5 accent-blinkit-green"
              />
              <span>
                I confirm {enteredMobile ? `+91 ${enteredMobile}` : 'this number'} is active on WhatsApp.
              </span>
            </label>
            <div>
              <Label>Alternate Mobile</Label>
              <Input {...register('alternateMobile')} placeholder="Optional" maxLength={10} inputMode="numeric" className="mt-1" />
              {errors.alternateMobile && <p className="text-red-500 text-xs mt-1">{errors.alternateMobile.message}</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <h3 className="font-bold text-sm">Delivery Address</h3>
            <div>
              <Label>House / Flat No. *</Label>
              <Input {...register('houseNumber')} className="mt-1" />
              {errors.houseNumber && <p className="text-red-500 text-xs mt-1">{errors.houseNumber.message}</p>}
            </div>
            <div>
              <Label>Street *</Label>
              <Input {...register('street')} className="mt-1" />
              {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street.message}</p>}
            </div>
            <div>
              <Label>Area *</Label>
              <Input {...register('area')} className="mt-1" />
              {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
            </div>
            <div>
              <Label>Landmark</Label>
              <Input {...register('landmark')} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City *</Label>
                <Input {...register('city')} className="mt-1" />
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
              {!errors.city && cityServiceable === false && (
                <p className="text-red-500 text-xs mt-1">We currently deliver to: {serviceableCities.join(', ')}.</p>
              )}
              {!errors.city && cityServiceable === true && (
                <p className="text-green-600 text-xs mt-1">✓ City is serviceable.</p>
              )}
              </div>
              <div>
                <Label>State *</Label>
                <Input {...register('state')} className="mt-1" />
                {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
              </div>
            </div>
            <div>
              <Label>Pincode *</Label>
              <Input {...register('pincode')} maxLength={6} inputMode="numeric" className="mt-1" />
              {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode.message}</p>}
              {!errors.pincode && pinServiceable === true && (
                <p className="text-green-600 text-xs mt-1">✓ Great! We deliver to your area.</p>
              )}
              {!errors.pincode && pinServiceable === false && (
                <p className="text-red-500 text-xs mt-1">
                  Sorry, delivery is unavailable at {pincodeValue}. We currently serve: {serviceablePins.join(', ')}.
                </p>
              )}
            </div>
            <div>
              <Label>Delivery Notes</Label>
              <Input {...register('deliveryNotes')} placeholder="Optional instructions" className="mt-1" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <h3 className="font-bold text-sm">Payment Method</h3>
            <label className="flex items-center gap-3 p-3 border-2 border-blinkit-green bg-blinkit-green-light rounded-xl cursor-pointer">
              <input type="radio" value="COD" {...register('paymentMethod')} className="accent-blinkit-green" />
              <div>
                <p className="font-bold text-sm">Cash On Delivery</p>
                <p className="text-xs text-gray-500">Pay when order arrives</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-blinkit-green">
              <input type="radio" value="QR_ON_DELIVERY" {...register('paymentMethod')} className="accent-blinkit-green" />
              <div>
                <p className="font-bold text-sm">QR Payment on Delivery</p>
                <p className="text-xs text-gray-500">Scan & pay at doorstep</p>
              </div>
            </label>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span>{formatCurrency(deliveryCharge)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-dashed pt-2">
              <span>Total</span><span className="text-blinkit-green">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {whatsappMessage && (
            <details className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-xs">
              <summary className="font-semibold cursor-pointer text-gray-600">Preview WhatsApp Message</summary>
              <pre className="mt-2 whitespace-pre-wrap text-gray-700 font-mono text-[11px]">{whatsappMessage}</pre>
            </details>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={
              belowMinimum ||
              isSubmitting ||
              pinServiceable === false ||
              cityServiceable === false ||
              !isWhatsAppPatternValid ||
              !whatsAppConfirmed
            }
          >
            {isSubmitting
              ? 'Placing Order...'
              : pinServiceable === false
                ? 'Delivery unavailable at this PIN'
                : !isWhatsAppPatternValid
                  ? 'Enter valid WhatsApp number'
                  : !whatsAppConfirmed
                    ? 'Confirm WhatsApp number'
                : 'Place Order via WhatsApp'}
          </Button>
        </form>
      </main>
    </div>
  );
}
