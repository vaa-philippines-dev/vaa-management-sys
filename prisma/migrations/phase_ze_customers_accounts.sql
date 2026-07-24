-- Phase ZE migration: Customer/Account mirror tables for the CMS's
-- "Customers" and "Clients" tabs (the latter labeled "Accounts" in this
-- app to avoid clashing with our own Client/"Client Assignment" model).
-- One Customer owns many Accounts (CustomerID FK, exactly as in the CMS);
-- one Account can have many Client Assignments (new clients.account_id).

CREATE TABLE IF NOT EXISTS "customers" (
  "id" TEXT NOT NULL,
  "external_customer_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT,
  "status_date" TIMESTAMP(3),
  "assigned_specialist" TEXT,
  "created_by_email" TEXT,
  "updated_by_email" TEXT,
  "notes" TEXT,
  "payment_date" TIMESTAMP(3),
  "no_payment_yet" BOOLEAN,
  "termination_count" INTEGER,
  "reactivation_count" INTEGER,
  "last_terminated_date" TIMESTAMP(3),
  "last_reactivated_date" TIMESTAMP(3),
  "last_status_reason" TEXT,
  "status_history" TEXT,
  "cms_created_at" TIMESTAMP(3),
  "cms_updated_at" TIMESTAMP(3),
  "raw" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'cms_sheet',
  "last_synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customers_external_customer_id_key" ON "customers"("external_customer_id");
CREATE INDEX IF NOT EXISTS "customers_name_idx" ON "customers"("name");
CREATE INDEX IF NOT EXISTS "customers_status_idx" ON "customers"("status");

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" TEXT NOT NULL,
  "external_account_id" TEXT NOT NULL,
  "external_customer_id" TEXT,
  "customer_id" TEXT,
  "customer_name" TEXT,
  "account_name" TEXT,
  "primary_contact" TEXT,
  "secondary_contact" TEXT,
  "company_name" TEXT,
  "account_managers" TEXT,
  "invoice_contact_name" TEXT,
  "invoice_contact_role" TEXT,
  "invoice_contact_email" TEXT,
  "category" TEXT,
  "type" TEXT,
  "country_region" TEXT,
  "status" TEXT,
  "status_date" TIMESTAMP(3),
  "is_returning" BOOLEAN,
  "notes" TEXT,
  "primary_role" TEXT,
  "primary_email" TEXT,
  "primary_is_focal" BOOLEAN,
  "secondary_role" TEXT,
  "secondary_email" TEXT,
  "secondary_is_focal" BOOLEAN,
  "primary_linked_to_customer" BOOLEAN,
  "termination_reason" TEXT,
  "seller_onboarding_link" TEXT,
  "contract_id" TEXT,
  "created_by_email" TEXT,
  "updated_by_email" TEXT,
  "cms_created_at" TIMESTAMP(3),
  "cms_updated_at" TIMESTAMP(3),
  "raw" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'cms_sheet',
  "last_synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_external_account_id_key" ON "accounts"("external_account_id");
CREATE INDEX IF NOT EXISTS "accounts_external_customer_id_idx" ON "accounts"("external_customer_id");
CREATE INDEX IF NOT EXISTS "accounts_customer_id_idx" ON "accounts"("customer_id");
CREATE INDEX IF NOT EXISTS "accounts_account_name_idx" ON "accounts"("account_name");
CREATE INDEX IF NOT EXISTS "accounts_company_name_idx" ON "accounts"("company_name");
CREATE INDEX IF NOT EXISTS "accounts_status_idx" ON "accounts"("status");

DO $$ BEGIN
  ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "account_id" TEXT;
CREATE INDEX IF NOT EXISTS "clients_account_id_idx" ON "clients"("account_id");

DO $$ BEGIN
  ALTER TABLE "clients"
    ADD CONSTRAINT "clients_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
