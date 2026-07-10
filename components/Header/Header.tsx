'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, User, Shield, Heart } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { useCartUiStore } from '@/store/cartUiStore';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import { useWishlistStore } from '@/store/wishlistStore';
import LocationBar from '@/components/Header/LocationBar';
import DeliveryEtaButton from '@/components/Header/DeliveryEtaButton';
import GlobalSearch from '@/components/Header/GlobalSearch';
import AccountMobileModal from '@/components/Header/AccountMobileModal';
import StaffAdminLoginModal from '@/components/Header/StaffAdminLoginModal';
import RestockToastHost from '@/components/Header/RestockToastHost';
import CartDrawer from '@/components/Cart/CartDrawer';
import OrderCelebration from '@/components/Cart/OrderCelebration';
import { clearCheckoutProfileLocal } from '@/utils/customerProfile';
import { clearSessionVerifiedMobile, setSessionVerifiedMobile } from '@/utils/whatsappVerificationSession';
import { toE164 } from '@/utils/phone';
import { prefetchCheckoutProfile } from '@/utils/prefetchCheckoutProfile';

interface HeaderProps {
  /** Set false to hide the global product search (e.g. focused flows like checkout). */
  showSearch?: boolean;
}

export default function Header({ showSearch = true }: HeaderProps) {
  const hydrated = useCartHydrated();
  const itemCount = useCartStore((s) => s.getItemCount());
  const staffEligible = useStaffPortalStore((s) => s.staffEligible);
  const checkedMobile = useStaffPortalStore((s) => s.checkedMobile);
  const customerMobile = useStaffPortalStore((s) => s.customerMobile);
  const staffName = useStaffPortalStore((s) => s.staffName);
  const setCustomerMobile = useStaffPortalStore((s) => s.setCustomerMobile);
  const clearAccount = useStaffPortalStore((s) => s.clearAccount);
  const openAccountModal = useStaffPortalStore((s) => s.openAccountModal);
  const openAdminLoginModal = useStaffPortalStore((s) => s.openAdminLoginModal);
  const openCart = useCartUiStore((s) => s.openCart);
  const wishlistCount = useWishlistStore((s) => s.count);
  const loadWishlist = useWishlistStore((s) => s.load);
  const clearWishlist = useWishlistStore((s) => s.clear);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const accountLabel = staffEligible
    ? staffName || `Staff ${checkedMobile}`
    : customerMobile
      ? `+91 ${customerMobile}`
      : 'My Account';
  const hasAccountIdentity = staffEligible || Boolean(customerMobile);

  useEffect(() => {
    if (hasAccountIdentity) {
      // Already know the customer — warm checkout profile + wishlist in the background.
      void prefetchCheckoutProfile();
      void loadWishlist();
      return;
    }
    fetch('/api/customer/account')
      .then((res) => res.json())
      .then(async (data: { mobile?: string | null; isWhatsappVerified?: boolean }) => {
        if (data.mobile) {
          setCustomerMobile(data.mobile);
          if (data.isWhatsappVerified) {
            const e164 = toE164('91', data.mobile);
            if (e164) setSessionVerifiedMobile(e164);
          }
          // Prefetch profile so checkout autofills without waiting.
          void prefetchCheckoutProfile();
          void loadWishlist();
        }
      })
      .catch(() => null);
  }, [hasAccountIdentity, setCustomerMobile, loadWishlist]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [accountMenuOpen]);

  async function handleAccountClick() {
    if (hasAccountIdentity) {
      setAccountMenuOpen((prev) => !prev);
      return;
    }
    openAccountModal();
  }

  async function handleCustomerLogout() {
    await fetch('/api/customer/account', { method: 'DELETE' }).catch(() => null);
    clearCheckoutProfileLocal();
    clearSessionVerifiedMobile();
    clearWishlist();
    clearAccount();
    setAccountMenuOpen(false);
    // Always land on the GoBaskit home page after logging out, with a full
    // reload so all session state (cart badge, account, caches) resets cleanly.
    window.location.replace('/');
  }

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <AccountMobileModal />
      <StaffAdminLoginModal />
      <CartDrawer />
      <OrderCelebration />
      <RestockToastHost enabled={Boolean(customerMobile) && !staffEligible} />
      <div className="bg-blinkit-yellow">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="bg-white rounded-lg px-2.5 py-1 shadow-sm shrink-0">
              <span className="font-extrabold text-xl text-gray-900 tracking-tight">
                Go<span className="text-blinkit-green">Baskit</span>
              </span>
            </Link>
            {staffEligible && (
              <button
                type="button"
                onClick={openAdminLoginModal}
                className="hidden sm:inline-flex items-center gap-1 bg-gray-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-800 shrink-0"
              >
                <Shield className="w-3.5 h-3.5" />
                Login as Admin
              </button>
            )}
          </div>

          <div ref={actionsRef} className="relative flex items-center gap-2 shrink-0">
            {staffEligible && (
              <button
                type="button"
                onClick={openAdminLoginModal}
                className="sm:hidden inline-flex items-center gap-1 bg-gray-900 text-white text-[10px] font-semibold px-2 py-1 rounded-lg"
              >
                <Shield className="w-3 h-3" />
                Admin
              </button>
            )}

            {/* Desktop-only ETA chip; LocationBar already shows ETA on mobile */}
            <div className="hidden sm:block">
              <DeliveryEtaButton />
            </div>

            {/* Account sits immediately before cart */}
            <button
              type="button"
              onClick={handleAccountClick}
              className="hidden sm:inline-flex items-center gap-1.5 bg-white/80 hover:bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-800 transition-colors shadow-sm"
            >
              <User className="w-3.5 h-3.5 text-gray-800" />
              {accountLabel}
            </button>
            <button
              type="button"
              onClick={handleAccountClick}
              className="sm:hidden bg-white/80 hover:bg-white rounded-lg p-2 shadow-sm"
              aria-label={accountLabel}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              <User className="w-5 h-5 text-gray-800" />
            </button>

            <Link
              href={customerMobile ? '/account#wishlist' : '#'}
              onClick={(e) => {
                if (!customerMobile) {
                  e.preventDefault();
                  openAccountModal();
                }
              }}
              className="relative bg-white hover:bg-gray-50 rounded-lg p-2 transition-colors shadow-sm"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5 text-gray-800" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {wishlistCount > 99 ? '99+' : wishlistCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="relative bg-white hover:bg-gray-50 rounded-lg p-2 transition-colors shadow-sm"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5 text-gray-800" />
              {hydrated && itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blinkit-green text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>

            {accountMenuOpen && hasAccountIdentity && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-gray-200 shadow-lg p-2 z-30"
              >
                <p className="px-2 py-1 text-[11px] text-gray-500 truncate">{accountLabel}</p>
                {staffEligible && (
                  <p className="px-2 pb-1 text-[10px] text-gray-400">You&apos;re shopping as a customer</p>
                )}
                {customerMobile && (
                  <>
                    <Link
                      href="/account"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-blinkit-green"
                    >
                      My Account
                    </Link>
                    <Link
                      href="/account#wishlist"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-gray-900"
                    >
                      My Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}
                    </Link>
                    <Link
                      href="/account/track"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-gray-900"
                    >
                      Track My Orders
                    </Link>
                  </>
                )}
                {staffEligible && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      openAdminLoginModal();
                    }}
                    className="w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-gray-900 flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Login as Admin
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    openAccountModal();
                  }}
                  className="w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50"
                >
                  Use another number
                </button>
                {customerMobile && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleCustomerLogout}
                    className="w-full text-left px-2 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <LocationBar />

      {showSearch && (
        <div className="max-w-7xl mx-auto px-4 py-3 border-b border-gray-100">
          <GlobalSearch />
        </div>
      )}
    </header>
  );
}
