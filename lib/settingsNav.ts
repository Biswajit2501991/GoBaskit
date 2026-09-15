export const SETTINGS_NAV_SECTIONS = [
  {
    id: 'min-order',
    label: 'Min Order',
    group: 'Delivery',
    hint: 'Orders below this subtotal cannot be placed. Set 0 to turn the limit off.',
  },
  {
    id: 'pins',
    label: 'PIN Codes',
    group: 'Delivery',
    hint: 'Customers can only check out with one of these 6-digit delivery PIN codes.',
  },
  {
    id: 'cities',
    label: 'Cities',
    group: 'Delivery',
    hint: 'Delivery is allowed when the city or the PIN matches — either one is enough.',
  },
  {
    id: 'delivery-slabs',
    label: 'Delivery Fees',
    group: 'Delivery',
    hint: 'Fee by order subtotal (₹). The highest matching slab applies above its range.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Number',
    group: 'Orders',
    hint: 'Used for verification messages and order WhatsApp links. Digits only, with country code (for example 919046370119).',
  },
  {
    id: 'checkout',
    label: 'Checkout Mode',
    group: 'Orders',
    hint: 'Chooses which Place Order buttons customers see. The change applies on the next checkout load.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    group: 'Orders',
    hint: 'Staff new-order sound, plus a one-time broadcast to customers who enabled alerts. Broadcast does not change store settings.',
  },
  {
    id: 'session',
    label: 'Staff Session',
    group: 'Orders',
    hint: 'Keeps active staff logged in, and can sign them out after a period with no interaction.',
  },
  {
    id: 'store-status',
    label: 'Store Status',
    group: 'Orders',
    hint: 'Opening hours, holiday mode, and the overnight Accept/Decline prompt at checkout (India time).',
  },
  {
    id: 'shop-sourcing',
    label: 'Shop sourcing',
    group: 'Orders',
    hint: 'Off by default. When on, tagged shops get pickup offers and delivery needs the customer PIN.',
  },
  {
    id: 'partner-delivery',
    label: 'Partner delivery',
    group: 'Orders',
    hint: 'Off by default. When on, Delivery Partner accounts can use Start Delivery at /delivery. Jobs come in a later update.',
  },
  {
    id: 'delivery-otp',
    label: 'Delivery PIN',
    group: 'Orders',
    hint: 'Off by default. When on, every order gets a 4-digit PIN, it is pushed at Out for delivery, and staff must enter it to mark Delivered.',
  },
  {
    id: 'weather',
    label: 'Weather Notice',
    group: 'Orders',
    hint: 'Auto rain notice for the next 30 minutes on shop, cart, and checkout. It does not change orders or fees.',
  },
  {
    id: 'payments',
    label: 'Payments',
    group: 'Orders',
    hint: 'Checkout payment methods and the UPI details shown to signed-in customers.',
  },
  {
    id: 'wa-templates',
    label: 'WA Templates',
    group: 'Orders',
    hint: 'Quick-send WhatsApp wording used from order management. It does not place or change orders.',
  },
  {
    id: 'cancellation',
    label: 'Cancellation Policy',
    group: 'Orders',
    hint: 'Shown on the cart drawer and checkout. Leave blank to keep the default policy text.',
  },
  {
    id: 'featured',
    label: 'Discovery Rails',
    group: 'Homepage',
    hint: 'Top Discounted, Most Loved, and category rails on the customer home page. Most Loved uses Best Seller products.',
  },
  {
    id: 'health-star',
    label: 'Health Star',
    group: 'Homepage',
    hint: 'How rated products show the Health Star logo and stars on the storefront.',
  },
  {
    id: 'branding',
    label: 'Branding',
    group: 'Homepage',
    hint: 'Header “Powered by” ticker and the seal on the customer login screen.',
  },
  {
    id: 'seasonal',
    label: 'Seasonal',
    group: 'Homepage',
    hint: 'Storefront skin and promo strip only. Real discounts still need a coupon under Discounts & Coupons.',
  },
  {
    id: 'promo',
    label: 'Promo Cards',
    group: 'Homepage',
    hint: 'Home cards such as Pharmacy or Pet Care, with a link and a live on/off toggle.',
  },
  {
    id: 'homepage',
    label: 'Homepage Layout',
    group: 'Homepage',
    hint: 'Hero, categories, offers, announcement bar, delivery ETA copy, and theme colour.',
  },
  {
    id: 'discounts',
    label: 'Discounts & Coupons',
    group: 'Offers',
    hint: 'Coupons and membership discount. This section saves on its own, not with the main Save Settings button.',
  },
] as const;

export type SettingsNavSectionId = (typeof SETTINGS_NAV_SECTIONS)[number]['id'];
export type SettingsNavSection = (typeof SETTINGS_NAV_SECTIONS)[number];

export function settingsSectionAccessId(sectionId: string): string {
  return `settings:${sectionId}`;
}
