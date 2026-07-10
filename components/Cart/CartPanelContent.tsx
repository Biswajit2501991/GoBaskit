'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import CouponSection from '@/components/Cart/CouponSection';
import CancellationPolicyCard from '@/components/Cart/CancellationPolicyCard';
import DeliveryEtaButton from '@/components/Header/DeliveryEtaButton';
import { useCartStore, itemLineKey } from '@/store/cartStore';
import { useConfigStore } from '@/store/configStore';
import { useDiscountStore } from '@/store/discountStore';
import { deliveryChargeFrom } from '@/constants';
import { formatCurrency } from '@/utils/formatter';
import { getListPrice } from '@/utils/pricing';
import { resolvePublicImageUrl } from '@/utils/image';
import { Button } from '@/components/ui/button';

type CartPanelContentProps = {
  /** Called when user continues shopping (drawer close) or after navigating away. */
  onContinueShopping?: () => void;
  /** Called before navigating to checkout (e.g. close drawer). */
  onBeforeCheckout?: () => void;
  /** Hide the sticky footer CTAs when the parent provides its own. */
  showFooterActions?: boolean;
  className?: string;
};

export default function CartPanelContent({
  onContinueShopping,
  onBeforeCheckout,
  showFooterActions = true,
  className = '',
}: CartPanelContentProps) {
  const { items, updateQuantity, removeItem, clearCart, getSubtotal } = useCartStore();
  const { deliverySlabs, minOrderValue, homepageConfig, fetchConfig } = useConfigStore();
  const appliedDiscount = useDiscountStore((s) => s.applied);
  const clearDiscount = useDiscountStore((s) => s.clear);
  const imageFetchAttempted = useRef(new Set<string>());

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const subtotal = getSubtotal();
  const deliveryCharge = deliveryChargeFrom(deliverySlabs, subtotal);
  const discountAmount =
    appliedDiscount && Math.abs(appliedDiscount.quotedSubtotal - subtotal) <= 0.05
      ? appliedDiscount.discountAmount
      : 0;
  const grandTotal = Math.max(0, subtotal - discountAmount + deliveryCharge);
  const belowMinimum = minOrderValue > 0 && subtotal < minOrderValue;
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  useEffect(() => {
    const missing = items.filter(
      (i) => !i.imageUrl && !imageFetchAttempted.current.has(i.productId),
    );
    if (missing.length === 0) return;

    missing.forEach((i) => imageFetchAttempted.current.add(i.productId));

    Promise.all(
      missing.map(async (item) => {
        try {
          const res = await fetch(`/api/products/${item.productId}`);
          if (!res.ok) return null;
          const product = await res.json();
          return product.imageUrl
            ? { productId: item.productId, imageUrl: product.imageUrl as string }
            : null;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      const updates = results.filter(Boolean) as { productId: string; imageUrl: string }[];
      if (updates.length === 0) return;
      useCartStore.setState((state) => ({
        items: state.items.map((i) => {
          const patch = updates.find((u) => u.productId === i.productId);
          return patch ? { ...i, imageUrl: patch.imageUrl } : i;
        }),
      }));
    });
  }, [items]);

  function handleClearCart() {
    clearCart();
    clearDiscount();
  }

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-[#f4f6fb]">
        <div className="space-y-1">
          <DeliveryEtaButton variant="card" />
          <p className="text-[11px] text-gray-500 px-1">
            Shipment of {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-50">
            <p className="text-sm font-bold text-gray-900">Items in cart</p>
            <button
              type="button"
              onClick={handleClearCart}
              className="text-xs font-semibold text-red-500 hover:text-red-600"
            >
              Clear all
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {items.map((item) => (
              <div key={itemLineKey(item)} className="p-3.5 flex gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100 overflow-hidden flex-shrink-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolvePublicImageUrl(item.imageUrl)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-lg font-bold text-blinkit-green">
                        {item.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">{item.name}</h3>
                  {item.variantLabel ? (
                    <p className="text-xs text-blinkit-green font-medium truncate">
                      {item.variantLabel}
                    </p>
                  ) : null}
                  <p className="text-xs text-gray-400">{item.unit}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <p className="font-bold text-sm">{formatCurrency(item.price)}</p>
                    {getListPrice(item.mrp ?? null, item.price) ? (
                      <p className="text-[11px] text-gray-400 line-through">
                        {formatCurrency(getListPrice(item.mrp ?? null, item.price)!)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => removeItem(itemLineKey(item))}
                    className="text-[11px] text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                  <div className="flex items-center bg-blinkit-green rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateQuantity(itemLineKey(item), item.quantity - 1)}
                      className="w-7 h-7 text-white font-bold"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="text-white font-bold text-sm w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(itemLineKey(item), item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="w-7 h-7 text-white font-bold disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <CouponSection subtotal={subtotal} />

        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm shadow-sm">
          <h3 className="font-bold text-sm text-gray-900 mb-1">Bill details</h3>
          <div className="flex justify-between">
            <span className="text-gray-500">Items total</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-blinkit-green">
              <span>
                Discount
                {appliedDiscount?.type === 'COUPON' && appliedDiscount.couponCode
                  ? ` (${appliedDiscount.couponCode})`
                  : appliedDiscount?.type === 'MEMBERSHIP'
                    ? ' (Membership)'
                    : ''}
              </span>
              <span className="font-medium">−{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Delivery charge</span>
            <span className="font-medium">{formatCurrency(deliveryCharge)}</span>
          </div>
          <div className="flex justify-between border-t border-dashed pt-2 font-bold text-base">
            <span>Grand total</span>
            <span className="text-blinkit-green">{formatCurrency(grandTotal)}</span>
          </div>
          {belowMinimum && (
            <p className="text-amber-600 text-xs font-semibold">
              Add {formatCurrency(minOrderValue - subtotal)} more to meet minimum order of{' '}
              {formatCurrency(minOrderValue)}
            </p>
          )}
        </div>

        <CancellationPolicyCard text={homepageConfig.cancellationPolicy} />

        {/* Spacer so last card isn't hidden behind sticky footer + mobile browser chrome */}
        {showFooterActions ? <div className="h-6" aria-hidden /> : null}
      </div>

      {showFooterActions && (
        <div className="shrink-0 border-t border-gray-200 bg-white p-3 pb-mobile-chrome space-y-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
          {belowMinimum && (
            <p className="text-amber-600 text-[11px] font-semibold text-center">
              Add {formatCurrency(minOrderValue - subtotal)} more to checkout
            </p>
          )}
          <div className="flex gap-2">
            {onContinueShopping ? (
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onContinueShopping}
              >
                Continue Shopping
              </Button>
            ) : (
              <Button variant="secondary" asChild className="flex-1">
                <Link href="/">Continue Shopping</Link>
              </Button>
            )}
            <Button
              asChild
              className="flex-[1.2]"
              disabled={belowMinimum}
            >
              <Link
                href="/checkout"
                onClick={() => onBeforeCheckout?.()}
                aria-disabled={belowMinimum}
                className={belowMinimum ? 'pointer-events-none opacity-60' : undefined}
              >
                <span className="flex w-full items-center justify-between gap-2 px-0.5">
                  <span className="font-bold">{formatCurrency(grandTotal)}</span>
                  <span>Checkout →</span>
                </span>
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
