-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_lat" DOUBLE PRECISION,
ADD COLUMN     "customer_lng" DOUBLE PRECISION,
ADD COLUMN     "order_source" TEXT NOT NULL DEFAULT 'website';

-- AlterTable
ALTER TABLE "staff_accounts" ADD COLUMN     "assigned_areas" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "assigned_city" TEXT,
ADD COLUMN     "delivery_radius_km" DOUBLE PRECISION,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
