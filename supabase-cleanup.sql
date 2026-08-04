-- ============================================================
-- EBD APP - DATABASE CLEANUP SCRIPT
-- Remove duplicate tables and standardize to PascalCase
-- Execute this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: DROP OLD DUPLICATE TABLES (lowercase/portuguese)
-- ============================================================

-- Drop tables in correct order (respect foreign keys)
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS fichas_tecnicas CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS insumos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;

-- ============================================================
-- STEP 2: CREATE CORRECT TABLES (PascalCase)
-- ============================================================

-- Tenants
CREATE TABLE IF NOT EXISTS "Tenant" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  cnpj_store TEXT,
  plan TEXT DEFAULT 'Gratuito',
  status TEXT DEFAULT 'Ativo',
  access_days_remaining INTEGER DEFAULT 30,
  expiration_date DATE,
  max_monthly_scans INTEGER DEFAULT 50,
  scans_used_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insumos (Ingredients)
CREATE TABLE IF NOT EXISTS "Insumo" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES "Tenant"(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Geral',
  unit TEXT DEFAULT 'g',
  current_stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  supplier TEXT,
  last_updated DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fichas Técnicas (Recipes)
CREATE TABLE IF NOT EXISTS "FichaTecnica" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES "Tenant"(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  code TEXT,
  category TEXT,
  yield_quantity NUMERIC DEFAULT 1,
  raw_insumo_cost NUMERIC DEFAULT 0,
  waste_margin_percent NUMERIC DEFAULT 5,
  operational_overhead_percent NUMERIC DEFAULT 15,
  tax_percent NUMERIC DEFAULT 8,
  total_production_cost NUMERIC DEFAULT 0,
  target_profit_margin_percent NUMERIC DEFAULT 60,
  calculated_price NUMERIC DEFAULT 0,
  manual_override_price NUMERIC,
  final_price NUMERIC DEFAULT 0,
  net_profit_per_unit NUMERIC DEFAULT 0,
  profit_margin_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipe Ingredients
CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id UUID REFERENCES "FichaTecnica"(id) ON DELETE CASCADE,
  insumo_id UUID REFERENCES "Insumo"(id),
  insumo_name TEXT,
  quantity NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'g',
  calculated_cost NUMERIC DEFAULT 0
);

-- Products
CREATE TABLE IF NOT EXISTS "Product" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES "Tenant"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Geral',
  sku TEXT,
  stock_quantity INTEGER DEFAULT 0,
  old_price NUMERIC DEFAULT 0,
  sale_discount_percent NUMERIC DEFAULT 0,
  new_price NUMERIC DEFAULT 0,
  items_sold INTEGER DEFAULT 0,
  ficha_tecnica_id UUID REFERENCES "FichaTecnica"(id),
  status TEXT DEFAULT 'In Stock',
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS "Order" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES "Tenant"(id) ON DELETE CASCADE,
  customer_name TEXT,
  total_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS "OrderItem" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES "Order"(id) ON DELETE CASCADE,
  product_name TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0
);

-- Invoices (Notas Fiscais)
CREATE TABLE IF NOT EXISTS "Invoice" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES "Tenant"(id) ON DELETE CASCADE,
  supplier_name TEXT,
  cnpj TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  total_amount NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'insumos',
  notes TEXT,
  image_url TEXT,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Items
CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES "Invoice"(id) ON DELETE CASCADE,
  raw_name TEXT,
  matched_insumo_name TEXT,
  quantity NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'g',
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  category TEXT
);

-- ============================================================
-- STEP 3: CREATE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_insumo_tenant ON "Insumo"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_tenant ON "Product"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_tenant ON "Order"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_tenant ON "Invoice"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ficha_tenant ON "FichaTecnica"(tenant_id);

-- ============================================================
-- STEP 4: ENABLE RLS (Row Level Security)
-- ============================================================

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Insumo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FichaTecnica" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecipeIngredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceItem" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: CREATE RLS POLICIES (allow all for now)
-- ============================================================

CREATE POLICY "Allow all" ON "Tenant" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Insumo" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "FichaTecnica" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "RecipeIngredient" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Product" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Order" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "OrderItem" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Invoice" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "InvoiceItem" FOR ALL USING (true);

-- ============================================================
-- STEP 6: VERIFY
-- ============================================================

SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
