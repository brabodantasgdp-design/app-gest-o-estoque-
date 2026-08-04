import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  CurrencyType, Product, Tenant, Insumo, FichaTecnica, Order, InvoiceScan, User
} from './types';
import { LogOut, UserCheck, Edit2, X, Save } from 'lucide-react';
import {
  tenantsService,
  insumosService,
  fichasService,
  productsService,
  ordersService,
  invoicesService,
  authService
} from './lib/database';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currency, setCurrency] = useState<CurrencyType>('BRL');
  const [searchTerm, setSearchTerm] = useState('');

  // Profile edit modal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  // Data state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('');
  const [allInsumos, setAllInsumos] = useState<Insumo[]>([]);
  const [allFichas, setAllFichas] = useState<FichaTecnica[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allInvoices, setAllInvoices] = useState<InvoiceScan[]>([]);

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          if (user.tenantId) {
            setActiveTenantId(user.tenantId);
          }
        }
      } catch (err) {
        console.log('No session found');
      } finally {
        setAuthLoading(false);
      }
    };
    checkSession();
  }, []);

  // Load tenants (only for super admin)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'super_admin') return;

    const loadTenants = async () => {
      try {
        const data = await tenantsService.getAll();
        setTenants(data);
      } catch (err) {
        console.error('Error loading tenants:', err);
      }
    };
    loadTenants();
  }, [currentUser]);

  // Load data for active tenant
  useEffect(() => {
    if (!activeTenantId) return;

    const loadAllData = async () => {
      try {
        const [insumos, fichas, products, orders, invoices] = await Promise.all([
          insumosService.getByTenant(activeTenantId),
          fichasService.getByTenant(activeTenantId),
          productsService.getByTenant(activeTenantId),
          ordersService.getByTenant(activeTenantId),
          invoicesService.getByTenant(activeTenantId),
        ]);

        setAllInsumos(insumos);
        setAllFichas(fichas);
        setAllProducts(products);
        setAllOrders(orders);
        setAllInvoices(invoices);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadAllData();
  }, [activeTenantId]);

  // Filtered data scoped to active tenant
  const tenantInsumos = useMemo(() => allInsumos, [allInsumos]);
  const tenantFichas = useMemo(() => allFichas, [allFichas]);
  const tenantProducts = useMemo(() => allProducts, [allProducts]);
  const tenantOrders = useMemo(() => allOrders, [allOrders]);
  const tenantInvoices = useMemo(() => allInvoices, [allInvoices]);

  const currentTenant = tenants.find((t) => t.id === activeTenantId);
  const lowStockCount = tenantInsumos.filter((i) => i.currentStock <= i.minStock).length;

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center">
        <div className="text-amber-400 font-bold text-sm animate-pulse">Carregando...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!currentUser) {
    return (
      <LoginForm
        tenants={tenants}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.tenantId) {
            setActiveTenantId(user.tenantId);
          }
          // Load tenants for super admin
          if (user.role === 'super_admin') {
            tenantsService.getAll().then(setTenants).catch(console.error);
          }
        }}
      />
    );
  }

  // Handlers for CRUD operations
  const handleSetInsumos = useCallback((action: React.SetStateAction<Insumo[]>) => {
    setAllInsumos(action);
  }, []);

  const handleSetFichas = useCallback((action: React.SetStateAction<FichaTecnica[]>) => {
    setAllFichas(action);
  }, []);

  const handleSetProducts = useCallback((action: React.SetStateAction<Product[]>) => {
    setAllProducts(action);
  }, []);

  const handleSetOrders = useCallback((action: React.SetStateAction<Order[]>) => {
    setAllOrders(action);
  }, []);

  const handleSetInvoices = useCallback((action: React.SetStateAction<InvoiceScan[]>) => {
    setAllInvoices(action);
  }, []);

  const handleSaveToProducts = useCallback((newProduct: Product) => {
    setAllProducts(prev => [{ ...newProduct, tenantId: activeTenantId }, ...prev]);
  }, [activeTenantId]);

  const handleSelectTenantContext = useCallback((tenantId: string) => {
    setActiveTenantId(tenantId);
    setActiveTab('dashboard');
  }, []);

  const handleOpenProfile = () => {
    setProfileName(currentUser.name);
    setProfileEmail(currentUser.email);
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = () => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        name: profileName,
        email: profileEmail,
      });
      setIsProfileModalOpen(false);
    }
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

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenProfile}
            className="text-xs font-bold text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Meu Perfil</span>
          </button>
          <span className="text-zinc-600">|</span>
          <button
            onClick={() => {
              authService.logout();
              setCurrentUser(null);
            }}
            className="text-xs font-bold text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
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

          {activeTab === 'super_admin' && currentUser.role === 'super_admin' && (
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
                  <div className="w-5 h-5 text-amber-500">⚡</div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Modelo Gemini OCR Ativo</h3>
                    <p className="text-xs text-zinc-400">gemini-3.6-flash em modo server-side seguro com visual schema OCR</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
                  <div className="w-5 h-5 text-amber-500">🗄️</div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Banco de Dados PostgreSQL (Supabase)</h3>
                    <p className="text-xs text-zinc-400">Conectado e sincronizado com RLS multi-tenant ativo</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Profile Edit Modal */}
      {isProfileModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                Editar Meu Perfil
              </h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-bold mb-1">E-mail</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Função</label>
                <input
                  type="text"
                  disabled
                  value={currentUser.role === 'super_admin' ? 'Super Admin (Acesso Global)' : 'Store Owner'}
                  className="w-full bg-[#18181C] border border-zinc-800 rounded-xl p-2.5 text-amber-400 font-bold cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
