-- =====================================================================
-- Extra integrity rules not expressible in Prisma schema directly.
-- Check constraints, sequences for document numbers, and helper views.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Numeric domain checks
-- ---------------------------------------------------------------------

ALTER TABLE "product"
  ADD CONSTRAINT "product_cost_nonneg" CHECK ("cost" >= 0),
  ADD CONSTRAINT "product_selling_price_nonneg" CHECK ("selling_price" >= 0),
  ADD CONSTRAINT "product_min_stock_nonneg" CHECK ("min_stock" >= 0),
  ADD CONSTRAINT "product_max_stock_nonneg" CHECK ("max_stock" >= 0);

ALTER TABLE "customer"
  ADD CONSTRAINT "customer_credit_limit_nonneg" CHECK ("credit_limit" >= 0),
  ADD CONSTRAINT "customer_credit_term_nonneg" CHECK ("credit_term_days" >= 0),
  ADD CONSTRAINT "customer_visit_freq_nonneg" CHECK ("visit_frequency_days" >= 0),
  ADD CONSTRAINT "customer_max_capacity_nonneg" CHECK ("max_capacity_qty" >= 0);

ALTER TABLE "inventory_balance"
  ADD CONSTRAINT "inventory_on_hand_nonneg" CHECK ("qty_on_hand" >= 0),
  ADD CONSTRAINT "inventory_reserved_nonneg" CHECK ("qty_reserved" >= 0),
  ADD CONSTRAINT "inventory_reserved_le_onhand" CHECK ("qty_reserved" <= "qty_on_hand"),
  ADD CONSTRAINT "inventory_available_consistent"
    CHECK ("qty_available" = "qty_on_hand" - "qty_reserved");

ALTER TABLE "consignment_stock"
  ADD CONSTRAINT "consignment_on_hand_nonneg" CHECK ("qty_on_hand" >= 0);

ALTER TABLE "stock_movement"
  ADD CONSTRAINT "movement_qty_in_nonneg" CHECK ("qty_in" >= 0),
  ADD CONSTRAINT "movement_qty_out_nonneg" CHECK ("qty_out" >= 0),
  ADD CONSTRAINT "movement_exactly_one_side"
    CHECK (("qty_in" = 0) <> ("qty_out" = 0)),
  ADD CONSTRAINT "movement_location_present"
    CHECK ("warehouse_id" IS NOT NULL OR "customer_id" IS NOT NULL),
  ADD CONSTRAINT "movement_balance_nonneg" CHECK ("balance_after" >= 0);

ALTER TABLE "sales_visit_item"
  ADD CONSTRAINT "svi_qty_nonneg" CHECK (
    "qty_before" >= 0 AND
    "qty_counted" >= 0 AND
    "qty_sold" >= 0 AND
    "qty_replenished" >= 0 AND
    "unit_price" >= 0 AND
    "sales_amount" >= 0
  ),
  ADD CONSTRAINT "svi_counted_le_before"
    CHECK ("qty_counted" <= "qty_before"),
  ADD CONSTRAINT "svi_sold_calc"
    CHECK ("qty_sold" = "qty_before" - "qty_counted");

ALTER TABLE "sales_visit"
  ADD CONSTRAINT "sv_total_sales_nonneg" CHECK ("total_sales_amount" >= 0);

ALTER TABLE "collection"
  ADD CONSTRAINT "collection_amount_nonneg"
    CHECK ("amount_collected" >= 0 AND "total_sales_amount" >= 0);

ALTER TABLE "ar_invoice"
  ADD CONSTRAINT "ar_invoice_total_nonneg" CHECK ("total_amount" >= 0),
  ADD CONSTRAINT "ar_invoice_outstanding_nonneg"
    CHECK ("outstanding_amount" >= 0),
  ADD CONSTRAINT "ar_invoice_outstanding_le_total"
    CHECK ("outstanding_amount" <= "total_amount"),
  ADD CONSTRAINT "ar_invoice_due_after_invoice"
    CHECK ("due_date" >= "invoice_date");

ALTER TABLE "ar_invoice_item"
  ADD CONSTRAINT "ar_item_qty_nonneg" CHECK ("qty" >= 0),
  ADD CONSTRAINT "ar_item_unit_price_nonneg" CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "ar_item_line_amount_nonneg" CHECK ("line_amount" >= 0),
  ADD CONSTRAINT "ar_item_line_calc"
    CHECK ("line_amount" = "qty" * "unit_price");

ALTER TABLE "ar_payment"
  ADD CONSTRAINT "ar_payment_amount_pos" CHECK ("payment_amount" > 0);

-- ---------------------------------------------------------------------
-- Document number sequences (decoupled from BIGSERIAL PK)
-- ---------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS "seq_visit_no"        START 1;
CREATE SEQUENCE IF NOT EXISTS "seq_invoice_no"      START 1;
CREATE SEQUENCE IF NOT EXISTS "seq_collection_no"   START 1;

-- ---------------------------------------------------------------------
-- Derived view: AR aging (OPEN/PARTIAL/OVERDUE buckets at query time)
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW "v_ar_aging" AS
SELECT
  i."ar_invoice_id",
  i."invoice_no",
  i."customer_id",
  c."customer_code",
  c."customer_name",
  i."invoice_date",
  i."due_date",
  i."total_amount",
  i."outstanding_amount",
  i."status",
  CASE
    WHEN i."status" = 'PAID' THEN 'PAID'
    WHEN i."status" = 'CANCELLED' THEN 'CANCELLED'
    WHEN i."outstanding_amount" > 0 AND i."due_date" < NOW() THEN 'OVERDUE'
    ELSE i."status"::text
  END AS "effective_status",
  GREATEST(0, DATE_PART('day', NOW() - i."due_date"))::int AS "days_overdue",
  CASE
    WHEN i."outstanding_amount" <= 0 OR i."status" IN ('PAID', 'CANCELLED') THEN 'CURRENT'
    WHEN i."due_date" >= NOW() THEN 'CURRENT'
    WHEN NOW() - i."due_date" <= INTERVAL '30 days'  THEN '1_30'
    WHEN NOW() - i."due_date" <= INTERVAL '60 days'  THEN '31_60'
    WHEN NOW() - i."due_date" <= INTERVAL '90 days'  THEN '61_90'
    ELSE 'OVER_90'
  END AS "aging_bucket"
FROM "ar_invoice" i
JOIN "customer" c ON c."customer_id" = i."customer_id";

-- ---------------------------------------------------------------------
-- Derived view: consignment stock value per customer (using selling_price)
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW "v_consignment_value" AS
SELECT
  cs."customer_id",
  SUM(cs."qty_on_hand" * p."selling_price")::numeric(18,2) AS "stock_value",
  SUM(cs."qty_on_hand")::numeric(18,2) AS "total_qty"
FROM "consignment_stock" cs
JOIN "product" p ON p."product_id" = cs."product_id"
GROUP BY cs."customer_id";

-- ---------------------------------------------------------------------
-- Derived view: customer credit exposure
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW "v_customer_exposure" AS
SELECT
  c."customer_id",
  c."customer_code",
  c."customer_name",
  c."credit_limit",
  c."credit_term_days",
  COALESCE(ar."outstanding", 0)::numeric(18,2) AS "ar_outstanding",
  COALESCE(cv."stock_value", 0)::numeric(18,2) AS "consignment_value",
  (COALESCE(ar."outstanding", 0) + COALESCE(cv."stock_value", 0))::numeric(18,2)
    AS "credit_exposure",
  GREATEST(
    0,
    c."credit_limit"
      - COALESCE(ar."outstanding", 0)
      - COALESCE(cv."stock_value", 0)
  )::numeric(18,2) AS "available_credit"
FROM "customer" c
LEFT JOIN (
  SELECT "customer_id", SUM("outstanding_amount") AS "outstanding"
  FROM "ar_invoice"
  WHERE "status" IN ('OPEN', 'PARTIAL')
  GROUP BY "customer_id"
) ar ON ar."customer_id" = c."customer_id"
LEFT JOIN "v_consignment_value" cv ON cv."customer_id" = c."customer_id";
