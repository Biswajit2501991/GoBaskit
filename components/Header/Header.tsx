'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import AccountVerifiedToast from '@/components/Header/AccountVerifiedToast';
import PoweredByBanner from '@/components/Header/PoweredByBanner';
import CartDrawer from '@/components/Cart/CartDrawer';
import OrderCelebration from '@/components/Cart/OrderCelebration';
import StickyCategoryChips from '@/components/CategoryCard/StickyCategoryChips';
import AllCategoriesModal from '@/components/CategoryCard/AllCategoriesModal';
import { clearCheckoutProfileLocal } from '@/utils/customerProfile';
import { clearSessionVerifiedMobile, setSessionVerifiedMobile } from '@/utils/whatsappVerificationSession';
import { toE164 } from '@/utils/phone';
import { warmCustomerSession } from '@/utils/warmCustomerSession';
import { logoutEverywhere } from '@/utils/logoutEverywhere';
import { useConfigStore } from '@/store/configStore';
import { useCatalogStore } from '@/store/catalogStore';

interface HeaderProps {
  /** Set false to hide the global product search (e.g. focused flows like checkout). */
  showSearch?: boolean;
  /** Sticky category chips under search. Defaults to same as showSearch. */
  showCategoryChips?: boolean;
}

export default function Header({ showSearch = true, showCategoryChips }: HeaderProps) {
  const pathname = usePathname();
  const chipsEnabled = showCategoryChips ?? showSearch;
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
  const clearWishlist = useWishlistStore((s) => s.clear);
  const fetchConfig = useConfigStore((s) => s.fetchConfig);
  const showPoweredByBanner = useConfigStore((s) => s.homepageConfig.showPoweredByBanner !== false);
  const poweredByText = useConfigStore((s) => s.homepageConfig.poweredByText);
  const categories = useCatalogStore((s) => s.categories);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(showSearch ? 168 : 72);
  const headerRef = useRef<HTMLElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const activeCategorySlug = pathname.startsWith('/category/')
    ? pathname.split('/')[2] || undefined
    : undefined;
  const accountLabel = staffEligible
    ? staffName || `Staff ${checkedMobile}`
    : customerMobile
      ? `+91 ${customerMobile}`
      : 'My Account';
  const hasAccountIdentity = staffEligible || Boolean(customerMobile);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (chipsEnabled) void fetchCatalog();
  }, [chipsEnabled, fetchCatalog]);

  useEffect(() => {
    if (!showSearch) {
      setCompact(false);
      return;
    }
    const onScroll = () => {
      const y = window.scrollY;
      const doc = document.documentElement;
      const distanceFromBottom = doc.scrollHeight - (y + window.innerHeight);
      // Near the bottom, shrinking the fixed header fights upward scroll — stay expanded.
      if (distanceFromBottom < 160) {
        setCompact(false);
        return;
      }
      setCompact(y > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showSearch]);

  // Keep page content below the fixed header as its height changes (compact / chips).
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(Math.ceil(el.getBoundingClientRect().height));
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [compact, showSearch, chipsEnabled, categories.length]);

  useEffect(() => {
    if (hasAccountIdentity) {
      // Warm account + profile + orders + wishlist once (TTL / dedupe inside).
      void warmCustomerSession();
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
          void warmCustomerSession({ force: true });
        }
      })
      .catch(() => null);
  }, [hasAccountIdentity, setCustomerMobile]);

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
    clearCheckoutProfileLocal();
    clearSessionVerifiedMobile();
    clearWishlist();
    clearAccount();
    setAccountMenuOpen(false);
    await logoutEverywhere('/');
  }

  return (
    <>
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm pt-[env(safe-area-inset-top,0px)]"
    >
      <AccountMobileModal />
      <StaffAdminLoginModal />
      <CartDrawer />
      <OrderCelebration />
      <RestockToastHost enabled={Boolean(customerMobile) && !staffEligible} />
      <AccountVerifiedToast enabled={Boolean(customerMobile) && !staffEligible} mobile10={customerMobile} />
      <div className="bg-blinkit-yellow">
        <div
          className={`max-w-7xl mx-auto px-3 sm:px-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 transition-[padding] ${
            compact ? 'py-1.5' : 'py-2 sm:py-2.5'
          }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="bg-white rounded-lg px-2 py-1 sm:px-2.5 shadow-sm shrink-0">
              <span
                className={`font-extrabold text-gray-900 tracking-tight ${
                  compact ? 'text-sm sm:text-lg' : 'text-base sm:text-xl'
                }`}
              >
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

          {showPoweredByBanner && poweredByText && !compact ? (
            <PoweredByBanner
              text={poweredByText}
              className="order-3 w-full basis-full min-w-0 sm:order-none sm:w-auto sm:basis-auto sm:flex-1 sm:min-w-0 sm:mx-3"
            />
          ) : (
            <div className="hidden sm:block flex-1 min-w-0" aria-hidden />
          )}

          <div ref={actionsRef} className="relative flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
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
              className="sm:hidden bg-white/80 hover:bg-white rounded-lg p-1.5 shadow-sm"
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
              className="relative bg-white hover:bg-gray-50 rounded-lg p-1.5 sm:p-2 transition-colors shadow-sm"
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
              className="relative bg-white hover:bg-gray-50 rounded-lg p-1.5 sm:p-2 transition-colors shadow-sm"
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

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          compact ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-24 opacity-100'
        }`}
      >
        <LocationBar />
      </div>

      {showSearch && (
        <div
          className={`max-w-7xl mx-auto px-3 sm:px-4 border-b border-gray-100 ${
            compact ? 'py-2' : 'py-2.5 sm:py-3'
          }`}
        >
          <Suspense
            fallback={
              <div className="h-10 w-full rounded-xl bg-gray-50 border border-gray-200" aria-hidden />
            }
          >
            <GlobalSearch />
          </Suspense>
        </div>
      )}

      {chipsEnabled && categories.length > 0 && (
        <>
          <StickyCategoryChips
            categories={categories}
            activeSlug={activeCategorySlug}
            onOpenAll={() => setAllCategoriesOpen(true)}
          />
          <AllCategoriesModal
            open={allCategoriesOpen}
            categories={categories}
            activeSlug={activeCategorySlug}
            onClose={() => setAllCategoriesOpen(false)}
          />
        </>
      )}
    </header>
    {/* Spacer so page content starts below the fixed header */}
    <div
      aria-hidden
      className="shrink-0"
      style={{ height: headerHeight || undefined }}
    />
    </>
  );
}
