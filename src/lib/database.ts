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
// AUTH
// ============================================
export const authService = {
  async login(email: string, password: string) {
    if (!isConfigured) {
      if (email === 'brabo.dantas.gdp@gmail.com' && password === '87849244') {
        return {
          success: true,
          user: {
            id: 'usr-superadmin',
            name: 'Brabo Dantas',
            email: email,
            role: 'super_admin' as const,
            tenantId: undefined,
            tenantName: 'Painel Global SaaS',
          }
        };
      }
      return { success: false, message: 'Supabase nao configurado. Use credenciais do super admin.' };
    }

    try {
      const { data: user, error } = await supabase
        .from(TABLES.USER)
        .select('*, Tenant(*)')
        .eq('email', email)
        .single();

      if (error || !user) {
        return { success: false, message: 'Usuario nao encontrado' };
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return { success: false, message: 'Credenciais invalidas. Verifique email e senha.' };
      }

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.Tenant?.name || '',
        }
      };
    } catch (err) {
      return { success: false, message: 'Erro ao conectar com o servidor.' };
    }
  },

  async logout() {
    if (!isConfigured) return;
    try { await supabase.auth.signOut(); } catch (_) {}
  },

  async getCurrentUser() {
    if (!isConfigured) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: userData } = await supabase
        .from(TABLES.USER)
        .select('*, Tenant(*)')
        .eq('id', user.id)
        .single();
      if (!userData) return null;
      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        tenantId: userData.tenant_id,
        tenantName: userData.Tenant?.name || '',
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
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from(TABLES.TENANT).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        id: t.id,
        cnpjStore: t.cnpj_store,
        plan: t.plan,
        status: t.status,
        accessDaysRemaining: t.access_days_remaining,
        expirationDate: t.expiration_date,
        maxMonthlyScans: t.max_monthly_scans,
        scansUsedThisMonth: t.scans_used_this_month,
        createdAt: t.created_at,
      })) as Tenant[];
    } catch { return []; }
  },

  async create(tenant: Omit<Tenant, 'id' | 'createdAt'>) {
    if (!isConfigured) return null;
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
    if (!isConfigured) return null;
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
    if (!isConfigured) return;
    const { error } = await supabase.from(TABLES.TENANT).delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// INSUMOS
// ============================================
export const insumosService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.INSUMO)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
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
    } catch { return []; }
  },

  async create(insumo: Omit<Insumo, 'id'>) {
    if (!isConfigured) return null;
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
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Insumo>) {
    if (!isConfigured) return null;
    const { data, error } = await supabase.from(TABLES.INSUMO).update({
      name: updates.name,
      category: updates.category,
      unit: updates.unit,
      current_stock: updates.currentStock,
      min_stock: updates.minStock,
      unit_cost: updates.unitCost,
      supplier: updates.supplier,
      last_updated: updates.lastUpdated,
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) return;
    const { error } = await supabase.from(TABLES.INSUMO).delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// FICHAS TECNICAS
// ============================================
export const fichasService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.FICHA)
        .select('*, RecipeIngredient(*)')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data || []).map(f => ({
        id: f.id,
        tenantId: f.tenant_id,
        productName: f.product_name,
        code: f.code,
        category: f.category,
        yieldQuantity: f.yield_quantity,
        ingredients: (f.RecipeIngredient || []).map((ing: any) => ({
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
      })) as FichaTecnica[];
    } catch { return []; }
  },

  async create(ficha: Omit<FichaTecnica, 'id'>, ingredients: RecipeItem[]) {
    if (!isConfigured) return null;
    
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

    if (fichaError) throw fichaData;

    // Insert ingredients
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
    if (!isConfigured) return null;
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
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) return;
    const { error } = await supabase.from(TABLES.FICHA).delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// PRODUCTS
// ============================================
export const productsService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.PRODUCT)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
      return (data || []).map(p => ({
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
    } catch { return []; }
  },

  async create(product: Omit<Product, 'id'>) {
    if (!isConfigured) return null;
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
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Product>) {
    if (!isConfigured) return null;
    const { data, error } = await supabase.from(TABLES.PRODUCT).update({
      name: updates.name,
      category: updates.category,
      stock_quantity: updates.stockQuantity,
      new_price: updates.newPrice,
      status: updates.status,
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) return;
    const { error } = await supabase.from(TABLES.PRODUCT).delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// ORDERS
// ============================================
export const ordersService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.ORDER)
        .select('*, OrderItem(*)')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data || []).map(o => ({
        id: o.id,
        tenantId: o.tenant_id,
        customerName: o.customer_name,
        totalAmount: o.total_amount,
        status: o.status,
        createdAt: o.created_at,
        items: (o.OrderItem || []).map((item: any) => ({
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })),
      })) as Order[];
    } catch { return []; }
  },

  async create(order: Omit<Order, 'id' | 'createdAt'>) {
    if (!isConfigured) return null;
    
    const { data: orderData, error: orderError } = await supabase.from(TABLES.ORDER).insert({
      tenant_id: order.tenantId,
      customer_name: order.customerName,
      total_amount: order.totalAmount,
      status: order.status,
    }).select().single();

    if (orderError) throw orderError;

    // Insert order items
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

  async updateStatus(id: string, status: string) {
    if (!isConfigured) return null;
    const { data, error } = await supabase.from(TABLES.ORDER).update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) return;
    const { error } = await supabase.from(TABLES.ORDER).delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// INVOICES
// ============================================
export const invoicesService = {
  async getAll(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.INVOICE)
        .select('*, InvoiceItem(*)')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data || []).map(inv => ({
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
        items: (inv.InvoiceItem || []).map((item: any) => ({
          rawName: item.raw_name,
          matchedInsumoName: item.matched_insumo_name,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unit_cost,
          totalCost: item.total_cost,
          category: item.category,
        })),
      })) as InvoiceScan[];
    } catch { return []; }
  },

  async create(invoice: Omit<InvoiceScan, 'id'>) {
    if (!isConfigured) return null;
    
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

    // Insert invoice items
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
    if (!isConfigured) return null;
    const { data, error } = await supabase.from(TABLES.INVOICE).update({
      processed: updates.processed,
      processed_at: updates.processedAt,
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (!isConfigured) return;
    const { error } = await supabase.from(TABLES.INVOICE).delete().eq('id', id);
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
