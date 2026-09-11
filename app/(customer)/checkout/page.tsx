'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Header from '@/components/Header/Header';
import CancellationPolicyCard from '@/components/Cart/CancellationPolicyCard';
import CouponSection from '@/components/Cart/CouponSection';
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
import StockRemovalNotice from '@/components/Cart/StockRemovalNotice';
import WeatherDisclaimerBanner from '@/components/Storefront/WeatherDisclaimerBanner';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { checkoutSchema, formatZodFlattenError, type CheckoutSchema } from '@/lib/validations';
import { buildWhatsAppMessage, buildWhatsAppUrl, openWhatsAppUrl } from '@/utils/whatsapp';
import { getOrCreateCheckoutIdempotencyKey, clearCheckoutIdempotencyKey } from '@/utils/checkoutAttempt';
import { nightDeliveryCopy, nightDeliveryWindow } from '@/lib/nightDelivery';
import { setLearnedDeliveryLocalities } from '@/lib/deliveryAddress';
import { formatCurrency } from '@/utils/formatter';
import { WHATSAPP_NUMBER, STORE_NAME } from '@/constants';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';
import { e164ToCheckoutMobile, toE164 } from '@/utils/phone';
import {
  setSessionVerifiedMobile,
} from '@/utils/whatsappVerificationSession';
import WhatsAppVerificationModal from '@/components/Checkout/WhatsAppVerificationModal';
import { prepareCheckoutVerification, clearPreparedCheckoutVerification } from '@/utils/prepareCheckoutVerification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Copy } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useCartHydrated();
  const { items, getSubtotal, clearCart, applyServerPrices } = useCartStore();
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
    overnightCheckout,
    deliveryAddressLocalities,
    refreshConfig,
  } = useConfigStore();
  const appliedDiscount = useDiscountStore((s) => s.applied);
  const clearDiscount = useDiscountStore((s) => s.clear);
  const setAppliedDiscount = useDiscountStore((s) => s.setApplied);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    setLearnedDeliveryLocalities(deliveryAddressLocalities);
  }, [deliveryAddressLocalities]);

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
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      paymentMethod: 'COD',
      alternateMobile: '',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '',
      houseNumber: '',
      street: '',
      area: '',
      landmark: '',
      deliveryNotes: '',
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
  const [placedSuccess, setPlacedSuccess] = useState<{
    orderNumber: string;
    orderId?: string;
    whatsappMessage?: string;
    whatsappUrl?: string;
  } | null>(null);
  const [nightPrompt, setNightPrompt] = useState<{
    title: string;
    message: string;
    data: CheckoutSchema;
    source: 'website' | 'whatsapp';
  } | null>(null);
  const [nightAckBusy, setNightAckBusy] = useState(false);
  const [addressPrompt, setAddressPrompt] = useState<{
    data: CheckoutSchema;
    source: 'website' | 'whatsapp';
  } | null>(null);
  const [addressAckBusy, setAddressAckBusy] = useState(false);
  const customerSectionRef = useRef<HTMLDivElement | null>(null);
  const addressSectionRef = useRef<HTMLDivElement | null>(null);
  const summarySectionRef = useRef<HTMLDivElement | null>(null);
  /** Prevents empty-cart guard from sending users to /cart after a successful order. */
  const orderCompletedRef = useRef(false);

  useEffect(() => {
    if (!items.length) return;
    void refreshCartStockFromServer();
  }, [items.length]);

  // The signed cookie is authoritative. Always validate it once on checkout;
  // in-memory Zustand identity can outlive a failed/expired browser session.
  useEffect(() => {
    if (authChecked) return;

    let alive = true;
    fetch('/api/customer/account', { credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { mobile?: string | null }) => {
        if (!alive) return;
        if (data.mobile) {
          setCustomerMobile(data.mobile);
        } else {
          setCustomerMobile('');
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
  }, [authChecked, setCustomerMobile, openAccountModal]);

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
  const checkoutCustomerName = formValues.firstName
    ? `${formValues.firstName} ${formValues.lastName ?? ''}`.trim()
    : undefined;

  useEffect(() => {
    if (!verificationResolved || whatsappVerified) return;
    if (!needsWhatsappVerification) return;
    if (!mobileE164 || !isWhatsAppPatternValid) return;

    const timer = window.setTimeout(() => {
      void prepareCheckoutVerification(mobileE164, { customerName: checkoutCustomerName })
        .then((result) => {
          if (!result.verified) return;
          setWhatsappVerified(true);
          setNeedsWhatsappVerification(false);
          setVerifiedMobileE164(mobileE164);
          setSessionVerifiedMobile(mobileE164);
          setVerificationResolved(true);
          clearPreparedCheckoutVerification(mobileE164);
        })
        .catch(() => {});
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    mobileE164,
    isWhatsAppPatternValid,
    verificationResolved,
    whatsappVerified,
    needsWhatsappVerification,
    checkoutCustomerName,
  ]);

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

    // Already confirmed by the backend for this mobile on this checkout page.
    if (verifiedMobileE164 === mobileE164) {
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
    if (placedSuccess) return;
    if (items.length === 0) router.replace('/cart');
  }, [items, router, hydrated, placedSuccess]);

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
      (verifiedMobileE164 && verifiedMobileE164 === e164)
    ) {
      return true;
    }
    // Only trust needsWhatsappVerification=false after status has been resolved.
    if (verificationResolved && !needsWhatsappVerification) {
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

  async function submitOrder(
    data: CheckoutSchema,
    source: 'website' | 'whatsapp',
    options?: { nightDeliveryAck?: boolean; addressAccuracyAck?: boolean },
  ) {
    const parsed = checkoutSchema.safeParse(data);
    if (!parsed.success) {
      setOrderError(formatZodFlattenError(parsed.error.flatten()));
      focusSection('address');
      return;
    }
    data = parsed.data;
    if (!validateBeforeSubmit(data)) return;
    if (!(await ensureWhatsAppVerified(data))) {
      setPendingSubmitSource(source);
      return;
    }

    if (!options?.addressAccuracyAck) {
      setAddressPrompt({ data, source });
      return;
    }

    if (!options?.nightDeliveryAck) {
      const copy = nightDeliveryCopy(nightDeliveryWindow(undefined, overnightCheckout), overnightCheckout);
      if (copy) {
        setNightPrompt({ title: copy.title, message: copy.message, data, source });
        return;
      }
    }

    const idempotencyKey = getOrCreateCheckoutIdempotencyKey(items);
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
      clientGrandTotal: grandTotal,
      idempotencyKey,
      nightDeliveryAck: options?.nightDeliveryAck === true,
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

    type CheckoutResult = {
      ok?: boolean;
      error?: unknown;
      code?: string;
      title?: string;
      message?: string;
      orderNumber?: string;
      orderId?: string;
      quote?: {
        items: Array<{ productId: string; variantId?: string | null; price: number }>;
        subtotal: number;
        discountAmount: number;
        grandTotal: number;
      };
    };

    async function lookupPlaced(): Promise<CheckoutResult | null> {
      const res = await fetch(`/api/checkout/status?key=${encodeURIComponent(idempotencyKey)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as CheckoutResult;
      if (data.ok && typeof data.orderNumber === 'string') return data;
      return null;
    }

    async function postCheckout(): Promise<{ res: Response; result: CheckoutResult }> {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const result = (await res.json().catch(() => ({}))) as CheckoutResult;
      return { res, result };
    }

    function finishSuccess(result: CheckoutResult) {
      const placedOrderNumber = typeof result.orderNumber === 'string' ? result.orderNumber : undefined;
      const placedOrderId = typeof result.orderId === 'string' ? result.orderId : undefined;
      orderCompletedRef.current = true;
      clearCheckoutIdempotencyKey();
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

      let whatsappMessage: string | undefined;
      let whatsappUrl: string | undefined;
      if (source === 'whatsapp' && placedOrderNumber) {
        const overnightNote = nightDeliveryCopy(
          nightDeliveryWindow(undefined, overnightCheckout),
          overnightCheckout,
        )?.title;
        whatsappMessage = buildWhatsAppMessage({
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
          orderNumber: placedOrderNumber,
          deliveryNote: overnightNote,
        });
        whatsappUrl = buildWhatsAppUrl(WHATSAPP_NUMBER, whatsappMessage);
        const opened = openWhatsAppUrl(whatsappUrl, { allowSameWindow: false });
        if (!opened) {
          setPlacedSuccess({
            orderNumber: placedOrderNumber,
            orderId: placedOrderId,
            whatsappMessage,
            whatsappUrl,
          });
          queueMicrotask(() => {
            clearCart();
            clearDiscount();
          });
          return;
        }
      }

      router.replace('/');
      queueMicrotask(() => {
        clearCart();
        clearDiscount();
      });
    }

    function handleFailure(result: CheckoutResult) {
      if (result.code === 'NIGHT_DELIVERY_ACK') {
        setNightPrompt({
          title: typeof result.title === 'string' ? result.title : 'Confirm delivery time',
          message:
            typeof result.message === 'string'
              ? result.message
              : typeof result.error === 'string'
                ? result.error
                : 'Please confirm when this order should be delivered.',
          data,
          source,
        });
        return;
      }
      const message = typeof result.error === 'string' ? result.error : 'Failed to place order';
      setOrderError(message);
      if (result.code === 'LOGIN_REQUIRED') {
        openAccountModal();
        return;
      }
      if (result.code === 'VERIFICATION_REQUIRED') {
        setNeedsWhatsappVerification(true);
        setShowVerificationModal(true);
        return;
      }
      if (result.code === 'UNAVAILABLE') {
        focusSection('address');
        return;
      }
      if (result.code === 'STOCK' || result.code === 'PRICE_CHANGED') {
        focusSection('summary');
      }
      if (result.code === 'PRICE_CHANGED' && result.quote) {
        applyServerPrices(result.quote.items);
        if (appliedDiscount) {
          setAppliedDiscount({
            ...appliedDiscount,
            discountAmount: result.quote.discountAmount,
            quotedSubtotal: result.quote.subtotal,
            youSavedLabel: `You saved ₹${Math.round(result.quote.discountAmount)}`,
          });
        }
      }
    }

    let res: Response;
    let result: CheckoutResult;
    try {
      ({ res, result } = await postCheckout());
    } catch {
      const existing = await lookupPlaced().catch(() => null);
      if (existing) {
        finishSuccess(existing);
        return;
      }
      try {
        ({ res, result } = await postCheckout());
      } catch {
        const existingRetry = await lookupPlaced().catch(() => null);
        if (existingRetry) {
          finishSuccess(existingRetry);
          return;
        }
        setOrderError('Network error. Checking whether your order went through… Please try Place Order again if nothing appears in Track order.');
        return;
      }
    }

    if (res.status === 503 || result.code === 'RETRY') {
      const existing = await lookupPlaced().catch(() => null);
      if (existing) {
        finishSuccess(existing);
        return;
      }
      try {
        ({ res, result } = await postCheckout());
      } catch {
        const existingRetry = await lookupPlaced().catch(() => null);
        if (existingRetry) {
          finishSuccess(existingRetry);
          return;
        }
        setOrderError('Checkout is taking longer than usual. Please try Place Order again.');
        return;
      }
    }

    if (!res.ok) {
      handleFailure(result);
      return;
    }
    finishSuccess(result);
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
    clearPreparedCheckoutVerification(mobile);
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

  if (placedSuccess) {
    const trackHref = placedSuccess.orderId
      ? `/account/track/${placedSuccess.orderId}`
      : '/account';
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header showSearch={false} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blinkit-green-light text-blinkit-green">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Order {placedSuccess.orderNumber} is in</h2>
            <p className="text-sm text-gray-500">
              You can track it from your account. WhatsApp didn&apos;t open in this browser — copy the message
              below and send it, or continue shopping.
            </p>
            {placedSuccess.whatsappMessage && (
              <pre className="text-left text-[11px] font-mono whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-xl p-3 max-h-48 overflow-y-auto">
                {placedSuccess.whatsappMessage}
              </pre>
            )}
            <div className="flex flex-col gap-2">
              {placedSuccess.whatsappMessage && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(placedSuccess.whatsappMessage || '');
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy WhatsApp message
                </Button>
              )}
              {placedSuccess.whatsappUrl && (
                <Button type="button" variant="outline" asChild>
                  <a href={placedSuccess.whatsappUrl} target="_blank" rel="noopener noreferrer">
                    Open WhatsApp
                  </a>
                </Button>
              )}
              <Button type="button" asChild>
                <Link href={trackHref}>Track my order</Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  router.replace('/');
                }}
              >
                Continue shopping
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

        <StockRemovalNotice />
        <WeatherDisclaimerBanner />

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
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 space-y-2">
            <p>{orderError}</p>
            <p className="text-xs text-red-600/80">
              If you already placed this order, open Track order instead of tapping Place Order again.
            </p>
            <Link href="/account" className="text-xs font-semibold text-blinkit-green underline">
              Track my order
            </Link>
          </div>
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
            <p className="text-[11px] text-gray-500 leading-snug">
              Use your real house, street, and area so the rider can find you. City and PIN stay as selected.
            </p>
            <div>
              <Label>Address (House / Flat No.) *</Label>
              <Input {...register('houseNumber')} placeholder="e.g. 12/A or Qtr 4" className="mt-1" />
              {errors.houseNumber && <p className="text-red-500 text-xs mt-1">{errors.houseNumber.message}</p>}
            </div>
            <div>
              <Label>Street *</Label>
              <Input {...register('street')} placeholder="e.g. Station Road" className="mt-1" />
              {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street.message}</p>}
            </div>
            <div>
              <Label>Area *</Label>
              <Input {...register('area')} placeholder="e.g. Railway Colony" className="mt-1" />
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

          <CouponSection subtotal={subtotal} />

          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <h3 className="font-bold text-sm">Payment Method</h3>
            <label
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                formValues.paymentMethod === 'COD'
                  ? 'border-2 border-blinkit-green bg-blinkit-green-light'
                  : 'border border-gray-200 hover:border-blinkit-green'
              }`}
            >
              <input type="radio" value="COD" {...register('paymentMethod')} className="accent-blinkit-green" />
              <div>
                <p className="font-bold text-sm">Cash On Delivery</p>
                <p className="text-xs text-gray-500">Pay when order arrives</p>
              </div>
            </label>
            <label
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                formValues.paymentMethod === 'QR_ON_DELIVERY'
                  ? 'border-2 border-blinkit-green bg-blinkit-green-light'
                  : 'border border-gray-200 hover:border-blinkit-green'
              }`}
            >
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
                {isSubmitting ? 'Placing order…' : 'Order via WhatsApp'}
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
        onClose={() => {
          setShowVerificationModal(false);
          setPendingSubmitSource(null);
        }}
      />

      {addressPrompt && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Confirm your delivery address</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Our rider must find this house from the address you entered. If the address is incomplete
              or cannot be located, we may cancel the order. We do not auto-close orders from this check
              — please WhatsApp GoBaskit Karo if you need help correcting it.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-semibold text-emerald-700 underline"
            >
              WhatsApp GoBaskit Karo +{WHATSAPP_NUMBER.replace(/\D/g, '')}
            </a>
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full h-11 rounded-xl font-semibold"
                disabled={addressAckBusy}
                onClick={() => {
                  const next = addressPrompt;
                  setAddressAckBusy(true);
                  setAddressPrompt(null);
                  void submitOrder(next.data, next.source, { addressAccuracyAck: true }).finally(() => {
                    setAddressAckBusy(false);
                  });
                }}
              >
                {addressAckBusy ? 'Continuing…' : 'Address is correct — continue'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-500"
                disabled={addressAckBusy}
                onClick={() => {
                  setAddressPrompt(null);
                  focusSection('address');
                }}
              >
                Edit address
              </Button>
            </div>
          </div>
        </div>
      )}

      {nightPrompt && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{nightPrompt.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{nightPrompt.message}</p>
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full h-11 rounded-xl font-semibold"
                disabled={nightAckBusy}
                onClick={() => {
                  const next = nightPrompt;
                  setNightAckBusy(true);
                  setNightPrompt(null);
                  void submitOrder(next.data, next.source, {
                    nightDeliveryAck: true,
                    addressAccuracyAck: true,
                  }).finally(() => {
                    setNightAckBusy(false);
                  });
                }}
              >
                {nightAckBusy ? 'Placing order…' : 'Accept'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-500"
                disabled={nightAckBusy}
                onClick={() => setNightPrompt(null)}
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
