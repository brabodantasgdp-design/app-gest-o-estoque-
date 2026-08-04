import { supabase, isConfigured } from './supabase';
import type { Tenant, Insumo, FichaTecnica, Product, Order, InvoiceScan, User, RecipeItem } from '../types';

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
        .from('users')
        .select('*, tenants(*)')
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
          tenantName: user.tenants?.name || '',
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
        .from('users')
        .select('*, tenants(*)')
        .eq('id', user.id)
        .single();
      if (!userData) return null;
      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        tenantId: userData.tenant_id,
        tenantName: userData.tenants?.name || '',
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
      const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapTenant);
    } catch (_) { return []; }
  },
  async create(tenant: Omit<Tenant, 'id' | 'createdAt'>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('tenants').insert({
      name: tenant.name, owner_name: tenant.ownerName, email: tenant.email, password: tenant.password,
      cnpj_store: tenant.cnpjStore, plan: tenant.plan, status: tenant.status,
      access_days_remaining: tenant.accessDaysRemaining, expiration_date: tenant.expirationDate,
      max_monthly_scans: tenant.maxMonthlyScans, scans_used_this_month: tenant.scansUsedThisMonth,
    }).select().single();
    if (error) throw error;
    return mapTenant(data);
  },
  async update(id: string, updates: Partial<Tenant>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('tenants').update({
      name: updates.name, owner_name: updates.ownerName, email: updates.email,
      cnpj_store: updates.cnpjStore, plan: updates.plan, status: updates.status,
      access_days_remaining: updates.accessDaysRemaining, expiration_date: updates.expirationDate,
      max_monthly_scans: updates.maxMonthlyScans, scans_used_this_month: updates.scansUsedThisMonth,
    }).eq('id', id).select().single();
    if (error) throw error;
    return mapTenant(data);
  },
  async delete(id: string) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { error } = await supabase.from('tenants').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// INSUMOS
// ============================================
export const insumosService = {
  async getByTenant(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from('insumos').select('*').eq('tenant_id', tenantId).order('name');
      if (error) throw error;
      return (data || []).map(mapInsumo);
    } catch (_) { return []; }
  },
  async create(insumo: Omit<Insumo, 'id'>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('insumos').insert({
      tenant_id: insumo.tenantId, code: insumo.code, name: insumo.name, category: insumo.category,
      unit: insumo.unit, current_stock: insumo.currentStock, min_stock: insumo.minStock,
      unit_cost: insumo.unitCost, supplier: insumo.supplier,
    }).select().single();
    if (error) throw error;
    return mapInsumo(data);
  },
  async update(id: string, updates: Partial<Insumo>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('insumos').update({
      code: updates.code, name: updates.name, category: updates.category, unit: updates.unit,
      current_stock: updates.currentStock, min_stock: updates.minStock, unit_cost: updates.unitCost,
      supplier: updates.supplier, last_updated: new Date().toISOString().split('T')[0],
    }).eq('id', id).select().single();
    if (error) throw error;
    return mapInsumo(data);
  },
  async delete(id: string) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { error } = await supabase.from('insumos').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// FICHAS TECNICAS
// ============================================
export const fichasService = {
  async getByTenant(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from('fichas_tecnicas').select('*, recipe_ingredients(*)')
        .eq('tenant_id', tenantId).order('product_name');
      if (error) throw error;
      return (data || []).map(mapFicha);
    } catch (_) { return []; }
  },
  async create(ficha: Omit<FichaTecnica, 'id'>, ingredients: Omit<RecipeItem, 'calculatedCost'>[]) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data: fichaData, error: fichaError } = await supabase.from('fichas_tecnicas').insert({
      tenant_id: ficha.tenantId, code: ficha.code, product_name: ficha.productName,
      category: ficha.category, yield_quantity: ficha.yieldQuantity,
      waste_margin_percent: ficha.wasteMarginPercent, operational_overhead_percent: ficha.operationalOverheadPercent,
      tax_percent: ficha.taxPercent, raw_insumo_cost: ficha.rawInsumoCost,
      total_production_cost: ficha.totalProductionCost, target_profit_margin_percent: ficha.targetProfitMarginPercent,
      calculated_price: ficha.calculatedPrice, final_price: ficha.finalPrice,
      net_profit_per_unit: ficha.netProfitPerUnit, profit_margin_rate: ficha.profitMarginRate,
    }).select().single();
    if (fichaError) throw fichaError;

    const insumoCostMap: Record<string, number> = {};
    if (ingredients.length > 0) {
      const insumoIds = ingredients.map(ing => ing.insumoId);
      const { data: insumosData } = await supabase.from('insumos').select('id, unit_cost').in('id', insumoIds);
      (insumosData || []).forEach((ins: any) => { insumoCostMap[ins.id] = ins.unit_cost; });

      const { error: ingError } = await supabase.from('recipe_ingredients').insert(ingredients.map(ing => ({
        ficha_tecnica_id: fichaData.id, insumo_id: ing.insumoId, insumo_name: ing.insumoName,
        quantity: ing.quantity, unit: ing.unit,
        calculated_cost: ing.quantity * (insumoCostMap[ing.insumoId] || 0),
      })));
      if (ingError) throw ingError;
    }

    return mapFicha({ ...fichaData, recipe_ingredients: ingredients.map((ing, i) => ({
      id: `temp-${i}`, ficha_tecnica_id: fichaData.id,
      insumo_id: ing.insumoId, insumo_name: ing.insumoName,
      quantity: ing.quantity, unit: ing.unit, calculated_cost: ing.quantity * (insumoCostMap[ing.insumoId] || 0),
    })) });
  },
  async update(id: string, updates: Partial<FichaTecnica>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('fichas_tecnicas').update({
      code: updates.code, product_name: updates.productName, category: updates.category,
      yield_quantity: updates.yieldQuantity, waste_margin_percent: updates.wasteMarginPercent,
      operational_overhead_percent: updates.operationalOverheadPercent, tax_percent: updates.taxPercent,
      raw_insumo_cost: updates.rawInsumoCost, total_production_cost: updates.totalProductionCost,
      target_profit_margin_percent: updates.targetProfitMarginPercent, calculated_price: updates.calculatedPrice,
      final_price: updates.finalPrice, net_profit_per_unit: updates.netProfitPerUnit,
      profit_margin_rate: updates.profitMarginRate,
    }).eq('id', id).select().single();
    if (error) throw error;
    return mapFicha(data);
  },
  async delete(id: string) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { error } = await supabase.from('fichas_tecnicas').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// PRODUCTS
// ============================================
export const productsService = {
  async getByTenant(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from('products').select('*').eq('tenant_id', tenantId).order('name');
      if (error) throw error;
      return (data || []).map(mapProduct);
    } catch (_) { return []; }
  },
  async create(product: Omit<Product, 'id'>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('products').insert({
      tenant_id: product.tenantId, name: product.name, category: product.category, sku: product.sku,
      stock_quantity: product.stockQuantity, old_price: product.oldPrice,
      sale_discount_percent: product.saleDiscountPercent, new_price: product.newPrice,
      items_sold: product.itemsSold, ficha_tecnica_id: product.fichaTecnicaId, status: product.status,
    }).select().single();
    if (error) throw error;
    return mapProduct(data);
  },
  async update(id: string, updates: Partial<Product>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('products').update({
      name: updates.name, category: updates.category, sku: updates.sku,
      stock_quantity: updates.stockQuantity, old_price: updates.oldPrice,
      sale_discount_percent: updates.saleDiscountPercent, new_price: updates.newPrice,
      items_sold: updates.itemsSold, ficha_tecnica_id: updates.fichaTecnicaId, status: updates.status,
    }).eq('id', id).select().single();
    if (error) throw error;
    return mapProduct(data);
  },
  async delete(id: string) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// ORDERS
// ============================================
export const ordersService = {
  async getByTenant(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from('orders').select('*, order_items(*)')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapOrder);
    } catch (_) { return []; }
  },
  async create(order: Omit<Order, 'id'>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data: orderData, error: orderError } = await supabase.from('orders').insert({
      tenant_id: order.tenantId, order_number: order.orderNumber, customer_name: order.customerName,
      customer_email: order.customerEmail, total_amount: order.totalAmount, status: order.status, date: order.date,
    }).select().single();
    if (orderError) throw orderError;

    if (order.items.length > 0) {
      const { error: itemsError } = await supabase.from('order_items').insert(order.items.map(item => ({
        order_id: orderData.id, product_name: item.productName, quantity: item.quantity, unit_price: item.unitPrice,
      })));
      if (itemsError) throw itemsError;
    }
    return mapOrder({ ...orderData, order_items: order.items });
  },
  async updateStatus(id: string, status: string) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return mapOrder(data);
  },
  async delete(id: string) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// INVOICES (Notas Fiscais)
// ============================================
export const invoicesService = {
  async getByTenant(tenantId: string) {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from('invoices').select('*, invoice_items(*)')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapInvoice);
    } catch (_) { return []; }
  },
  async create(invoice: Omit<InvoiceScan, 'id'>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data: invoiceData, error: invoiceError } = await supabase.from('invoices').insert({
      tenant_id: invoice.tenantId, supplier_name: invoice.supplierName, cnpj: invoice.cnpj,
      invoice_number: invoice.invoiceNumber, invoice_date: invoice.invoiceDate,
      total_amount: invoice.totalAmount, category: invoice.category, notes: invoice.notes,
      image_url: invoice.imageUrl, processed: invoice.processed, processed_at: invoice.processedAt,
    }).select().single();
    if (invoiceError) throw invoiceError;

    if (invoice.items.length > 0) {
      const { error: itemsError } = await supabase.from('invoice_items').insert(invoice.items.map(item => ({
        invoice_id: invoiceData.id, raw_name: item.rawName, matched_insumo_name: item.matchedInsumoName,
        quantity: item.quantity, unit: item.unit, unit_cost: item.unitCost,
        total_cost: item.totalCost, category: item.category,
      })));
      if (itemsError) throw itemsError;
    }
    return mapInvoice({ ...invoiceData, invoice_items: invoice.items });
  },
  async update(id: string, updates: Partial<InvoiceScan>) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('invoices').update({
      supplier_name: updates.supplierName, cnpj: updates.cnpj, invoice_number: updates.invoiceNumber,
      invoice_date: updates.invoiceDate, total_amount: updates.totalAmount, category: updates.category,
      notes: updates.notes, processed: updates.processed, processed_at: updates.processedAt,
    }).eq('id', id).select().single();
    if (error) throw error;
    return mapInvoice(data);
  },
  async delete(id: string) {
    if (!isConfigured) throw new Error('Supabase not configured');
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// MAP FUNCTIONS (DB -> App Types)
// ============================================
function mapTenant(row: any): Tenant {
  return {
    id: row.id, name: row.name, ownerName: row.owner_name, email: row.email,
    password: row.password_hash, cnpjStore: row.cnpj_store, plan: row.plan, status: row.status,
    accessDaysRemaining: row.access_days_remaining, expirationDate: row.expiration_date,
    maxMonthlyScans: row.max_monthly_scans, scansUsedThisMonth: row.scans_used_this_month,
    createdAt: row.created_at,
  };
}

function mapInsumo(row: any): Insumo {
  return {
    id: row.id, tenantId: row.tenant_id, code: row.code, name: row.name,
    category: row.category, unit: row.unit, currentStock: row.current_stock,
    minStock: row.min_stock, unitCost: row.unit_cost, supplier: row.supplier,
    lastUpdated: row.last_updated,
  };
}

function mapFicha(row: any): FichaTecnica {
  const ingredients = (row.recipe_ingredients || []).map((ri: any) => ({
    insumoId: ri.insumo_id, insumoName: ri.insumo_name, quantity: ri.quantity,
    unit: ri.unit, calculatedCost: ri.calculated_cost,
  }));
  return {
    id: row.id, tenantId: row.tenant_id, code: row.code, productName: row.product_name,
    category: row.category, yieldQuantity: row.yield_quantity, ingredients,
    rawInsumoCost: row.raw_insumo_cost, wasteMarginPercent: row.waste_margin_percent,
    operationalOverheadPercent: row.operational_overhead_percent, taxPercent: row.tax_percent,
    totalProductionCost: row.total_production_cost, targetProfitMarginPercent: row.target_profit_margin_percent,
    calculatedPrice: row.calculated_price, finalPrice: row.final_price,
    netProfitPerUnit: row.net_profit_per_unit, profitMarginRate: row.profit_margin_rate,
  };
}

function mapProduct(row: any): Product {
  return {
    id: row.id, tenantId: row.tenant_id, name: row.name, category: row.category,
    sku: row.sku, stockQuantity: row.stock_quantity, oldPrice: row.old_price,
    saleDiscountPercent: row.sale_discount_percent, newPrice: row.new_price,
    itemsSold: row.items_sold, fichaTecnicaId: row.ficha_tecnica_id, status: row.status,
  };
}

function mapOrder(row: any): Order {
  const items = (row.order_items || []).map((oi: any) => ({
    productName: oi.product_name, quantity: oi.quantity, unitPrice: oi.unit_price,
  }));
  return {
    id: row.id, tenantId: row.tenant_id, orderNumber: row.order_number,
    customerName: row.customer_name, customerEmail: row.customer_email, items,
    totalAmount: row.total_amount, status: row.status, date: row.date, timeAgo: '',
  };
}

function mapInvoice(row: any): InvoiceScan {
  const items = (row.invoice_items || []).map((ii: any) => ({
    rawName: ii.raw_name, matchedInsumoName: ii.matched_insumo_name, quantity: ii.quantity,
    unit: ii.unit, unitCost: ii.unit_cost, totalCost: ii.total_cost, category: ii.category,
  }));
  return {
    id: row.id, tenantId: row.tenant_id, supplierName: row.supplier_name, cnpj: row.cnpj,
    invoiceNumber: row.invoice_number, invoiceDate: row.invoice_date, totalAmount: row.total_amount,
    category: row.category, notes: row.notes, imageUrl: row.image_url,
    processed: row.processed, processedAt: row.processed_at, items,
  };
}

// ============================================
// DATA FETCHER FOR VOICE ASSISTANT
// ============================================
export const dataFetcher = {
  async getAllForVoiceAssistant(tenantId: string) {
    if (!isConfigured) {
      return { insumos: [], products: [], orders: [], fichas: [], invoices: [] };
    }
    
    try {
      const [insumos, products, orders, fichas, invoices] = await Promise.all([
        insumosService.getByTenant(tenantId),
        productsService.getByTenant(tenantId),
        ordersService.getByTenant(tenantId),
        fichasService.getByTenant(tenantId),
        invoicesService.getByTenant(tenantId),
      ]);
      
      return { insumos, products, orders, fichas, invoices };
    } catch (err) {
      console.error('Error fetching data for voice assistant:', err);
      return { insumos: [], products: [], orders: [], fichas: [], invoices: [] };
    }
  }
};
