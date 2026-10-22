'use client';

import Link from 'next/link';
import { CUSTOMER_DELIVERY_PROMISE, STORE_NAME } from '@/constants';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import BrandLockup from '@/components/Brand/BrandLockup';

export default function Footer() {
  const staffEligible = useStaffPortalStore((s) => s.staffEligible);
  const adminSessionActive = useStaffPortalStore((s) => s.adminSessionActive);
  const showAdminEntry = staffEligible || adminSessionActive;

  return (
    <footer className="bg-forest text-paper mt-10">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <BrandLockup tone="paper" className="mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className="font-display font-semibold text-paper mb-3 text-sm">Useful Links</h4>
            <ul className="space-y-2 text-sm text-paper/75">
              <li><Link href="#" className="hover:text-carrot">About</Link></li>
              <li><Link href="#" className="hover:text-carrot">Careers</Link></li>
              {showAdminEntry && (
                <li><Link href="/admin/dashboard" className="hover:text-carrot">Admin</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-paper mb-3 text-sm">Categories</h4>
            <ul className="space-y-2 text-sm text-paper/75">
              <li><Link href="/category/vegetables" className="hover:text-carrot">Vegetables</Link></li>
              <li><Link href="/category/fruits" className="hover:text-carrot">Fruits</Link></li>
              <li><Link href="/category/dairy" className="hover:text-carrot">Dairy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-paper mb-3 text-sm">Customer Support</h4>
            <ul className="space-y-2 text-sm text-paper/75">
              <li><Link href="#" className="hover:text-carrot">FAQ</Link></li>
              <li><Link href="#" className="hover:text-carrot">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-paper mb-3 text-sm">Delivery</h4>
            <p className="text-sm text-paper/75">{CUSTOMER_DELIVERY_PROMISE}</p>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center">
          <p className="text-xs text-paper/60">© {STORE_NAME}, 2024–2026. Groceries delivered to your doorstep.</p>
        </div>
      </div>
    </footer>
  );
}
