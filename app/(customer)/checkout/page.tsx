'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Header from '@/components/Header/Header';
import CancellationPolicyCard from '@/components/Cart/CancellationPolicyCard';
import { markOrderCelebration } from '@/components/Cart/OrderCelebration';
import { useCartStore } from '@/store/cartStore';
import { useConfigStore } from '@/store/configStore';
import { useDiscountStore } from '@/store/discountStore';
import { useLocationStore } from '@/store/locationStore';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import { deliveryChargeFrom } from '@/constants';
import { cityForPin, cityIsServiceable, normalizeLocationToken, pinForCity, pinIsServiceable } from '@/utils/delivery';
import { SURNAME_LABEL } from '@/utils/customer';
import {
  loadCheckoutProfileLocal,
  profileFromCheckout,
  saveCheckoutProfileLocal,
} from '@/utils/customerProfile';
import { prefetchCheckoutProfile } from '@/utils/prefetchCheckoutProfile';
import { refreshCartStockFromServer } from '@/utils/refreshCartStock';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { checkoutSchema, type CheckoutSchema } from '@/lib/validations';
import { buildWhatsAppMessage, buildWhatsAppUrl, openWhatsAppUrl } from '@/utils/whatsapp';
import { formatCurrency } from '@/utils/formatter';
import { WHATSAPP_NUMBER, STORE_NAME } from '@/constants';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';
import { e164ToCheckoutMobile, toE164 } from '@/utils/phone';
import {
  isMobileVerifiedInSession,
  setSessionVerifiedMobile,
} from '@/utils/whatsappVerificationSession';
import WhatsAppVerificationModal from '@/components/Checkout/WhatsAppVerificationModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useCartHydrated();
  const { items, getSubtotal, clearCart } = useCartStore();
  const {
    serviceablePins,
    serviceableCities,
    cityAliases,
    pinCityMap,
    cityDefaultPins,
    deliverySlabs,
    minOrderValue,
    checkoutMode,
    homepageConfig,
    refreshConfig,
  } = useConfigStore();
  const appliedDiscount = useDiscountStore((s) => s.applied);
  const clearDiscount = useDiscountStore((s) => s.clear);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const subtotal = getSubtotal();
  const deliveryCharge = deliveryChargeFrom(deliverySlabs, subtotal);
  const discountAmount =
    appliedDiscount && Math.abs(appliedDiscount.quotedSubtotal - subtotal) <= 0.05
      ? appliedDiscount.discountAmount
      : 0;
  const grandTotal = Math.max(0, subtotal - discountAmount + deliveryCharge);
  const belowMinimum = minOrderValue > 0 && subtotal < minOrderValue;
  const hasOutOfStock = items.some((i) => i.stock <= 0 || i.quantity > i.stock);

  const locationPin = useLocationStore((s) => s.pin);
  const locationCity = useLocationStore((s) => s.city);
  const checkedMobile = useStaffPortalStore((s) => s.checkedMobile);
  const customerMobile = useStaffPortalStore((s) => s.customerMobile);
  const setCustomerMobile = useStaffPortalStore((s) => s.setCustomerMobile);
  const openAccountModal = useStaffPortalStore((s) => s.openAccountModal);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
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

  const [authChecked, setAuthChecked] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  // Optimistic: don't assume verification is required until we know (avoids Place Order flash).
  const [needsWhatsappVerification, setNeedsWhatsappVerification] = useState(false);
  const [verificationResolved, setVerificationResolved] = useState(false);
  const [verifiedMobileE164, setVerifiedMobileE164] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingSubmitSource, setPendingSubmitSource] = useState<'website' | 'whatsapp' | null>(null);
  const [highlightSection, setHighlightSection] = useState<'customer' | 'address' | 'summary' | null>(null);
  const [orderError, setOrderError] = useState('');
  const customerSectionRef = useRef<HTMLDivElement | null>(null);
  const addressSectionRef = useRef<HTMLDivElement | null>(null);
  const summarySectionRef = useRef<HTMLDivElement | null>(null);
  /** Prevents empty-cart guard from sending users to /cart after a successful order. */
  const orderCompletedRef = useRef(false);

  useEffect(() => {
    if (!items.length) return;
    void refreshCartStockFromServer();
  }, [items.length]);

  // Guests must log in before checkout. Re-check when session becomes available.
  useEffect(() => {
    if (customerMobile) {
      setAuthChecked(true);
      return;
    }

    let alive = true;
    fetch('/api/customer/account')
      .then((res) => res.json())
      .then((data: { mobile?: string | null }) => {
        if (!alive) return;
        if (data.mobile) {
          setCustomerMobile(data.mobile);
        } else {
          openAccountModal();
        }
        setAuthChecked(true);
      })
      .catch(() => {
        if (!alive) return;
        openAccountModal();
        setAuthChecked(true);
      });

    return () => {
      alive = false;
    };
  }, [customerMobile, setCustomerMobile, openAccountModal]);

  useEffect(() => {
    if (profileLoaded) return;
    if (!customerMobile) return;

    // Instant fill from local cache so verified customers never stare at empty fields.
    const localProfile = loadCheckoutProfileLocal();
    if (localProfile) {
      reset({
        firstName: localProfile.firstName,
        lastName: localProfile.lastName,
        mobile: customerMobile || localProfile.mobile || checkedMobile || '',
        alternateMobile: localProfile.alternateMobile || '',
        houseNumber: localProfile.houseNumber,
        street: localProfile.street,
        area: localProfile.area,
        landmark: localProfile.landmark || '',
        city: localProfile.city,
        state: localProfile.state,
        pincode: localProfile.pincode || '',
        paymentMethod: 'COD',
        deliveryNotes: localProfile.deliveryNotes || '',
      });
    } else if (customerMobile || checkedMobile) {
      setValue('mobile', customerMobile || checkedMobile || '', { shouldValidate: true });
    }

    async function loadProfile() {
      const result = await prefetchCheckoutProfile();
      const sessionMobile = result.mobile ? normalizeMobile(result.mobile) : '';
      const mobile = customerMobile || sessionMobile || checkedMobile;
      const profile = result.profile ?? (sessionMobile ? loadCheckoutProfileLocal() : null);

      if (sessionMobile) {
        const e164 = toE164('91', sessionMobile);
        if (result.isWhatsappVerified || result.canCheckout) {
          setWhatsappVerified(result.isWhatsappVerified);
          setNeedsWhatsappVerification(false);
          setVerificationResolved(true);
          if (e164 && result.isWhatsappVerified) {
            setVerifiedMobileE164(e164);
            setSessionVerifiedMobile(e164);
          }
        } else if (e164 && isMobileVerifiedInSession(e164)) {
          setWhatsappVerified(true);
          setNeedsWhatsappVerification(false);
          setVerifiedMobileE164(e164);
          setVerificationResolved(true);
        } else if (result.needsVerification !== null) {
          setNeedsWhatsappVerification(result.needsVerification);
          setWhatsappVerified(false);
          setVerificationResolved(true);
        } else {
          setVerificationResolved(true);
        }
      }

      if (profile) {
        reset({
          firstName: profile.firstName,
          lastName: profile.lastName,
          mobile: customerMobile || profile.mobile || mobile || '',
          alternateMobile: profile.alternateMobile || '',
          houseNumber: profile.houseNumber,
          street: profile.street,
          area: profile.area,
          landmark: profile.landmark || '',
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode || '',
          paymentMethod: 'COD',
          deliveryNotes: profile.deliveryNotes || '',
        });
        if (profile.mobile || mobile) {
          saveCheckoutProfileLocal({
            ...profile,
            mobile: customerMobile || profile.mobile || mobile || '',
          });
        }
      } else if (mobile) {
        setValue('mobile', mobile, { shouldValidate: true });
      }
      setProfileLoaded(true);
    }

    loadProfile();
  }, [profileLoaded, customerMobile, checkedMobile, reset, setValue]);

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
    ? cityIsServiceable(serviceableCities, cityValue, cityAliases)
    : null;
  const deliveryMatchByPin = pinServiceable === true;
  const deliveryMatchByCity = cityServiceable === true;
  const deliveryServiceable = deliveryMatchByPin || deliveryMatchByCity;
  const pincodeOptional = deliveryMatchByCity && !deliveryMatchByPin;
  const enteredMobile = (formValues.mobile ?? '').trim();
  const isWhatsAppPatternValid = /^\d{10}$/.test(enteredMobile);
  const mobileE164 = isWhatsAppPatternValid ? (toE164('91', enteredMobile) ?? '') : '';

  // Keep PIN ↔ city in sync: valid PIN fills matching city; serviceable city fills default PIN.
  const pinCitySyncLock = useRef<'pin' | 'city' | null>(null);
  useEffect(() => {
    if (pinCitySyncLock.current === 'city') {
      pinCitySyncLock.current = null;
      return;
    }
    if (!/^\d{6}$/.test(pincodeValue)) return;
    if (!pinIsServiceable(serviceablePins, pincodeValue)) return;

    const matchedCity = cityForPin({
      pin: pincodeValue,
      serviceablePins,
      serviceableCities,
      pinCityMap,
    });
    if (!matchedCity) return;
    if (
      normalizeLocationToken(getValues('city') ?? '') === normalizeLocationToken(matchedCity)
    ) {
      return;
    }

    pinCitySyncLock.current = 'pin';
    setValue('city', matchedCity, { shouldValidate: true, shouldDirty: true });
  }, [
    pincodeValue,
    serviceablePins,
    serviceableCities,
    pinCityMap,
    getValues,
    setValue,
  ]);

  useEffect(() => {
    if (pinCitySyncLock.current === 'pin') {
      pinCitySyncLock.current = null;
      return;
    }
    const city = cityValue.trim();
    if (!city || !cityIsServiceable(serviceableCities, city, cityAliases)) return;

    const matchedPin = pinForCity({
      city,
      serviceablePins,
      serviceableCities,
      cityAliases,
      pinCityMap,
      cityDefaultPins,
    });
    if (!matchedPin) return;
    if ((getValues('pincode') ?? '').trim() === matchedPin) return;

    pinCitySyncLock.current = 'city';
    setValue('pincode', matchedPin, { shouldValidate: true, shouldDirty: true });
  }, [
    cityValue,
    serviceablePins,
    serviceableCities,
    cityAliases,
    pinCityMap,
    cityDefaultPins,
    getValues,
    setValue,
  ]);

  useEffect(() => {
    // Keep checkout mobile locked to the logged-in account.
    if (customerMobile) {
      setValue('mobile', customerMobile, { shouldValidate: true });
    }
  }, [customerMobile, setValue]);

  useEffect(() => {
    if (!isWhatsAppPatternValid || !mobileE164) {
      setWhatsappVerified(false);
      setNeedsWhatsappVerification(false);
      setVerifiedMobileE164(null);
      setVerificationResolved(false);
      return;
    }

    // Already verified for this mobile in this tab session — no status fetch, no UI flash.
    if (isMobileVerifiedInSession(mobileE164) || verifiedMobileE164 === mobileE164) {
      if (!whatsappVerified || needsWhatsappVerification || !verificationResolved) {
        setWhatsappVerified(true);
        setNeedsWhatsappVerification(false);
        setVerifiedMobileE164(mobileE164);
        setVerificationResolved(true);
      }
      return;
    }

    // Number changed — drop prior resolution and re-check once for the new number.
    const mobileChanged = Boolean(verifiedMobileE164 && verifiedMobileE164 !== mobileE164);
    if (mobileChanged) {
      setWhatsappVerified(false);
      setNeedsWhatsappVerification(false);
      setVerifiedMobileE164(null);
      setVerificationResolved(false);
    } else if (verificationResolved && profileLoaded) {
      // Account/session already answered for this visit — do not re-verify on Place Order.
      return;
    }

    let alive = true;
    fetch(`/api/customer/verification/status?mobile=${encodeURIComponent(mobileE164)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        const verified = data.verified === true;
        const needs = data.needsVerification === true;
        setWhatsappVerified(verified);
        setNeedsWhatsappVerification(needs);
        setVerificationResolved(true);
        if (verified) {
          setVerifiedMobileE164(mobileE164);
          setSessionVerifiedMobile(mobileE164);
        }
      })
      .catch(() => {
        if (alive) setVerificationResolved(true);
      });

    return () => {
      alive = false;
    };
    // Intentionally omit whatsappVerified / needsWhatsappVerification to avoid re-fetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileE164, isWhatsAppPatternValid, verifiedMobileE164, verificationResolved, profileLoaded]);

  function focusSection(section: 'customer' | 'address' | 'summary') {
    setHighlightSection(section);
    const refMap = {
      customer: customerSectionRef,
      address: addressSectionRef,
      summary: summarySectionRef,
    };
    refMap[section].current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  useEffect(() => {
    if (!hydrated) return;
    if (orderCompletedRef.current) return;
    if (items.length === 0) router.replace('/cart');
  }, [items, router, hydrated]);

  const whatsappMessage = useMemo(() => {
    if (!formValues.firstName || !formValues.mobile) return '';
    return buildWhatsAppMessage({
      items,
      customer: formValues,
      subtotal,
      deliveryCharge,
      discountAmount,
      discountLabel:
        appliedDiscount?.type === 'COUPON' && appliedDiscount.couponCode
          ? `Coupon (${appliedDiscount.couponCode})`
          : appliedDiscount?.type === 'MEMBERSHIP'
            ? 'Membership'
            : undefined,
      grandTotal,
      storeName: STORE_NAME,
    });
  }, [items, formValues, subtotal, deliveryCharge, discountAmount, appliedDiscount, grandTotal]);

  function validateBeforeSubmit(data: CheckoutSchema): boolean {
    setOrderError('');
    if (belowMinimum) {
      focusSection('summary');
      return false;
    }
    if (hasOutOfStock) {
      setOrderError('Some items are out of stock. Remove them from your cart to continue.');
      focusSection('summary');
      return false;
    }
    const pinMatched = data.pincode ? pinIsServiceable(serviceablePins, data.pincode) : false;
    const cityMatched = cityIsServiceable(serviceableCities, data.city, cityAliases);
    if (!pinMatched && !cityMatched) {
      focusSection('address');
      return false;
    }
    if (!isWhatsAppPatternValid) {
      focusSection('customer');
      return false;
    }
    return true;
  }

  async function ensureWhatsAppVerified(data: CheckoutSchema): Promise<boolean> {
    const e164 = toE164('91', data.mobile);
    if (!e164) {
      focusSection('customer');
      return false;
    }

    // Session / in-memory already confirmed — never re-check on Place Order.
    if (
      whatsappVerified ||
      !needsWhatsappVerification ||
      isMobileVerifiedInSession(e164) ||
      (verifiedMobileE164 && verifiedMobileE164 === e164)
    ) {
      return true;
    }

    try {
      const res = await fetch(`/api/customer/verification/status?mobile=${encodeURIComponent(e164)}`);
      const status = res.ok ? await res.json() : null;
      if (status?.verified) {
        setWhatsappVerified(true);
        setNeedsWhatsappVerification(false);
        setVerifiedMobileE164(e164);
        setSessionVerifiedMobile(e164);
        setVerificationResolved(true);
        return true;
      }
      if (status?.canCheckout) {
        setNeedsWhatsappVerification(false);
        setVerificationResolved(true);
        return true;
      }
    } catch {
      /* fall through to modal */
    }

    setNeedsWhatsappVerification(true);
    setShowVerificationModal(true);
    return false;
  }

  async function persistProfile(data: CheckoutSchema) {
    const profile = profileFromCheckout(data);
    saveCheckoutProfileLocal(profile);
    try {
      await fetch('/api/customer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: data.mobile, profile }),
      });
    } catch {
      /* best-effort */
    }
  }

  async function submitOrder(data: CheckoutSchema, source: 'website' | 'whatsapp') {
    if (!validateBeforeSubmit(data)) return;
    if (!(await ensureWhatsAppVerified(data))) {
      setPendingSubmitSource(source);
      return;
    }

    const payload = {
      customer: data,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        name: i.variantLabel ? `${i.name} — ${i.variantLabel}` : i.name,
        quantity: i.quantity,
        price: i.price,
        unit: i.unit,
      })),
      paymentMethod: data.paymentMethod,
      orderSource: source,
      ...(discountAmount > 0 && appliedDiscount
        ? {
            discount: {
              type: appliedDiscount.type,
              couponCode: appliedDiscount.couponCode,
              discountAmount: appliedDiscount.discountAmount,
              memberId: appliedDiscount.memberId ?? null,
            },
          }
        : {}),
    };

    if (source === 'whatsapp') {
      const message = buildWhatsAppMessage({
        items,
        customer: data,
        subtotal,
        deliveryCharge,
        discountAmount,
        discountLabel:
          appliedDiscount?.type === 'COUPON' && appliedDiscount.couponCode
            ? `Coupon (${appliedDiscount.couponCode})`
            : appliedDiscount?.type === 'MEMBERSHIP'
              ? 'Membership'
              : undefined,
        grandTotal,
        storeName: STORE_NAME,
      });
      const url = buildWhatsAppUrl(WHATSAPP_NUMBER, message);
      openWhatsAppUrl(url);
    }

    let orderPlaced = false;
    let placedOrderNumber: string | undefined;
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOrderError(typeof result.error === 'string' ? result.error : 'Failed to place order');
        if (result.code === 'LOGIN_REQUIRED') {
          openAccountModal();
        } else if (result.code === 'VERIFICATION_REQUIRED') {
          setNeedsWhatsappVerification(true);
          setShowVerificationModal(true);
        }
        return;
      }
      orderPlaced = true;
      if (typeof result.orderNumber === 'string') placedOrderNumber = result.orderNumber;
    } catch {
      setOrderError('Network error. Please try again.');
      return;
    }

    // Soft-navigate home with celebration — never hard-refresh, never land on empty /cart.
    if (orderPlaced) {
      orderCompletedRef.current = true;
      const normalized = normalizeMobile(data.mobile);
      setCustomerMobile(normalized);
      void persistProfile(data);
      void fetch('/api/customer/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: normalized }),
      }).catch(() => {});

      try {
        sessionStorage.setItem('gobaskit_last_order_source', source);
      } catch {
        /* ignore */
      }
      markOrderCelebration(placedOrderNumber);
      router.replace('/');
      // Clear cart after navigation starts so the empty-cart guard cannot win the race.
      queueMicrotask(() => {
        clearCart();
        clearDiscount();
      });
    }
  }

  async function onSubmitWebsite(data: CheckoutSchema) {
    await submitOrder(data, 'website');
  }

  async function onSubmitWhatsApp(data: CheckoutSchema) {
    await submitOrder(data, 'whatsapp');
  }

  async function handleVerified(mobile: string) {
    setWhatsappVerified(true);
    setNeedsWhatsappVerification(false);
    setVerifiedMobileE164(mobile);
    setSessionVerifiedMobile(mobile);
    setVerificationResolved(true);
    setShowVerificationModal(false);
    const checkoutMobile = e164ToCheckoutMobile(mobile);
    if (checkoutMobile && isValidIndianMobile(checkoutMobile) && checkoutMobile !== getValues('mobile')) {
      setValue('mobile', checkoutMobile, { shouldValidate: true });
    }
    try {
      sessionStorage.setItem('gobaskit_account_verified_toast', '1');
    } catch {
      /* ignore */
    }
    const data = getValues();
    if (pendingSubmitSource) {
      const source = pendingSubmitSource;
      setPendingSubmitSource(null);
      const mobileForOrder =
        checkoutMobile && isValidIndianMobile(checkoutMobile) ? checkoutMobile : data.mobile;
      await submitOrder({ ...data, mobile: mobileForOrder }, source);
    }
  }

  async function handleMessageSent(mobile: string) {
    // Customer sent WA SMS — unlock checkout without marking fully verified.
    setNeedsWhatsappVerification(false);
    setVerificationResolved(true);
    setShowVerificationModal(false);
    const checkoutMobile = e164ToCheckoutMobile(mobile);
    if (checkoutMobile && isValidIndianMobile(checkoutMobile) && checkoutMobile !== getValues('mobile')) {
      setValue('mobile', checkoutMobile, { shouldValidate: true });
    }
    const data = getValues();
    if (pendingSubmitSource) {
      const source = pendingSubmitSource;
      setPendingSubmitSource(null);
      const mobileForOrder =
        checkoutMobile && isValidIndianMobile(checkoutMobile) ? checkoutMobile : data.mobile;
      await submitOrder({ ...data, mobile: mobileForOrder }, source);
    }
  }

  function onInvalid(formErrors: Partial<Record<keyof CheckoutSchema, unknown>>) {
    const customerFields: Array<keyof CheckoutSchema> = ['firstName', 'lastName', 'mobile', 'alternateMobile'];
    const addressFields: Array<keyof CheckoutSchema> = [
      'houseNumber',
      'street',
      'area',
      'city',
      'state',
      'pincode',
      'deliveryNotes',
    ];
    if (customerFields.some((field) => formErrors[field])) {
      focusSection('customer');
      return;
    }
    if (addressFields.some((field) => formErrors[field])) {
      focusSection('address');
      return;
    }
    focusSection('summary');
  }

  const showWebsite = checkoutMode === 'website' || checkoutMode === 'both';
  const showWhatsApp = checkoutMode === 'whatsapp' || checkoutMode === 'both';

  const canSubmit =
    deliveryServiceable &&
    isWhatsAppPatternValid &&
    !belowMinimum &&
    !hasOutOfStock &&
    !isSubmitting;

  if (!hydrated || !authChecked) {
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

  if (!customerMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header showSearch={false} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Login required</h2>
            <p className="text-sm text-gray-500">
              Please log in with your mobile number to apply offers and complete checkout.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button type="button" onClick={openAccountModal}>
                Login to continue
              </Button>
              <Button type="button" variant="secondary" asChild>
                <Link href="/cart">Back to cart</Link>
              </Button>
            </div>
          </div>
        </main>
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

        {hasOutOfStock && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            Some items are out of stock. Go back to cart and remove them before placing your order.
          </div>
        )}

        {orderError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{orderError}</div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div
            ref={customerSectionRef}
            className={`bg-white rounded-xl border p-4 space-y-3 transition-colors ${
              highlightSection === 'customer' ? 'border-red-300 bg-red-50/30' : 'border-gray-100'
            }`}
          >
            <h3 className="font-bold text-sm">Customer Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input {...register('firstName')} placeholder="Rahul" className="mt-1" />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <Label>{SURNAME_LABEL} *</Label>
                <Input {...register('lastName')} placeholder="Sharma" className="mt-1" />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>
            <div>
              <Label>Mobile *</Label>
              <Input
                {...register('mobile')}
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="numeric"
                className="mt-1 bg-gray-50"
                readOnly
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Orders are placed on your logged-in WhatsApp number (+91 {customerMobile}).
              </p>
              {whatsappVerified && isWhatsAppPatternValid && (
                <p className="text-xs text-green-700 flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> WhatsApp verified
                </p>
              )}
              {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile.message}</p>}
            </div>
            <div>
              <Label>Alternate Mobile</Label>
              <Input {...register('alternateMobile')} placeholder="Optional" maxLength={10} inputMode="numeric" className="mt-1" />
              {errors.alternateMobile && <p className="text-red-500 text-xs mt-1">{errors.alternateMobile.message}</p>}
            </div>
          </div>

          <div
            ref={addressSectionRef}
            className={`bg-white rounded-xl border p-4 space-y-3 transition-colors ${
              highlightSection === 'address' ? 'border-red-300 bg-red-50/30' : 'border-gray-100'
            }`}
          >
            <h3 className="font-bold text-sm">Delivery Address</h3>
            <div>
              <Label>Address (House / Flat No.) *</Label>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>City *</Label>
                <Input {...register('city')} className="mt-1" />
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
                {!errors.city && cityServiceable === false && pinServiceable !== true && (
                  <p className="text-red-500 text-xs mt-1">We&apos;re not delivering to your location just yet — we&apos;re expanding fast, so please check back soon!</p>
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
              <Label>Postcode {pincodeOptional ? '(Optional — city matched)' : '*'}</Label>
              <Input {...register('pincode')} maxLength={6} inputMode="numeric" className="mt-1" />
              {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode.message}</p>}
              {!errors.pincode && pinServiceable === true && (
                <p className="text-green-600 text-xs mt-1">✓ Great! We deliver to your area.</p>
              )}
              {!errors.pincode && pinServiceable === false && pincodeValue && (
                <p className="text-red-500 text-xs mt-1">
                  We&apos;re not delivering to your location just yet — we&apos;re expanding fast, so please check back soon!
                </p>
              )}
              {!errors.pincode && pinServiceable !== true && cityServiceable === true && (
                <p className="text-green-600 text-xs mt-1">✓ Delivery is available based on your city.</p>
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

          <div
            ref={summarySectionRef}
            className={`bg-white rounded-xl border p-4 text-sm space-y-1 transition-colors ${
              highlightSection === 'summary' ? 'border-red-300 bg-red-50/30' : 'border-gray-100'
            }`}
          >
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
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
                <span>−{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between"><span>Delivery</span><span>{formatCurrency(deliveryCharge)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-dashed pt-2">
              <span>Total</span><span className="text-blinkit-green">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <CancellationPolicyCard text={homepageConfig.cancellationPolicy} />

          {whatsappMessage && showWhatsApp && (
            <details className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-xs">
              <summary className="font-semibold cursor-pointer text-gray-600">Preview WhatsApp Message</summary>
              <pre className="mt-2 whitespace-pre-wrap text-gray-700 font-mono text-[11px]">{whatsappMessage}</pre>
            </details>
          )}

          <div className="space-y-2">
            {showWebsite && (
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={!canSubmit}
                onClick={handleSubmit(onSubmitWebsite, onInvalid)}
              >
                {isSubmitting
                  ? 'Placing Order...'
                  : !deliveryServiceable
                    ? 'Delivery unavailable at this address'
                    : !isWhatsAppPatternValid
                      ? 'Enter valid mobile number'
                      : verificationResolved && needsWhatsappVerification && !whatsappVerified
                      ? 'Send WhatsApp code to place order'
                      : 'Place Order'}
              </Button>
            )}
            {showWhatsApp && (
              <Button
                type="button"
                size="lg"
                variant={showWebsite ? 'outline' : 'default'}
                className="w-full"
                disabled={!canSubmit}
                onClick={handleSubmit(onSubmitWhatsApp, onInvalid)}
              >
                {isSubmitting ? 'Opening WhatsApp...' : 'Order via WhatsApp'}
              </Button>
            )}
          </div>
        </form>
      </main>

      <WhatsAppVerificationModal
        open={showVerificationModal}
        initialNationalNumber={enteredMobile}
        initialCountryDial="91"
        customerName={formValues.firstName ? `${formValues.firstName} ${formValues.lastName ?? ''}`.trim() : undefined}
        onVerified={handleVerified}
        onMessageSent={handleMessageSent}
        onClose={() => {
          setShowVerificationModal(false);
          setPendingSubmitSource(null);
        }}
      />
    </div>
  );
}
