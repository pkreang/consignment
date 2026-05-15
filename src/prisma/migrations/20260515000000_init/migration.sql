-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('WAREHOUSE_ADJUSTMENT', 'PRODUCTION_RECEIPT', 'LOAD_TO_CUSTOMER', 'SALE_CONFIRMED', 'REPLENISHMENT', 'RETURN_FROM_CUSTOMER', 'CUSTOMER_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('DRAFT', 'CHECKED_IN', 'COUNTED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'QR_PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefDocType" AS ENUM ('ADJUSTMENT', 'PRODUCTION', 'LOAD', 'RETURN', 'VISIT', 'REPLENISH');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "product_category" (
    "category_id" BIGSERIAL NOT NULL,
    "category_code" VARCHAR(20) NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "product" (
    "product_id" BIGSERIAL NOT NULL,
    "sku_code" VARCHAR(50) NOT NULL,
    "barcode" VARCHAR(100),
    "product_name" VARCHAR(255) NOT NULL,
    "category_id" BIGINT,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'PCS',
    "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "selling_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shelf_life_days" INTEGER NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "max_stock" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "customer_group" (
    "group_id" BIGSERIAL NOT NULL,
    "group_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_group_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "customer" (
    "customer_id" BIGSERIAL NOT NULL,
    "customer_code" VARCHAR(50) NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "group_id" BIGINT,
    "owner_name" VARCHAR(255),
    "phone" VARCHAR(50),
    "line_id" VARCHAR(100),
    "address" TEXT,
    "province" VARCHAR(100),
    "latitude" DECIMAL(12,8),
    "longitude" DECIMAL(12,8),
    "visit_frequency_days" INTEGER NOT NULL DEFAULT 3,
    "max_capacity_qty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit_term_days" INTEGER NOT NULL DEFAULT 0,
    "credit_limit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "warehouse" (
    "warehouse_id" BIGSERIAL NOT NULL,
    "warehouse_code" VARCHAR(50) NOT NULL,
    "warehouse_name" VARCHAR(255) NOT NULL,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("warehouse_id")
);

-- CreateTable
CREATE TABLE "employee" (
    "employee_id" BIGSERIAL NOT NULL,
    "employee_code" VARCHAR(50) NOT NULL,
    "employee_name" VARCHAR(255) NOT NULL,
    "mobile_no" VARCHAR(50),
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "route" (
    "route_id" BIGSERIAL NOT NULL,
    "route_code" VARCHAR(50) NOT NULL,
    "route_name" VARCHAR(255) NOT NULL,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_pkey" PRIMARY KEY ("route_id")
);

-- CreateTable
CREATE TABLE "customer_route" (
    "customer_route_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "route_id" BIGINT NOT NULL,
    "visit_day" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_route_pkey" PRIMARY KEY ("customer_route_id")
);

-- CreateTable
CREATE TABLE "inventory_balance" (
    "inventory_id" BIGSERIAL NOT NULL,
    "warehouse_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "qty_on_hand" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qty_reserved" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qty_available" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_balance_pkey" PRIMARY KEY ("inventory_id")
);

-- CreateTable
CREATE TABLE "consignment_stock" (
    "consignment_stock_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "qty_on_hand" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "last_visit_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consignment_stock_pkey" PRIMARY KEY ("consignment_stock_id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "movement_id" BIGSERIAL NOT NULL,
    "movement_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movement_type" "MovementType" NOT NULL,
    "ref_doc_type" "RefDocType",
    "ref_doc_id" BIGINT,
    "warehouse_id" BIGINT,
    "customer_id" BIGINT,
    "product_id" BIGINT NOT NULL,
    "qty_in" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qty_out" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance_after" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(18,2),
    "unit_price" DECIMAL(18,2),
    "remark" TEXT,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("movement_id")
);

-- CreateTable
CREATE TABLE "sales_visit" (
    "visit_id" BIGSERIAL NOT NULL,
    "visit_no" VARCHAR(50) NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "employee_id" BIGINT NOT NULL,
    "route_id" BIGINT,
    "visit_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkin_time" TIMESTAMP(3),
    "checkout_time" TIMESTAMP(3),
    "gps_latitude" DECIMAL(12,8),
    "gps_longitude" DECIMAL(12,8),
    "visit_status" "VisitStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "photo_url" VARCHAR(500),
    "total_sales_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_visit_pkey" PRIMARY KEY ("visit_id")
);

-- CreateTable
CREATE TABLE "sales_visit_item" (
    "visit_item_id" BIGSERIAL NOT NULL,
    "visit_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "qty_before" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qty_counted" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qty_sold" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qty_replenished" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sales_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_visit_item_pkey" PRIMARY KEY ("visit_item_id")
);

-- CreateTable
CREATE TABLE "collection" (
    "collection_id" BIGSERIAL NOT NULL,
    "collection_no" VARCHAR(50) NOT NULL,
    "visit_id" BIGINT,
    "ar_invoice_id" BIGINT,
    "customer_id" BIGINT NOT NULL,
    "collection_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_sales_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount_collected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference_no" VARCHAR(100),
    "collected_by" BIGINT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("collection_id")
);

-- CreateTable
CREATE TABLE "ar_invoice" (
    "ar_invoice_id" BIGSERIAL NOT NULL,
    "invoice_no" VARCHAR(50) NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "visit_id" BIGINT,
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ar_invoice_pkey" PRIMARY KEY ("ar_invoice_id")
);

-- CreateTable
CREATE TABLE "ar_invoice_item" (
    "ar_invoice_item_id" BIGSERIAL NOT NULL,
    "ar_invoice_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "qty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ar_invoice_item_pkey" PRIMARY KEY ("ar_invoice_item_id")
);

-- CreateTable
CREATE TABLE "ar_payment" (
    "payment_id" BIGSERIAL NOT NULL,
    "ar_invoice_id" BIGINT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference_no" VARCHAR(100),
    "collection_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ar_payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "role" (
    "role_id" BIGSERIAL NOT NULL,
    "role_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "permission" (
    "permission_id" BIGSERIAL NOT NULL,
    "module_name" VARCHAR(100) NOT NULL,
    "action_name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_permission_id" BIGSERIAL NOT NULL,
    "role_id" BIGINT NOT NULL,
    "permission_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_permission_id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "user_id" BIGSERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(500) NOT NULL,
    "full_name" VARCHAR(255),
    "employee_id" BIGINT,
    "role_id" BIGINT,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "audit_id" BIGSERIAL NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" BIGINT,
    "action_type" "AuditAction" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "context" JSONB,
    "changed_by" BIGINT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "product_lot" (
    "lot_id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "lot_no" VARCHAR(100) NOT NULL,
    "manufacturing_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "qty_received" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qty_remaining" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_lot_pkey" PRIMARY KEY ("lot_id")
);

-- CreateTable
CREATE TABLE "customer_credit_history" (
    "credit_history_id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "old_credit_limit" DECIMAL(18,2),
    "new_credit_limit" DECIMAL(18,2),
    "old_credit_term" INTEGER,
    "new_credit_term" INTEGER,
    "reason" TEXT,
    "changed_by" BIGINT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credit_history_pkey" PRIMARY KEY ("credit_history_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_category_category_code_key" ON "product_category"("category_code");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_code_key" ON "product"("sku_code");

-- CreateIndex
CREATE INDEX "product_category_id_idx" ON "product"("category_id");

-- CreateIndex
CREATE INDEX "product_sku_code_idx" ON "product"("sku_code");

-- CreateIndex
CREATE INDEX "product_active_flag_idx" ON "product"("active_flag");

-- CreateIndex
CREATE UNIQUE INDEX "customer_customer_code_key" ON "customer"("customer_code");

-- CreateIndex
CREATE INDEX "customer_customer_code_idx" ON "customer"("customer_code");

-- CreateIndex
CREATE INDEX "customer_group_id_idx" ON "customer"("group_id");

-- CreateIndex
CREATE INDEX "customer_active_flag_idx" ON "customer"("active_flag");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_warehouse_code_key" ON "warehouse"("warehouse_code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_employee_code_key" ON "employee"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "route_route_code_key" ON "route"("route_code");

-- CreateIndex
CREATE INDEX "customer_route_customer_id_idx" ON "customer_route"("customer_id");

-- CreateIndex
CREATE INDEX "customer_route_route_id_idx" ON "customer_route"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_route_customer_id_route_id_key" ON "customer_route"("customer_id", "route_id");

-- CreateIndex
CREATE INDEX "inventory_balance_product_id_idx" ON "inventory_balance"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balance_warehouse_id_product_id_key" ON "inventory_balance"("warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "consignment_stock_customer_id_idx" ON "consignment_stock"("customer_id");

-- CreateIndex
CREATE INDEX "consignment_stock_product_id_idx" ON "consignment_stock"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "consignment_stock_customer_id_product_id_key" ON "consignment_stock"("customer_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_movement_product_id_idx" ON "stock_movement"("product_id");

-- CreateIndex
CREATE INDEX "stock_movement_customer_id_idx" ON "stock_movement"("customer_id");

-- CreateIndex
CREATE INDEX "stock_movement_warehouse_id_idx" ON "stock_movement"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_movement_movement_date_idx" ON "stock_movement"("movement_date");

-- CreateIndex
CREATE INDEX "stock_movement_movement_type_movement_date_idx" ON "stock_movement"("movement_type", "movement_date");

-- CreateIndex
CREATE INDEX "stock_movement_ref_doc_type_ref_doc_id_idx" ON "stock_movement"("ref_doc_type", "ref_doc_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_visit_visit_no_key" ON "sales_visit"("visit_no");

-- CreateIndex
CREATE INDEX "sales_visit_customer_id_idx" ON "sales_visit"("customer_id");

-- CreateIndex
CREATE INDEX "sales_visit_employee_id_idx" ON "sales_visit"("employee_id");

-- CreateIndex
CREATE INDEX "sales_visit_visit_date_idx" ON "sales_visit"("visit_date");

-- CreateIndex
CREATE INDEX "sales_visit_visit_status_idx" ON "sales_visit"("visit_status");

-- CreateIndex
CREATE INDEX "sales_visit_customer_id_visit_date_idx" ON "sales_visit"("customer_id", "visit_date");

-- CreateIndex
CREATE INDEX "sales_visit_employee_id_visit_date_idx" ON "sales_visit"("employee_id", "visit_date");

-- CreateIndex
CREATE INDEX "sales_visit_item_visit_id_idx" ON "sales_visit_item"("visit_id");

-- CreateIndex
CREATE INDEX "sales_visit_item_product_id_idx" ON "sales_visit_item"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_visit_item_visit_id_product_id_key" ON "sales_visit_item"("visit_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_collection_no_key" ON "collection"("collection_no");

-- CreateIndex
CREATE INDEX "collection_customer_id_idx" ON "collection"("customer_id");

-- CreateIndex
CREATE INDEX "collection_collection_date_idx" ON "collection"("collection_date");

-- CreateIndex
CREATE INDEX "collection_visit_id_idx" ON "collection"("visit_id");

-- CreateIndex
CREATE INDEX "collection_ar_invoice_id_idx" ON "collection"("ar_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "ar_invoice_invoice_no_key" ON "ar_invoice"("invoice_no");

-- CreateIndex
CREATE INDEX "ar_invoice_customer_id_idx" ON "ar_invoice"("customer_id");

-- CreateIndex
CREATE INDEX "ar_invoice_status_idx" ON "ar_invoice"("status");

-- CreateIndex
CREATE INDEX "ar_invoice_due_date_idx" ON "ar_invoice"("due_date");

-- CreateIndex
CREATE INDEX "ar_invoice_customer_id_status_idx" ON "ar_invoice"("customer_id", "status");

-- CreateIndex
CREATE INDEX "ar_invoice_item_ar_invoice_id_idx" ON "ar_invoice_item"("ar_invoice_id");

-- CreateIndex
CREATE INDEX "ar_payment_ar_invoice_id_idx" ON "ar_payment"("ar_invoice_id");

-- CreateIndex
CREATE INDEX "ar_payment_payment_date_idx" ON "ar_payment"("payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "role_role_name_key" ON "role"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_key" ON "role_permission"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_username_key" ON "app_user"("username");

-- CreateIndex
CREATE INDEX "audit_log_table_name_idx" ON "audit_log"("table_name");

-- CreateIndex
CREATE INDEX "audit_log_record_id_idx" ON "audit_log"("record_id");

-- CreateIndex
CREATE INDEX "audit_log_changed_at_idx" ON "audit_log"("changed_at");

-- CreateIndex
CREATE INDEX "product_lot_product_id_idx" ON "product_lot"("product_id");

-- CreateIndex
CREATE INDEX "product_lot_expiry_date_idx" ON "product_lot"("expiry_date");

-- CreateIndex
CREATE INDEX "customer_credit_history_customer_id_idx" ON "customer_credit_history"("customer_id");

-- CreateIndex
CREATE INDEX "customer_credit_history_changed_at_idx" ON "customer_credit_history"("changed_at");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_category"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "customer_group"("group_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_route" ADD CONSTRAINT "customer_route_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_route" ADD CONSTRAINT "customer_route_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("route_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_stock" ADD CONSTRAINT "consignment_stock_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_stock" ADD CONSTRAINT "consignment_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("warehouse_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_visit" ADD CONSTRAINT "sales_visit_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_visit" ADD CONSTRAINT "sales_visit_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_visit" ADD CONSTRAINT "sales_visit_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("route_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_visit_item" ADD CONSTRAINT "sales_visit_item_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "sales_visit"("visit_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_visit_item" ADD CONSTRAINT "sales_visit_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "sales_visit"("visit_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_ar_invoice_id_fkey" FOREIGN KEY ("ar_invoice_id") REFERENCES "ar_invoice"("ar_invoice_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_collected_by_fkey" FOREIGN KEY ("collected_by") REFERENCES "employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoice" ADD CONSTRAINT "ar_invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoice" ADD CONSTRAINT "ar_invoice_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "sales_visit"("visit_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoice_item" ADD CONSTRAINT "ar_invoice_item_ar_invoice_id_fkey" FOREIGN KEY ("ar_invoice_id") REFERENCES "ar_invoice"("ar_invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_invoice_item" ADD CONSTRAINT "ar_invoice_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_payment" ADD CONSTRAINT "ar_payment_ar_invoice_id_fkey" FOREIGN KEY ("ar_invoice_id") REFERENCES "ar_invoice"("ar_invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("role_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "app_user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lot" ADD CONSTRAINT "product_lot_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_history" ADD CONSTRAINT "customer_credit_history_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_history" ADD CONSTRAINT "customer_credit_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "app_user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

