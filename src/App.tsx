import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { DashboardView } from './components/Dashboard/DashboardView';
import { InvoicesListView } from './components/Invoices/InvoicesListView';
import { InsumosModule } from './components/InsumosModule';
import { FichaTecnicaModule } from './components/FichaTecnicaModule';
import { InvoiceOCRModule } from './components/InvoiceOCRModule';
import { ProductsModule } from './components/ProductsModule';
import { OrdersModule } from './components/OrdersModule';
import { SuperAdminModule } from './components/SuperAdminModule';
import { LoginForm } from './components/Auth/LoginForm';
import {
  INITIAL_TENANTS,
  INITIAL_INSUMOS,
  INITIAL_FICHAS,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  SAMPLE_INVOICES
} from './data/mockData';
import { CurrencyType, Product, Tenant, Insumo, FichaTecnica, Order, InvoiceScan, User } from './types';
import { TrendingUp, DollarSign, PieChart, ShieldCheck, Database, Cpu, LogOut, UserCheck } from 'lucide-react';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currency, setCurrency] = useState<CurrencyType>('BRL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Multi-tenant State
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [activeTenantId, setActiveTenantId] = useState<string>('tenant-1');

  // Core Store Data
  const [allInsumos, setAllInsumos] = useState<Insumo[]>(INITIAL_INSUMOS);
  const [allFichas, setAllFichas] = useState<FichaTecnica[]>(INITIAL_FICHAS);
  const [allProducts, setAllProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [allOrders, setAllOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [allInvoices, setAllInvoices] = useState<InvoiceScan[]>(SAMPLE_INVOICES);

  // Filtered store data scoped exclusively to activeTenantId (Isolated Multi-Tenancy)
  const tenantInsumos = useMemo(() => allInsumos.filter((i) => i.tenantId === activeTenantId), [allInsumos, activeTenantId]);
  const tenantFichas = useMemo(() => allFichas.filter((f) => f.tenantId === activeTenantId), [allFichas, activeTenantId]);
  const tenantProducts = useMemo(() => allProducts.filter((p) => p.tenantId === activeTenantId), [allProducts, activeTenantId]);
  const tenantOrders = useMemo(() => allOrders.filter((o) => o.tenantId === activeTenantId), [allOrders, activeTenantId]);
  const tenantInvoices = useMemo(() => allInvoices.filter((i) => i.tenantId === activeTenantId), [allInvoices, activeTenantId]);

  const currentTenant = tenants.find((t) => t.id === activeTenantId);

  // Count low stock insumos for active store sidebar notification badge
  const lowStockCount = tenantInsumos.filter((i) => i.currentStock <= i.minStock).length;

  if (!currentUser) {
    return (
      <LoginForm
        tenants={tenants}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.tenantId) {
            setActiveTenantId(user.tenantId);
          }
        }}
      />
    );
  }

  // Handlers for state updates while maintaining tenantId scoping
  const handleSetInsumos = (action: React.SetStateAction<Insumo[]>) => {
    if (typeof action === 'function') {
      const updatedTenantInsumos = action(tenantInsumos);
      const otherInsumos = allInsumos.filter((i) => i.tenantId !== activeTenantId);
      setAllInsumos([...otherInsumos, ...updatedTenantInsumos]);
    } else {
      const otherInsumos = allInsumos.filter((i) => i.tenantId !== activeTenantId);
      setAllInsumos([...otherInsumos, ...action]);
    }
  };

  const handleSetFichas = (action: React.SetStateAction<FichaTecnica[]>) => {
    if (typeof action === 'function') {
      const updatedTenantFichas = action(tenantFichas);
      const otherFichas = allFichas.filter((f) => f.tenantId !== activeTenantId);
      setAllFichas([...otherFichas, ...updatedTenantFichas]);
    } else {
      const otherFichas = allFichas.filter((f) => f.tenantId !== activeTenantId);
      setAllFichas([...otherFichas, ...action]);
    }
  };

  const handleSetProducts = (action: React.SetStateAction<Product[]>) => {
    if (typeof action === 'function') {
      const updatedTenantProducts = action(tenantProducts);
      const otherProducts = allProducts.filter((p) => p.tenantId !== activeTenantId);
      setAllProducts([...otherProducts, ...updatedTenantProducts]);
    } else {
      const otherProducts = allProducts.filter((p) => p.tenantId !== activeTenantId);
      setAllProducts([...otherProducts, ...action]);
    }
  };

  const handleSetOrders = (action: React.SetStateAction<Order[]>) => {
    if (typeof action === 'function') {
      const updatedTenantOrders = action(tenantOrders);
      const otherOrders = allOrders.filter((o) => o.tenantId !== activeTenantId);
      setAllOrders([...otherOrders, ...updatedTenantOrders]);
    } else {
      const otherOrders = allOrders.filter((o) => o.tenantId !== activeTenantId);
      setAllOrders([...otherOrders, ...action]);
    }
  };

  const handleSetInvoices = (action: React.SetStateAction<InvoiceScan[]>) => {
    if (typeof action === 'function') {
      const updatedTenantInvoices = action(tenantInvoices);
      const otherInvoices = allInvoices.filter((i) => i.tenantId !== activeTenantId);
      setAllInvoices([...otherInvoices, ...updatedTenantInvoices]);
    } else {
      const otherInvoices = allInvoices.filter((i) => i.tenantId !== activeTenantId);
      setAllInvoices([...otherInvoices, ...action]);
    }
  };

  const handleSaveToProducts = (newProduct: Product) => {
    const productWithTenant = { ...newProduct, tenantId: activeTenantId };
    setAllProducts([productWithTenant, ...allProducts]);
  };

  const handleSelectTenantContext = (tenantId: string) => {
    setActiveTenantId(tenantId);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-zinc-100 font-sans antialiased selection:bg-amber-500 selection:text-black">
      
      {/* Top Header */}
      <Header
        currency={currency}
        setCurrency={setCurrency}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        tenants={currentUser.role === 'super_admin' ? tenants : tenants.filter((t) => t.id === currentUser.tenantId)}
        activeTenantId={activeTenantId}
        setActiveTenantId={setActiveTenantId}
        onOpenSuperAdmin={() => setActiveTab('super_admin')}
      />

      {/* User Session Bar */}
      <div className="bg-[#121214] border-b border-zinc-800/60 px-6 py-2 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-zinc-300 font-bold">
            <UserCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>{currentUser.name}</span>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="font-mono text-zinc-400">{currentUser.email}</span>
          <span className="text-zinc-600">•</span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {currentUser.role === 'super_admin' ? 'Super Admin (Acesso Global)' : 'Store Owner (Tenant Isolado)'}
          </span>
        </div>

        <button
          onClick={() => setCurrentUser(null)}
          className="text-xs font-bold text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair</span>
        </button>
      </div>

      <div className="flex">
        {/* Left Vertical Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lowStockCount={lowStockCount}
          currentTenant={currentTenant}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-6 max-w-[1600px] mx-auto overflow-x-hidden">
          {activeTab === 'dashboard' && (
            <DashboardView
              invoices={tenantInvoices}
              currency={currency}
              currentTenant={currentTenant}
              onNavigateToInvoices={() => setActiveTab('invoices')}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesListView
              invoices={tenantInvoices}
              setInvoices={handleSetInvoices}
              currency={currency}
              currentTenant={currentTenant}
              onOpenOCRScan={() => setActiveTab('ocr')}
            />
          )}

          {activeTab === 'insumos' && (
            <InsumosModule
              insumos={tenantInsumos}
              setInsumos={handleSetInsumos}
              currency={currency}
            />
          )}

          {activeTab === 'fichas' && (
            <FichaTecnicaModule
              fichas={tenantFichas}
              setFichas={handleSetFichas}
              insumos={tenantInsumos}
              currency={currency}
              onSaveToProducts={handleSaveToProducts}
            />
          )}

          {activeTab === 'ocr' && (
            <InvoiceOCRModule
              insumos={tenantInsumos}
              setInsumos={handleSetInsumos}
              currency={currency}
            />
          )}

          {activeTab === 'products' && (
            <ProductsModule
              products={tenantProducts}
              setProducts={handleSetProducts}
              currency={currency}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersModule
              orders={tenantOrders}
              setOrders={handleSetOrders}
              currency={currency}
            />
          )}

          {activeTab === 'super_admin' && (
            <SuperAdminModule
              tenants={tenants}
              setTenants={setTenants}
              activeTenantId={activeTenantId}
              onSelectTenantContext={handleSelectTenantContext}
              currency={currency}
            />
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6 pb-12 animate-in fade-in duration-300">
              <div className="pb-2 border-b border-zinc-800/50">
                <h1 className="text-xl font-extrabold text-white">Relatórios Financeiros & Lucratividade</h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Análise de margem por ficha técnica e CMV da loja: <strong className="text-amber-400">{currentTenant?.name}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-2">
                  <div className="text-xs text-zinc-400">Margem Média de Lucro</div>
                  <div className="text-3xl font-black text-amber-400">63.6%</div>
                  <div className="text-[10px] text-emerald-400 font-bold">+4.2% em relação ao trimestre anterior</div>
                </div>

                <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-2">
                  <div className="text-xs text-zinc-400">CMV Médio (Custo de Insumos)</div>
                  <div className="text-3xl font-black text-white">28.4%</div>
                  <div className="text-[10px] text-zinc-500">Alinhado com a meta do setor de varejo</div>
                </div>

                <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-2">
                  <div className="text-xs text-zinc-400">Economia via Reajuste OCR IA</div>
                  <div className="text-3xl font-black text-emerald-400">R$ 3.420</div>
                  <div className="text-[10px] text-zinc-500">Recuperados por prevenção de sobrepreço</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 pb-12 animate-in fade-in duration-300">
              <div className="pb-2 border-b border-zinc-800/50">
                <h1 className="text-xl font-extrabold text-white">Configurações do EBD ElBravoDantas</h1>
                <p className="text-xs text-zinc-400 mt-1">Integração de banco Supabase + Prisma, chaves de API e parâmetros do sistema.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Modelo Gemini OCR Ativo</h3>
                    <p className="text-xs text-zinc-400">gemini-3.6-flash em modo server-side seguro com visual schema OCR</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
                  <Database className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Banco de Dados PostgreSQL (Supabase) + Prisma</h3>
                    <p className="text-xs text-zinc-400">Pronto para deploy na Vercel com pooling e arquivo prisma/schema.prisma</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  );
}
