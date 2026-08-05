export type UnitType = 'g' | 'ml' | 'un' | 'kg' | 'L';

export type UserRole = 'super_admin' | 'store_owner' | 'employee';

export type SubscriptionPlan = 'Gratuito' | 'Pro' | 'Enterprise';

export type SubscriptionStatus = 'Ativo' | 'Suspenso' | 'Trial' | 'Cancelado';

export type InvoiceCategoryEnum = 'alimentacao' | 'transporte' | 'servicos' | 'insumos' | 'impostos' | 'outros';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  tenantName?: string;
}

export interface Tenant {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  cnpjStore: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  accessDaysRemaining: number;
  expirationDate: string;
  maxMonthlyScans: number;
  scansUsedThisMonth: number;
  createdAt: string;
}

export interface Insumo {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: string;
  unit: 'g' | 'ml' | 'un';
  currentStock: number;
  minStock: number;
  unitCost: number; // Base cost per 1g, 1ml, or 1un
  supplier: string;
  lastUpdated: string;
}

export interface RecipeItem {
  insumoId: string;
  insumoName: string;
  quantity: number; // in g, ml, or un
  unit: 'g' | 'ml' | 'un';
  calculatedCost: number;
}

export interface FichaTecnica {
  id: string;
  tenantId: string;
  productName: string;
  code: string;
  category: string;
  yieldQuantity: number; // Batch yield (e.g., 1 unit)
  ingredients: RecipeItem[];
  rawInsumoCost: number;
  wasteMarginPercent: number; // e.g., 5%
  operationalOverheadPercent: number; // e.g., 15%
  taxPercent: number; // e.g., 8%
  totalProductionCost: number;
  targetProfitMarginPercent: number; // e.g., 60%
  calculatedPrice: number;
  manualOverridePrice?: number;
  finalPrice: number;
  netProfitPerUnit: number;
  profitMarginRate: number; // %
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  sku: string;
  stockQuantity: number;
  oldPrice: number;
  saleDiscountPercent: number;
  newPrice: number;
  itemsSold: number;
  fichaTecnicaId?: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  image?: string;
}

export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'Pendente' | 'Delivered' | 'Processing' | 'Shipped' | 'Cancelled';
  date: string;
  timeAgo: string;
}

export interface InvoiceItem {
  rawName: string;
  matchedInsumoName: string;
  quantity: number;
  unit: 'g' | 'ml' | 'un';
  unitCost: number;
  totalCost: number;
  category?: string;
}

export interface InvoiceScan {
  id: string;
  tenantId: string;
  supplierName: string;
  cnpj: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  category: InvoiceCategoryEnum;
  notes?: string;
  imageUrl?: string;
  items: InvoiceItem[];
  processed: boolean;
  processedAt?: string;
}

export type CurrencyType = 'BRL' | 'USD' | 'EUR';
