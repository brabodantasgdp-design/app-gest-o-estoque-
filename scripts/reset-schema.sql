-- EBD canonical schema. WARNING: deletes all application data.
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS fichas_tecnicas CASCADE;
DROP TABLE IF EXISTS insumos CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  cnpj_store TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'Gratuito' CHECK (plan IN ('Gratuito','Pro','Enterprise')),
  status TEXT NOT NULL DEFAULT 'Trial' CHECK (status IN ('Ativo','Trial','Suspenso','Cancelado')),
  access_days_remaining INTEGER NOT NULL DEFAULT 30,
  expiration_date DATE,
  max_monthly_scans INTEGER NOT NULL DEFAULT 30,
  scans_used_this_month INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin','store_owner','employee')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE insumos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  unit TEXT NOT NULL CHECK (unit IN ('g','ml','un')),
  current_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  min_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE fichas_tecnicas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  yield_quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  waste_margin_percent DOUBLE PRECISION NOT NULL DEFAULT 5,
  operational_overhead_percent DOUBLE PRECISION NOT NULL DEFAULT 15,
  tax_percent DOUBLE PRECISION NOT NULL DEFAULT 8,
  raw_insumo_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_production_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  target_profit_margin_percent DOUBLE PRECISION NOT NULL DEFAULT 60,
  calculated_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  final_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_profit_per_unit DOUBLE PRECISION NOT NULL DEFAULT 0,
  profit_margin_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_tecnica_id UUID NOT NULL REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  insumo_name TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g','ml','un')),
  calculated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  sku TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  old_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  sale_discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  new_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  items_sold INTEGER NOT NULL DEFAULT 0,
  ficha_tecnica_id UUID REFERENCES fichas_tecnicas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'In Stock' CHECK (status IN ('In Stock','Low Stock','Out of Stock')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Processing' CHECK (status IN ('Pendente','Delivered','Processing','Shipped','Cancelled')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  cnpj TEXT NOT NULL DEFAULT '',
  invoice_number TEXT NOT NULL,
  invoice_date DATE,
  total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'outros',
  notes TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  raw_name TEXT NOT NULL,
  matched_insumo_name TEXT,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'un' CHECK (unit IN ('g','ml','un')),
  unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE POLICY users_self_or_admin ON users FOR SELECT USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY users_insert_self_or_admin ON users FOR INSERT WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY users_update_self_or_admin ON users FOR UPDATE USING (id = auth.uid() OR public.is_super_admin()) WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY users_delete_admin ON users FOR DELETE USING (public.is_super_admin());

CREATE POLICY tenants_admin_or_member ON tenants FOR SELECT USING (public.is_super_admin() OR id = public.my_tenant_id());
CREATE POLICY tenants_admin_write ON tenants FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY insumos_tenant ON insumos FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY fichas_tenant ON fichas_tecnicas FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY products_tenant ON products FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY orders_tenant ON orders FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY invoices_tenant ON invoices FOR ALL USING (public.is_super_admin() OR tenant_id = public.my_tenant_id()) WITH CHECK (public.is_super_admin() OR tenant_id = public.my_tenant_id());
CREATE POLICY recipe_tenant ON recipe_ingredients FOR ALL USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM fichas_tecnicas f WHERE f.id = ficha_tecnica_id AND f.tenant_id = public.my_tenant_id())) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM fichas_tecnicas f WHERE f.id = ficha_tecnica_id AND f.tenant_id = public.my_tenant_id()));
CREATE POLICY order_items_tenant ON order_items FOR ALL USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.tenant_id = public.my_tenant_id())) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.tenant_id = public.my_tenant_id()));
CREATE POLICY invoice_items_tenant ON invoice_items FOR ALL USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.tenant_id = public.my_tenant_id())) WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.tenant_id = public.my_tenant_id()));

CREATE INDEX insumos_tenant_idx ON insumos(tenant_id);
CREATE INDEX products_tenant_idx ON products(tenant_id);
CREATE INDEX orders_tenant_idx ON orders(tenant_id);
CREATE INDEX invoices_tenant_idx ON invoices(tenant_id);
CREATE INDEX users_tenant_idx ON users(tenant_id);

-- Apos executar este arquivo, crie o super admin em Authentication > Users
-- usando o email definido pelo proprietário. O app cria o perfil public.users no primeiro login.
