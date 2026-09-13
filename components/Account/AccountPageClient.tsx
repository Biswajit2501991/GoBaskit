'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header/Header';
import { Button } from '@/components/ui/button';
import { formatCustomerName } from '@/utils/customer';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import type { SavedCheckoutProfile } from '@/utils/customerProfile';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import {
  getWarmCustomerSession,
  peekWarmCustomerSession,
  warmCustomerSession,
} from '@/utils/warmCustomerSession';
import { MapPin, Package, User } from 'lucide-react';
import AccountWishlistSection from '@/components/Account/AccountWishlistSection';

export default function AccountPageClient() {
  const router = useRouter();
  const customerMobile = useStaffPortalStore((s) => s.customerMobile);
  const openAccountModal = useStaffPortalStore((s) => s.openAccountModal);
  const [mobile, setMobile] = useState<string | null>(null);
  const [profile, setProfile] = useState<SavedCheckoutProfile | null>(null);
  const [activeOrders, setActiveOrders] = useState<
    Array<{ id: string; orderNumber: string; status: string; grandTotal: number; createdAt: string; itemCount: number }>
  >([]);
  const [activeCount, setActiveCount] = useState(0);
  const [notices, setNotices] = useState<Array<{ id: string; message: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);

  const load = useCallback(async () => {
    const cached = peekWarmCustomerSession();
    if (cached?.mobile) {
      setMobile(cached.mobile);
      setProfile(cached.profile);
      setActiveCount(cached.activeCount);
      setActiveOrders(cached.activeOrders ?? []);
      setNotices(cached.notices);
      setLoading(false);
    }

    const warm = await warmCustomerSession({
      force: !getWarmCustomerSession()?.mobile,
    });

    const resolvedMobile = warm.mobile || customerMobile || null;
    setMobile(resolvedMobile);

    if (!resolvedMobile) {
      setLoading(false);
      return;
    }

    setProfile(warm.profile);
    setActiveCount(warm.activeCount);
    setActiveOrders(warm.activeOrders ?? []);
    setNotices(warm.notices);
    setLoading(false);
  }, [customerMobile]);

  useEffect(() => {
    load();
  }, [load, customerMobile]);

  async function handleTrackOrder() {
    setTracking(true);
    try {
      const warm = await warmCustomerSession({ force: true });
      if (!warm.mobile) {
        openAccountModal();
        return;
      }
      const orders = warm.activeOrders ?? [];
      setActiveCount(warm.activeCount);
      setActiveOrders(orders);
      if (orders.length === 0) {
        router.push('/account/track');
        return;
      }
      if (orders.length === 1) {
        router.push(`/account/track/${orders[0].id}`);
        return;
      }
      router.push('/account/track');
    } finally {
      setTracking(false);
    }
  }

  const loggedIn = Boolean(mobile);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your details and track orders</p>
          </div>
          {activeCount > 0 && (
            <Button
              onClick={handleTrackOrder}
              disabled={tracking}
              className="shrink-0 gap-2"
            >
              <Package className="w-4 h-4" />
              {tracking ? 'Loading...' : 'Track My Order'}
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : !loggedIn ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">Log in with your mobile number to view your account and track orders.</p>
            <Button onClick={openAccountModal}>Continue with mobile</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.length > 0 && (
              <section className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
                <h2 className="font-semibold text-red-800 text-sm">Order updates</h2>
                {notices.map((notice) => (
                  <p key={notice.id} className="text-sm text-red-700">
                    {notice.message}
                  </p>
                ))}
                <p className="text-[11px] text-red-500">These notices are shown for 24 hours after cancellation.</p>
              </section>
            )}
            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-blinkit-green" />
                Account
              </h2>
              <p className="text-sm text-gray-600">
                Mobile: <span className="font-medium text-gray-900">+91 {mobile}</span>
              </p>
              {activeCount > 0 && (
                <p className="text-sm text-blinkit-green font-medium mt-2">
                  {activeCount} active order{activeCount === 1 ? '' : 's'} in progress
                </p>
              )}
            </section>

            {activeOrders.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blinkit-green" />
                  Active orders
                </h2>
                <ul className="space-y-2">
                  {activeOrders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/account/track/${order.id}`}
                        className="block rounded-xl border border-gray-100 p-3 hover:border-blinkit-green/40"
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(order.createdAt)}</p>
                            <p className="text-xs text-gray-500">
                              {order.itemCount} item{order.itemCount === 1 ? '' : 's'} ·{' '}
                              {order.status.replace(/_/g, ' ').toLowerCase()}
                            </p>
                          </div>
                          <p className="font-semibold text-blinkit-green">{formatCurrency(order.grandTotal)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <AccountWishlistSection />

            {profile ? (
              <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h2 className="font-semibold text-gray-900">Saved details</h2>
                <p className="text-sm">
                  <span className="text-gray-500">Name:</span>{' '}
                  <span className="font-medium">{formatCustomerName(profile.firstName, profile.lastName)}</span>
                </p>
                <p className="text-sm flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>
                    {profile.houseNumber}, {profile.street}, {profile.area}
                    {profile.landmark ? `, ${profile.landmark}` : ''}
                    <br />
                    {profile.city}, {profile.state} — {profile.pincode}
                  </span>
                </p>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/checkout">Edit at checkout</Link>
                </Button>
              </section>
            ) : (
              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-sm text-gray-500">No saved address yet. Your details will be saved after your first checkout.</p>
                <Button asChild variant="secondary" size="sm" className="mt-3">
                  <Link href="/checkout">Place an order</Link>
                </Button>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
