-- Lot tracking: per-location lot balances + lot_id on stock_movement.
-- Lot info is OPTIONAL: code paths fall back to lot-less behavior when a
-- product has no lots, so existing flows keep working.

ALTER TABLE "stock_movement"
  ADD COLUMN "lot_id" BIGINT;
ALTER TABLE "stock_movement"
  ADD CONSTRAINT "stock_movement_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "product_lot"("lot_id");
CREATE INDEX "stock_movement_lot_id_idx" ON "stock_movement"("lot_id");

CREATE TABLE "warehouse_stock_lot" (
  "warehouse_stock_lot_id" BIGSERIAL PRIMARY KEY,
  "warehouse_id"           BIGINT       NOT NULL,
  "lot_id"                 BIGINT       NOT NULL,
  "qty_on_hand"            DECIMAL(18,2) NOT NULL DEFAULT 0,
  "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouse_stock_lot_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("warehouse_id"),
  CONSTRAINT "warehouse_stock_lot_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "product_lot"("lot_id"),
  CONSTRAINT "warehouse_stock_lot_qty_nonneg" CHECK ("qty_on_hand" >= 0)
);
CREATE UNIQUE INDEX "warehouse_stock_lot_warehouse_id_lot_id_key"
  ON "warehouse_stock_lot"("warehouse_id", "lot_id");
CREATE INDEX "warehouse_stock_lot_warehouse_id_idx"
  ON "warehouse_stock_lot"("warehouse_id");
CREATE INDEX "warehouse_stock_lot_lot_id_idx"
  ON "warehouse_stock_lot"("lot_id");

CREATE TABLE "consignment_stock_lot" (
  "consignment_stock_lot_id" BIGSERIAL PRIMARY KEY,
  "customer_id"              BIGINT       NOT NULL,
  "lot_id"                   BIGINT       NOT NULL,
  "qty_on_hand"              DECIMAL(18,2) NOT NULL DEFAULT 0,
  "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consignment_stock_lot_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id"),
  CONSTRAINT "consignment_stock_lot_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "product_lot"("lot_id"),
  CONSTRAINT "consignment_stock_lot_qty_nonneg" CHECK ("qty_on_hand" >= 0)
);
CREATE UNIQUE INDEX "consignment_stock_lot_customer_id_lot_id_key"
  ON "consignment_stock_lot"("customer_id", "lot_id");
CREATE INDEX "consignment_stock_lot_customer_id_idx"
  ON "consignment_stock_lot"("customer_id");
CREATE INDEX "consignment_stock_lot_lot_id_idx"
  ON "consignment_stock_lot"("lot_id");
