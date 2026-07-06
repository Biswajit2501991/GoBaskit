import OrderTrackDetailClient from '@/components/Account/OrderTrackDetailClient';

export const metadata = {
  title: 'Order Tracking — GoBaskit',
};

type PageProps = { params: Promise<{ orderId: string }> };

export default async function OrderTrackDetailPage({ params }: PageProps) {
  const { orderId } = await params;
  return <OrderTrackDetailClient orderId={orderId} />;
}
