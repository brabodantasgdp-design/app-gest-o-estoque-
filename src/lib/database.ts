import { supabase, isConfigured } from './supabase';
import type { Tenant, Insumo, FichaTecnica, Product, Order, InvoiceScan, User, RecipeItem } from '../types';

// ============================================
// TABLE NAMES (PascalCase for Supabase)
// ============================================
const TABLES = {
  TENANT: 'Tenant',
  INSUMO: 'Insumo',
  FICHA: 'FichaTecnica',
  RECIPE_INGREDIENT: 'RecipeIngredient',
  PRODUCT: 'Product',
  ORDER: 'Order',
  ORDER_ITEM: 'OrderItem',
  INVOICE: 'Invoice',
  INVOICE_ITEM: 'InvoiceItem',
  USER: 'User',
};

// ============================================
// LOCAL STORAGE HELPERS (fallback when Supabase offline)
// ============================================
function loadLocal<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function saveLocal<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}
function genId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================
// AUTH
// ============================================
export const authService = {
  async login(email: string, password: string) {
    const adminEmail = import.meta.env.SUPABASE_ADMIN_EMAIL || 'brabo.dantas.gdp@gmail.com';
    const adminPassword = import.meta.env.SUPABASE_ADMIN_PASSWORD || '87849244';

    // Super admin
    if (email === adminEmail && password === adminPassword) {
      const userData = { id: 'usr-superadmin', name: 'Brabo Dantas', email, role: 'super_admin' as const, tenantId: undefined, tenantName: 'Painel Global SaaS' };
      localStorage.setItem('ebd_current_user', JSON.stringify(userData));
      return { success: true, user: userData };
    }

    // Regular user lookup
    if (!isConfigured) return { success: false, message: 'Sistema offline' };

    try {
      const { data: user, error } = await supabase.from(TABLES.USER).select('id,name,email,role,tenant_id').eq('email', email).single();
      if (error || !user) return { success: false, message: 'Usuario nao encontrado. Verifique o email.' };

      let tenantName = '';
      if (user.tenant_id) {
        const { data: t } = await supabase.from(TABLES.TENANT).select('name').eq('id', user.tenant_id).single();
        tenantName = t?.name || '';
      }

      const userData = { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenant_id, tenantName };
      localStorage.setItem('ebd_current_user', JSON.stringify(userData));
      return { success: true, user: userData };
    } catch (err: any) {
      return { success: false, message: 'Erro ao buscar usuario: ' + (err.message || '') };
    }
  },

  async logout() {
    localStorage.removeItem('ebd_current_user');
    if (!isConfigured) return;
    try { await supabase.auth.signOut(); } catch (_) {}
  },

  async getCurrentUser() {
    // Try localStorage first (session persistence without Supabase Auth)
    try {
      const stored = localStorage.getItem('ebd_current_user');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (_) {}

    // Try Supabase Auth if configured
    if (!isConfigured) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: userData } = await supabase
        .from(TABLES.USER)
        .select('*')
        .eq('id', user.id)
        .single();
      if (!userData) return null;
      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        tenantId: userData.tenant_id,
        tenantName: '',
      };
    } catch (_) {
      return null;
    }
  }
};

// ============================================
// TENANTS
// ============================================
export const tenantsService = {
  async getAll() {
    if (!isConfigured) return loadLocal<Tenant>('ebd_tenants');
    try {
      const { data, error } = await supabase.from(TABLES.TENANT).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const tenants = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        ownerName: t.owner_name,
        email: t.email,
        password: t.password,
        cnpjStore: t.cnpj_store,
        plan: t.plan,
        status: t.status,
        accessDaysRemaining: t.access_days_remaining,
        expirationDate: t.expiration_date,
        maxMonthlyScans: t.max_monthly_scans,
        scansUsedThisMonth: t.scans_used_this_month,
        createdAt: t.created_at,
      })) as Tenant[];
      saveLocal('ebd_tenants', tenants);
      return tenants;
    } catch (err) {
      console.error('tenantsService.getAll error:', err);
      return loadLocal<Tenant>('ebd_tenants');
    }
  },

  async create(tenant: Omit<Tenant, 'id' | 'createdAt'>) {
    if (!isConfigured) {
      const local: Tenant = { ...tenant, id: genId(), createdAt: new Date().toISOString() } as Tenant;
      const all = loadLocal<Tenant>('ebd_tenants');
      all.push(local);
      saveLocal('ebd_tenants', all);
      return local;
    }
    const { data, error } = await supabase.from(TABLES.TENANT).insert({
      name: tenant.name,
      owner_name: tenant.ownerName,
      email: tenant.email,
      password: tenant.password,
      cnpj_store: tenant.cnpjStore,
      plan: tenant.plan,
      status: tenant.status,
      access_days_remaining: tenant.accessDaysRemaining,
      expiration_date: tenant.expirationDate,
      max_monthly_scans: tenant.maxMonthlyScans,
      scans_used_this_month: tenant.scansUsedThisMonth,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Tenant>) {
    if (!isConfigured) {
      const all = loadLocal<Tenant>('ebd_tenants');
      const idx = all.findIndex(t => t.id === id);
      if (idx >= 0) { all[idx] = { ...all[idx], ...updates }; saveLocal('ebd_tenants', all); }
      return all[idx];
    }
    const { data, error } = await supabase.from(TABLES.TENANT).update({
      name: updates.name,
      cnpj_store: updates.cnpjStore,
      plan: updates.plan,
      status: updates.status,
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) {
      const all = loadLocal<Tenant>('ebd_tenants');
      saveLocal('ebd_tenants', all.filter(t => t.id !== id));
      return;
    }
    const { error } = await supabase.from(TABLES.TENANT).delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// INSUMOS
// ============================================
export const insumosService = {
  async getAll(tenantId: string) {

    if (!isConfigured) return loadLocal<Insumo>('ebd_insumos').filter(i => i.tenantId === tenantId);
    try {
      const { data, error } = await supabase
        .from(TABLES.INSUMO)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) {
        console.error('Erro ao buscar insumos:', error.message);
        throw error;
      }

      return (data || []).map(i => ({
        id: i.id,
        tenantId: i.tenant_id,
        code: i.code,
        name: i.name,
        category: i.category,
        unit: i.unit,
        currentStock: i.current_stock,
        minStock: i.min_stock,
        unitCost: i.unit_cost,
        supplier: i.supplier,
        lastUpdated: i.last_updated,
      })) as Insumo[];
    } catch (err) {
      return loadLocal<Insumo>('ebd_insumos').filter(i => i.tenantId === tenantId);
    }
  },

  async getByTenant(tenantId: string) {
    return this.getAll(tenantId);
  },

  async create(insumo: Omit<Insumo, 'id'>) {
    if (!isConfigured) {
      const local = { ...insumo, id: genId() } as Insumo;
      const all = loadLocal<Insumo>('ebd_insumos');
      all.push(local);
      saveLocal('ebd_insumos', all);
      return local;
    }
    
    const { data, error } = await supabase.from(TABLES.INSUMO).insert({
      tenant_id: insumo.tenantId,
      code: insumo.code,
      name: insumo.name,
      category: insumo.category,
      unit: insumo.unit,
      current_stock: insumo.currentStock,
      min_stock: insumo.minStock,
      unit_cost: insumo.unitCost,
      supplier: insumo.supplier,
      last_updated: insumo.lastUpdated,
    }).select().single();
    
    if (error) {
      console.error('Erro ao criar insumo:', error.message);
      throw error;
    }
    
    return data;
  },

  async update(id: string, updates: Partial<Insumo>) {
    if (!isConfigured) {
      const all = loadLocal<Insumo>('ebd_insumos');
      const idx = all.findIndex(i => i.id === id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], ...updates };
        saveLocal('ebd_insumos', all);
      }
      return all[idx];
    }
    const { data, error } = await supabase.from(TABLES.INSUMO).update({
      name: updates.name,
      category: updates.category,
      unit: updates.unit,
      current_stock: updates.currentStock,
      min_stock: updates.minStock,
      unit_cost: updates.unitCost,
      supplier: updates.supplier,
      last_updated: updates.lastUpdated,
    }).eq('id', id).eq('tenant_id', (updates as any).tenantId).select().single();
    if (error) {
      console.error('insumosService.update error:', error);
      throw error;
    }
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) {
      const all = loadLocal<Insumo>('ebd_insumos');
      saveLocal('ebd_insumos', all.filter(i => i.id !== id));
      return;
    }
    const { data: record } = await supabase.from(TABLES.INSUMO).select('tenant_id').eq('id', id).single();
    if (!record) return;
    const { error } = await supabase.from(TABLES.INSUMO).delete().eq('id', id).eq('tenant_id', record.tenant_id);
    if (error) throw error;
  },
};

// ============================================
// FICHAS TECNICAS
// ============================================
export const fichasService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return loadLocal<FichaTecnica>('ebd_fichas').filter(f => f.tenantId === tenantId);
    try {
      const { data, error } = await supabase
        .from(TABLES.FICHA)
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      
      // Fetch ingredients separately for each ficha
      const fichas: FichaTecnica[] = [];
      for (const f of (data || [])) {
        const { data: ings } = await supabase
          .from(TABLES.RECIPE_INGREDIENT)
          .select('*')
          .eq('ficha_id', f.id);
        fichas.push({
          id: f.id,
          tenantId: f.tenant_id,
          productName: f.product_name,
          code: f.code,
          category: f.category,
          yieldQuantity: f.yield_quantity,
          ingredients: (ings || []).map((ing: any) => ({
            insumoId: ing.insumo_id,
            insumoName: ing.insumo_name,
            quantity: ing.quantity,
            unit: ing.unit,
            calculatedCost: ing.calculated_cost,
          })),
          rawInsumoCost: f.raw_insumo_cost,
          wasteMarginPercent: f.waste_margin_percent,
          operationalOverheadPercent: f.operational_overhead_percent,
          taxPercent: f.tax_percent,
          totalProductionCost: f.total_production_cost,
          targetProfitMarginPercent: f.target_profit_margin_percent,
          calculatedPrice: f.calculated_price,
          manualOverridePrice: f.manual_override_price,
          finalPrice: f.final_price,
          netProfitPerUnit: f.net_profit_per_unit,
          profitMarginRate: f.profit_margin_rate,
        } as FichaTecnica);
      }
      saveLocal('ebd_fichas', fichas);
      return fichas;
    } catch (err) {
      console.error('fichasService.getAll error:', err);
      return loadLocal<FichaTecnica>('ebd_fichas').filter(f => f.tenantId === tenantId);
    }
  },

  async getByTenant(tenantId: string) {
    return this.getAll(tenantId);
  },

  async create(ficha: Omit<FichaTecnica, 'id'>, ingredients: RecipeItem[]) {
    if (!isConfigured) {
      const local = { ...ficha, id: genId(), ingredients } as FichaTecnica;
      const all = loadLocal<FichaTecnica>('ebd_fichas');
      all.push(local);
      saveLocal('ebd_fichas', all);
      return local;
    }
    
    const { data: fichaData, error: fichaError } = await supabase.from(TABLES.FICHA).insert({
      tenant_id: ficha.tenantId,
      product_name: ficha.productName,
      code: ficha.code,
      category: ficha.category,
      yield_quantity: ficha.yieldQuantity,
      raw_insumo_cost: ficha.rawInsumoCost,
      waste_margin_percent: ficha.wasteMarginPercent,
      operational_overhead_percent: ficha.operationalOverheadPercent,
      tax_percent: ficha.taxPercent,
      total_production_cost: ficha.totalProductionCost,
      target_profit_margin_percent: ficha.targetProfitMarginPercent,
      calculated_price: ficha.calculatedPrice,
      manual_override_price: ficha.manualOverridePrice,
      final_price: ficha.finalPrice,
      net_profit_per_unit: ficha.netProfitPerUnit,
      profit_margin_rate: ficha.profitMarginRate,
    }).select().single();

    if (fichaError) {
      console.error('fichasService.create error:', fichaError);
      throw fichaError;
    }

    if (ingredients.length > 0 && fichaData) {
      const { error: ingError } = await supabase.from(TABLES.RECIPE_INGREDIENT).insert(ingredients.map(ing => ({
        ficha_id: fichaData.id,
        insumo_id: ing.insumoId,
        insumo_name: ing.insumoName,
        quantity: ing.quantity,
        unit: ing.unit,
        calculated_cost: ing.calculatedCost,
      })));
      if (ingError) throw ingError;
    }

    return fichaData;
  },

  async update(id: string, updates: Partial<FichaTecnica>) {
    if (!isConfigured) {
      const all = loadLocal<FichaTecnica>('ebd_fichas');
      const idx = all.findIndex(f => f.id === id);
      if (idx >= 0) { all[idx] = { ...all[idx], ...updates }; saveLocal('ebd_fichas', all); }
      return all[idx];
    }
    const { data, error } = await supabase.from(TABLES.FICHA).update({
      product_name: updates.productName,
      category: updates.category,
      yield_quantity: updates.yieldQuantity,
      raw_insumo_cost: updates.rawInsumoCost,
      waste_margin_percent: updates.wasteMarginPercent,
      operational_overhead_percent: updates.operationalOverheadPercent,
      tax_percent: updates.taxPercent,
      total_production_cost: updates.totalProductionCost,
      target_profit_margin_percent: updates.targetProfitMarginPercent,
      calculated_price: updates.calculatedPrice,
      manual_override_price: updates.manualOverridePrice,
      final_price: updates.finalPrice,
      net_profit_per_unit: updates.netProfitPerUnit,
      profit_margin_rate: updates.profitMarginRate,
    }).eq('id', id).eq('tenant_id', (updates as any).tenantId).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) {
      const all = loadLocal<FichaTecnica>('ebd_fichas');
      saveLocal('ebd_fichas', all.filter(f => f.id !== id));
      return;
    }
    const { data: record } = await supabase.from(TABLES.FICHA).select('tenant_id').eq('id', id).single();
    if (!record) return;
    const { error } = await supabase.from(TABLES.FICHA).delete().eq('id', id).eq('tenant_id', record.tenant_id);
    if (error) throw error;
  },
};

// ============================================
// PRODUCTS
// ============================================
export const productsService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return loadLocal<Product>('ebd_products').filter(p => p.tenantId === tenantId);
    try {
      const { data, error } = await supabase
        .from(TABLES.PRODUCT)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
      const products = (data || []).map(p => ({
        id: p.id,
        tenantId: p.tenant_id,
        name: p.name,
        category: p.category,
        sku: p.sku,
        stockQuantity: p.stock_quantity,
        oldPrice: p.old_price,
        saleDiscountPercent: p.sale_discount_percent,
        newPrice: p.new_price,
        itemsSold: p.items_sold,
        fichaTecnicaId: p.ficha_tecnica_id,
        status: p.status,
        image: p.image,
      })) as Product[];
      saveLocal('ebd_products', products);
      return products;
    } catch (err) {
      console.error('productsService.getAll error:', err);
      return loadLocal<Product>('ebd_products').filter(p => p.tenantId === tenantId);
    }
  },

  async getByTenant(tenantId: string) {
    return this.getAll(tenantId);
  },

  async create(product: Omit<Product, 'id'>) {
    if (!isConfigured) {
      const local = { ...product, id: genId() } as Product;
      const all = loadLocal<Product>('ebd_products');
      all.push(local);
      saveLocal('ebd_products', all);
      return local;
    }
    const { data, error } = await supabase.from(TABLES.PRODUCT).insert({
      tenant_id: product.tenantId,
      name: product.name,
      category: product.category,
      sku: product.sku,
      stock_quantity: product.stockQuantity,
      old_price: product.oldPrice,
      sale_discount_percent: product.saleDiscountPercent,
      new_price: product.newPrice,
      items_sold: product.itemsSold,
      ficha_tecnica_id: product.fichaTecnicaId,
      status: product.status,
      image: product.image,
    }).select().single();
    if (error) {
      console.error('productsService.create error:', error);
      throw error;
    }
    return data;
  },

  async update(id: string, updates: Partial<Product>) {
    if (!isConfigured) {
      const all = loadLocal<Product>('ebd_products');
      const idx = all.findIndex(p => p.id === id);
      if (idx >= 0) { all[idx] = { ...all[idx], ...updates }; saveLocal('ebd_products', all); }
      return all[idx];
    }
    const { data, error } = await supabase.from(TABLES.PRODUCT).update({
      name: updates.name,
      category: updates.category,
      stock_quantity: updates.stockQuantity,
      new_price: updates.newPrice,
      status: updates.status,
    }).eq('id', id).eq('tenant_id', (updates as any).tenantId).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) {
      const all = loadLocal<Product>('ebd_products');
      saveLocal('ebd_products', all.filter(p => p.id !== id));
      return;
    }
    const { data: record } = await supabase.from(TABLES.PRODUCT).select('tenant_id').eq('id', id).single();
    if (!record) return;
    const { error } = await supabase.from(TABLES.PRODUCT).delete().eq('id', id).eq('tenant_id', record.tenant_id);
    if (error) throw error;
  },
};

// ============================================
// ORDERS
// ============================================
export const ordersService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return loadLocal<Order>('ebd_orders').filter(o => o.tenantId === tenantId);
    try {
      const { data, error } = await supabase
        .from(TABLES.ORDER)
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      
      const orders: Order[] = [];
      for (const o of (data || [])) {
        const { data: items } = await supabase
          .from(TABLES.ORDER_ITEM)
          .select('*')
          .eq('order_id', o.id);
        orders.push({
          id: o.id,
          tenantId: o.tenant_id,
          orderNumber: o.order_number || `#${o.id?.toString().slice(-6)}`,
          customerName: o.customer_name,
          customerEmail: o.customer_email || '',
          totalAmount: o.total_amount,
          status: o.status,
          date: o.created_at?.split('T')[0] || '',
          timeAgo: 'algum tempo',
          items: (items || []).map((item: any) => ({
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
          })),
        } as Order);
      }
      saveLocal('ebd_orders', orders);
      return orders;
    } catch (err) {
      console.error('ordersService.getAll error:', err);
      return loadLocal<Order>('ebd_orders').filter(o => o.tenantId === tenantId);
    }
  },

  async getByTenant(tenantId: string) {
    return this.getAll(tenantId);
  },

  async create(order: Omit<Order, 'id' | 'createdAt'>) {
    if (!isConfigured) {
      const local = { ...order, id: genId(), createdAt: new Date().toISOString() } as Order;
      const all = loadLocal<Order>('ebd_orders');
      all.push(local);
      saveLocal('ebd_orders', all);
      return local;
    }
    
    const { data: orderData, error: orderError } = await supabase.from(TABLES.ORDER).insert({
      tenant_id: order.tenantId,
      customer_name: order.customerName,
      total_amount: order.totalAmount,
      status: order.status,
    }).select().single();

    if (orderError) throw orderError;

    if (order.items && order.items.length > 0 && orderData) {
      const { error: itemsError } = await supabase.from(TABLES.ORDER_ITEM).insert(order.items.map(item => ({
        order_id: orderData.id,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
      })));
      if (itemsError) throw itemsError;
    }

    return orderData;
  },

  async updateStatus(id: string, status: Order['status'], tenantId: string) {
    if (!isConfigured) {
      const all = loadLocal<Order>('ebd_orders');
      const idx = all.findIndex(o => o.id === id);
      if (idx >= 0) { all[idx] = { ...all[idx], status }; saveLocal('ebd_orders', all); }
      return all[idx];
    }
    const { data, error } = await supabase.from(TABLES.ORDER).update({ status }).eq('id', id).eq('tenant_id', tenantId).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) {
      const all = loadLocal<Order>('ebd_orders');
      saveLocal('ebd_orders', all.filter(o => o.id !== id));
      return;
    }
    const { data: record } = await supabase.from(TABLES.ORDER).select('tenant_id').eq('id', id).single();
    if (!record) return;
    const { error } = await supabase.from(TABLES.ORDER).delete().eq('id', id).eq('tenant_id', record.tenant_id);
    if (error) throw error;
  },
};

// ============================================
// INVOICES
// ============================================
export const invoicesService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return loadLocal<InvoiceScan>('ebd_invoices').filter(i => i.tenantId === tenantId);
    try {
      const { data, error } = await supabase
        .from(TABLES.INVOICE)
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      
      const invoices: InvoiceScan[] = [];
      for (const inv of (data || [])) {
        const { data: items } = await supabase
          .from(TABLES.INVOICE_ITEM)
          .select('*')
          .eq('invoice_id', inv.id);
        invoices.push({
          id: inv.id,
          tenantId: inv.tenant_id,
          supplierName: inv.supplier_name,
          cnpj: inv.cnpj,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.invoice_date,
          totalAmount: inv.total_amount,
          category: inv.category,
          notes: inv.notes,
          imageUrl: inv.image_url,
          processed: inv.processed,
          processedAt: inv.processed_at,
          items: (items || []).map((item: any) => ({
            rawName: item.raw_name,
            matchedInsumoName: item.matched_insumo_name,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unit_cost,
            totalCost: item.total_cost,
            category: item.category,
          })),
        } as InvoiceScan);
      }
      saveLocal('ebd_invoices', invoices);
      return invoices;
    } catch (err) {
      console.error('invoicesService.getAll error:', err);
      return loadLocal<InvoiceScan>('ebd_invoices').filter(i => i.tenantId === tenantId);
    }
  },

  async getByTenant(tenantId: string) {
    return this.getAll(tenantId);
  },

  async create(invoice: Omit<InvoiceScan, 'id'>) {
    if (!isConfigured) {
      const local = { ...invoice, id: genId() } as InvoiceScan;
      const all = loadLocal<InvoiceScan>('ebd_invoices');
      all.push(local);
      saveLocal('ebd_invoices', all);
      return local;
    }
    
    const { data: invoiceData, error: invoiceError } = await supabase.from(TABLES.INVOICE).insert({
      tenant_id: invoice.tenantId,
      supplier_name: invoice.supplierName,
      cnpj: invoice.cnpj,
      invoice_number: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate,
      total_amount: invoice.totalAmount,
      category: invoice.category,
      notes: invoice.notes,
      image_url: invoice.imageUrl,
      processed: invoice.processed,
      processed_at: invoice.processedAt,
    }).select().single();

    if (invoiceError) throw invoiceError;

    if (invoice.items && invoice.items.length > 0 && invoiceData) {
      const { error: itemsError } = await supabase.from(TABLES.INVOICE_ITEM).insert(invoice.items.map(item => ({
        invoice_id: invoiceData.id,
        raw_name: item.rawName,
        matched_insumo_name: item.matchedInsumoName,
        quantity: item.quantity,
        unit: item.unit,
        unit_cost: item.unitCost,
        total_cost: item.totalCost,
        category: item.category,
      })));
      if (itemsError) throw itemsError;
    }

    return invoiceData;
  },

  async update(id: string, updates: Partial<InvoiceScan>) {
    if (!isConfigured) {
      const all = loadLocal<InvoiceScan>('ebd_invoices');
      const idx = all.findIndex(i => i.id === id);
      if (idx >= 0) { all[idx] = { ...all[idx], ...updates }; saveLocal('ebd_invoices', all); }
      return all[idx];
    }
    const { data, error } = await supabase.from(TABLES.INVOICE).update({
      processed: updates.processed,
      processed_at: updates.processedAt,
    }).eq('id', id).eq('tenant_id', (updates as any).tenantId).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) {
      const all = loadLocal<InvoiceScan>('ebd_invoices');
      saveLocal('ebd_invoices', all.filter(i => i.id !== id));
      return;
    }
    const { data: record } = await supabase.from(TABLES.INVOICE).select('tenant_id').eq('id', id).single();
    if (!record) return;
    const { error } = await supabase.from(TABLES.INVOICE).delete().eq('id', id).eq('tenant_id', record.tenant_id);
    if (error) throw error;
  },
};

// ============================================
// USERS SERVICE
// ============================================
export const usersService = {
  async getAll() {
    if (!isConfigured) return loadLocal<any>('ebd_users');
    const { data, error } = await supabase.from(TABLES.USER).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getByTenant(tenantId: string) {
    if (!isConfigured) return loadLocal<any>('ebd_users').filter((u: any) => u.tenant_id === tenantId);
    const { data, error } = await supabase.from(TABLES.USER).select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(user: { name: string; email: string; role: string; tenant_id: string }) {
    if (!isConfigured) {
      const u = { id: genId(), ...user, created_at: new Date().toISOString() };
      const all = loadLocal<any>('ebd_users');
      all.push(u);
      saveLocal('ebd_users', all);
      return u;
    }
    const { data, error } = await supabase.from(TABLES.USER).insert(user).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: any) {
    if (!isConfigured) {
      const all = loadLocal<any>('ebd_users');
      const idx = all.findIndex((u: any) => u.id === id);
      if (idx >= 0) { all[idx] = { ...all[idx], ...updates }; saveLocal('ebd_users', all); }
      return all[idx];
    }
    const { data, error } = await supabase.from(TABLES.USER).update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) {
      const all = loadLocal<any>('ebd_users').filter((u: any) => u.id !== id);
      saveLocal('ebd_users', all);
      return;
    }
    const { error } = await supabase.from(TABLES.USER).delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// DATA FETCHER (for Voice Assistant)
// ============================================
export const dataFetcher = {
  async getAllForVoiceAssistant(tenantId: string) {
    const [insumos, products, orders, fichas, invoices] = await Promise.all([
      insumosService.getAll(tenantId),
      productsService.getAll(tenantId),
      ordersService.getAll(tenantId),
      fichasService.getAll(tenantId),
      invoicesService.getAll(tenantId),
    ]);
    return { insumos, products, orders, fichas, invoices };
  }
};
