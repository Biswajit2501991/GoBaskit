-- Discount engine: coupons, membership usage, audit logs, and order discount columns.

CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "CouponStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "OrderDiscountType" AS ENUM ('NONE', 'COUPON', 'MEMBERSHIP');

ALTER TABLE "orders" ADD COLUMN "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "discount_type" "OrderDiscountType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "orders" ADD COLUMN "coupon_code" TEXT;
ALTER TABLE "orders" ADD COLUMN "membership_member_id" TEXT;

CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "coupon_code" TEXT NOT NULL,
    "discount_type" "CouponDiscountType" NOT NULL,
    "discount_value" DOUBLE PRECISION NOT NULL,
    "max_discount" DOUBLE PRECISION,
    "minimum_order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "status" "CouponStatus" NOT NULL DEFAULT 'ACTIVE',
    "usage_limit_per_mobile" INTEGER NOT NULL DEFAULT 3,
    "total_usage_limit" INTEGER,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupons_coupon_code_key" ON "coupons"("coupon_code");
CREATE INDEX "coupons_status_expiry_date_idx" ON "coupons"("status", "expiry_date");

CREATE TABLE "coupon_usage" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "discount_amount" DOUBLE PRECISION NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coupon_usage_coupon_id_mobile_idx" ON "coupon_usage"("coupon_id", "mobile");
CREATE INDEX "coupon_usage_order_id_idx" ON "coupon_usage"("order_id");
CREATE INDEX "coupon_usage_mobile_used_at_idx" ON "coupon_usage"("mobile", "used_at");

ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "membership_discount_usage" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "member_id" TEXT,
    "order_id" TEXT NOT NULL,
    "discount_amount" DOUBLE PRECISION NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_discount_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "membership_discount_usage_mobile_used_at_idx" ON "membership_discount_usage"("mobile", "used_at");
CREATE INDEX "membership_discount_usage_order_id_idx" ON "membership_discount_usage"("order_id");

CREATE TABLE "discount_logs" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "mobile" TEXT,
    "coupon_code" TEXT,
    "membership" BOOLEAN NOT NULL DEFAULT false,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_type" "OrderDiscountType" NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL,
    "applied_by" TEXT NOT NULL DEFAULT 'system',
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discount_logs_order_id_idx" ON "discount_logs"("order_id");
CREATE INDEX "discount_logs_mobile_created_at_idx" ON "discount_logs"("mobile", "created_at");
CREATE INDEX "discount_logs_created_at_idx" ON "discount_logs"("created_at");
