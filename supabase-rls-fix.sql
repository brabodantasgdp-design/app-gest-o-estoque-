-- ============================================
-- FIX: RLS Policies corrigidas
-- Execute este SQL no painel do Supabase
-- DEPOIS de rodar o supabase-schema.sql
-- ============================================

-- ============================================
-- REMOVER POLICIES ANTIGAS (que davam acesso total)
-- ============================================
DROP POLICY IF EXISTS "Super admin full access" ON tenants;
DROP POLICY IF EXISTS "Super admin full access" ON users;
DROP POLICY IF EXISTS "Super admin full access" ON insumos;
DROP POLICY IF EXISTS "Super admin full access" ON fichas_tecnicas;
DROP POLICY IF EXISTS "Super admin full access" ON recipe_ingredients;
DROP POLICY IF EXISTS "Super admin full access" ON products;
DROP POLICY IF EXISTS "Super admin full access" ON orders;
DROP POLICY IF EXISTS "Super admin full access" ON order_items;
DROP POLICY IF EXISTS "Super admin full access" ON invoices;
DROP POLICY IF EXISTS "Super admin full access" ON invoice_items;

-- Remover policies antigas de tenant isolation
DROP POLICY IF EXISTS "Tenant isolation" ON insumos;
DROP POLICY IF EXISTS "Tenant isolation" ON fichas_tecnicas;
DROP POLICY IF EXISTS "Tenant isolation" ON products;
DROP POLICY IF EXISTS "Tenant isolation" ON orders;
DROP POLICY IF EXISTS "Tenant isolation" ON invoices;

-- ============================================
-- HELPER: Funcao pra checar se eh super admin
-- ============================================
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HELPER: Funcao pra pegar o tenant_id do usuario logado
-- ============================================
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- TENANTS - Super admin gerencia tudo
-- ============================================
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (
    is_super_admin() OR id = get_user_tenant_id()
  );

CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (is_super_admin());

CREATE POLICY "tenants_delete" ON tenants
  FOR DELETE USING (is_super_admin());

-- ============================================
-- USERS - Super admin ve tudo, lojista ve so a si
-- ============================================
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    is_super_admin() OR id = auth.uid()
  );

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (is_super_admin() OR id = auth.uid());

CREATE POLICY "users_delete" ON users
  FOR DELETE USING (is_super_admin());

-- ============================================
-- INSUMOS - Isolamento por tenant
-- ============================================
CREATE POLICY "insumos_select" ON insumos
  FOR SELECT USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "insumos_insert" ON insumos
  FOR INSERT WITH CHECK (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "insumos_update" ON insumos
  FOR UPDATE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "insumos_delete" ON insumos
  FOR DELETE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

-- ============================================
-- FICHAS TECNICAS - Isolamento por tenant
-- ============================================
CREATE POLICY "fichas_select" ON fichas_tecnicas
  FOR SELECT USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "fichas_insert" ON fichas_tecnicas
  FOR INSERT WITH CHECK (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "fichas_update" ON fichas_tecnicas
  FOR UPDATE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "fichas_delete" ON fichas_tecnicas
  FOR DELETE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

-- ============================================
-- RECIPE INGREDIENTS - Atraves da ficha tecnica
-- ============================================
CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients
  FOR SELECT USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM fichas_tecnicas WHERE id = ficha_tecnica_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "recipe_ingredients_insert" ON recipe_ingredients
  FOR INSERT WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM fichas_tecnicas WHERE id = ficha_tecnica_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "recipe_ingredients_update" ON recipe_ingredients
  FOR UPDATE USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM fichas_tecnicas WHERE id = ficha_tecnica_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "recipe_ingredients_delete" ON recipe_ingredients
  FOR DELETE USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM fichas_tecnicas WHERE id = ficha_tecnica_id AND tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- PRODUCTS - Isolamento por tenant
-- ============================================
CREATE POLICY "products_select" ON products
  FOR SELECT USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "products_update" ON products
  FOR UPDATE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "products_delete" ON products
  FOR DELETE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

-- ============================================
-- ORDERS - Isolamento por tenant
-- ============================================
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "orders_delete" ON orders
  FOR DELETE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

-- ============================================
-- ORDER ITEMS - Atraves do pedido
-- ============================================
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM orders WHERE id = order_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM orders WHERE id = order_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "order_items_update" ON order_items
  FOR UPDATE USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM orders WHERE id = order_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "order_items_delete" ON order_items
  FOR DELETE USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM orders WHERE id = order_id AND tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- INVOICES - Isolamento por tenant
-- ============================================
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (
    is_super_admin() OR tenant_id = get_user_tenant_id()
  );

-- ============================================
-- INVOICE ITEMS - Atraves da nota fiscal
-- ============================================
CREATE POLICY "invoice_items_select" ON invoice_items
  FOR SELECT USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM invoices WHERE id = invoice_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "invoice_items_insert" ON invoice_items
  FOR INSERT WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM invoices WHERE id = invoice_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "invoice_items_update" ON invoice_items
  FOR UPDATE USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM invoices WHERE id = invoice_id AND tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "invoice_items_delete" ON invoice_items
  FOR DELETE USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM invoices WHERE id = invoice_id AND tenant_id = get_user_tenant_id()
    )
  );
