-- ============================================
-- SCHEMA COMPLETO - EBD ElBravoDantas SaaS
-- Execute este SQL no painel do Supabase
-- ============================================

-- Limpar tabelas antigas se existirem
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS fichas_tecnicas CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS insumos CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- ============================================
-- 1. TENANTS (Lojas/Estabelecimentos)
-- ============================================
CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cnpj_store TEXT,
  plan TEXT DEFAULT 'Gratuito' CHECK (plan IN ('Gratuito', 'Pro', 'Enterprise')),
  status TEXT DEFAULT 'Trial' CHECK (status IN ('Ativo', 'Trial', 'Suspenso', 'Cancelado')),
  access_days_remaining INTEGER DEFAULT 30,
  expiration_date DATE,
  max_monthly_scans INTEGER DEFAULT 30,
  scans_used_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. USERS (Usuários do sistema)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'store_owner' CHECK (role IN ('super_admin', 'store_owner', 'employee')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. INSUMOS (Matérias-primas)
-- ============================================
CREATE TABLE insumos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'un')),
  current_stock FLOAT DEFAULT 0,
  min_stock FLOAT DEFAULT 0,
  unit_cost FLOAT DEFAULT 0,
  supplier TEXT,
  last_updated DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- ============================================
-- 4. FICHAS TÉCNICAS (Receitas e Precificação)
-- ============================================
CREATE TABLE fichas_tecnicas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  yield_quantity FLOAT DEFAULT 1,
  waste_margin_percent FLOAT DEFAULT 5,
  operational_overhead_percent FLOAT DEFAULT 15,
  tax_percent FLOAT DEFAULT 8,
  raw_insumo_cost FLOAT DEFAULT 0,
  total_production_cost FLOAT DEFAULT 0,
  target_profit_margin_percent FLOAT DEFAULT 60,
  calculated_price FLOAT DEFAULT 0,
  final_price FLOAT DEFAULT 0,
  net_profit_per_unit FLOAT DEFAULT 0,
  profit_margin_rate FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- ============================================
-- 5. RECIPE INGREDIENTES (Itens da receita)
-- ============================================
CREATE TABLE recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_tecnica_id UUID NOT NULL REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  insumo_name TEXT NOT NULL,
  quantity FLOAT NOT NULL,
  unit TEXT NOT NULL,
  calculated_cost FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. PRODUCTS (Produtos finais)
-- ============================================
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sku TEXT NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  old_price FLOAT DEFAULT 0,
  sale_discount_percent FLOAT DEFAULT 0,
  new_price FLOAT DEFAULT 0,
  items_sold INTEGER DEFAULT 0,
  ficha_tecnica_id UUID REFERENCES fichas_tecnicas(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'In Stock' CHECK (status IN ('In Stock', 'Low Stock', 'Out of Stock')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, sku)
);

-- ============================================
-- 7. ORDERS (Pedidos)
-- ============================================
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  total_amount FLOAT DEFAULT 0,
  status TEXT DEFAULT 'Processing' CHECK (status IN ('Delivered', 'Processing', 'Shipped', 'Cancelled')),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, order_number)
);

-- ============================================
-- 8. ORDER ITEMS (Itens do pedido)
-- ============================================
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 9. INVOICES (Notas Fiscais)
-- ============================================
CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  cnpj TEXT,
  invoice_number TEXT NOT NULL,
  invoice_date DATE,
  total_amount FLOAT DEFAULT 0,
  category TEXT DEFAULT 'outros',
  notes TEXT,
  image_url TEXT,
  processed BOOLEAN DEFAULT false,
  processed_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, invoice_number)
);

-- ============================================
-- 10. INVOICE ITEMS (Itens da nota fiscal)
-- ============================================
CREATE TABLE invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  raw_name TEXT NOT NULL,
  matched_insumo_name TEXT,
  quantity FLOAT DEFAULT 0,
  unit TEXT DEFAULT 'un',
  unit_cost FLOAT DEFAULT 0,
  total_cost FLOAT DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 11. RLS (Row Level Security)
-- ============================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin') $$;

CREATE OR REPLACE FUNCTION public.my_tenant_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.users WHERE id = auth.uid() $$;

CREATE POLICY "Users self or superadmin" ON users FOR SELECT USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Users managed by superadmin" ON users FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "Users updated by superadmin" ON users FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users deleted by superadmin" ON users FOR DELETE USING (public.is_super_admin());
CREATE POLICY "Tenants visible to member or superadmin" ON tenants FOR SELECT USING (public.is_super_admin() OR id = public.my_tenant_id());
CREATE POLICY "Tenants managed by superadmin" ON tenants FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Insumos tenant isolation" ON insumos FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY "Fichas tenant isolation" ON fichas_tecnicas FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY "Products tenant isolation" ON products FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY "Orders tenant isolation" ON orders FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY "Invoices tenant isolation" ON invoices FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY "Recipe tenant isolation" ON recipe_ingredients FOR ALL USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM fichas_tecnicas f WHERE f.id = ficha_tecnica_id AND f.tenant_id = public.my_tenant_id())) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM fichas_tecnicas f WHERE f.id = ficha_tecnica_id AND f.tenant_id = public.my_tenant_id()));
CREATE POLICY "Order items tenant isolation" ON order_items FOR ALL USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.tenant_id = public.my_tenant_id())) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.tenant_id = public.my_tenant_id()));
CREATE POLICY "Invoice items tenant isolation" ON invoice_items FOR ALL USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.tenant_id = public.my_tenant_id())) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.tenant_id = public.my_tenant_id()));

-- ============================================
-- 12. INDEXES para performance
-- ============================================
CREATE INDEX idx_insumos_tenant ON insumos(tenant_id);
CREATE INDEX idx_fichas_tenant ON fichas_tecnicas(tenant_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);
