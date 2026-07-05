'use client';

import Link from 'next/link';
import { STORE_NAME } from '@/constants';
import { useStaffPortalStore } from '@/store/staffPortalStore';

export default function Footer() {
  const staffEligible = useStaffPortalStore((s) => s.staffEligible);

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-8">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-gray-900 mb-3 text-sm">Useful Links</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="#" className="hover:text-blinkit-green">About</Link></li>
              <li><Link href="#" className="hover:text-blinkit-green">Careers</Link></li>
              {staffEligible && (
                <li><Link href="/admin" className="hover:text-blinkit-green">Admin</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-3 text-sm">Categories</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/category/vegetables" className="hover:text-blinkit-green">Vegetables</Link></li>
              <li><Link href="/category/fruits" className="hover:text-blinkit-green">Fruits</Link></li>
              <li><Link href="/category/dairy" className="hover:text-blinkit-green">Dairy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-3 text-sm">Customer Support</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="#" className="hover:text-blinkit-green">FAQ</Link></li>
              <li><Link href="#" className="hover:text-blinkit-green">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-3 text-sm">Download App</h4>
            <p className="text-sm text-gray-600">Get groceries delivered in minutes</p>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-6 text-center">
          <p className="text-xs text-gray-500">© {STORE_NAME}, 2024–2026. Groceries delivered to your doorstep.</p>
        </div>
      </div>
    </footer>
  );
}
