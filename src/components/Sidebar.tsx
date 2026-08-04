import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  FileSpreadsheet,
  ScanText,
  ShoppingCart,
  TrendingUp,
  Settings,
  Crown,
  ArrowRight,
  Boxes,
  ShieldCheck,
  Building2,
  FileText,
  Menu,
  X
} from 'lucide-react';
import { Tenant } from '../types';

export type TabType =
  | 'dashboard'
  | 'invoices'
  | 'insumos'
  | 'fichas'
  | 'ocr'
  | 'products'
  | 'orders'
  | 'reports'
  | 'super_admin'
  | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  lowStockCount: number;
  currentTenant?: Tenant;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, lowStockCount, currentTenant }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems: { id: TabType; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'invoices', label: 'Notas Fiscais', icon: <FileText className="w-4 h-4" /> },
    { id: 'insumos', label: 'Insumos', icon: <Boxes className="w-4 h-4" />, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { id: 'fichas', label: 'Fichas Técnicas', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'ocr', label: 'OCR (IA)', icon: <ScanText className="w-4 h-4" />, badge: 'IA' },
    { id: 'products', label: 'Produtos', icon: <Package className="w-4 h-4" /> },
    { id: 'orders', label: 'Pedidos', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'reports', label: 'Relatórios', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'super_admin', label: 'Admin', icon: <ShieldCheck className="w-4 h-4" />, badge: 'ADMIN' },
    { id: 'settings', label: 'Config', icon: <Settings className="w-4 h-4" /> },
  ];

  // Mobile bottom nav items (most important)
  const mobileNavItems: TabType[] = ['dashboard', 'insumos', 'ocr', 'products', 'orders'];

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-[#121214] border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`
        lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-[#0B0B0C] border-r border-zinc-800/60 p-4 flex flex-col justify-between transform transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {currentTenant && (
                <span className="text-xs text-amber-500 font-semibold truncate max-w-[120px]">
                  {currentTenant.name}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              const isAdminTab = item.id === 'super_admin';

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : isAdminTab
                      ? 'text-amber-400/80 hover:text-amber-300 hover:bg-[#181510]'
                      : 'text-zinc-400 hover:text-white hover:bg-[#121214]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-amber-500' : isAdminTab ? 'text-amber-400' : 'text-zinc-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        item.badge === 'ADMIN'
                          ? 'bg-amber-500 text-black'
                          : item.badge === 'IA'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {currentTenant && (
          <div className="p-4 rounded-2xl bg-gradient-to-b from-[#18181B] to-[#121214] border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                {currentTenant.plan}
              </span>
            </div>
            <h4 className="text-xs font-bold text-white truncate">{currentTenant.name}</h4>
            <p className="text-[11px] text-zinc-400 mt-1">
              <strong className="text-amber-400">{currentTenant.accessDaysRemaining} dias</strong> restantes
            </p>
          </div>
        )}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#0B0B0C] border-r border-zinc-800/60 p-4 flex-col justify-between shrink-0 min-h-[calc(100vh-61px)]">
        <div className="space-y-1.5">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span>Menu Principal</span>
            {currentTenant && (
              <span className="text-[9px] text-amber-500 font-semibold truncate max-w-[100px]">
                {currentTenant.name.split(' ')[0]}
              </span>
            )}
          </div>

          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const isAdminTab = item.id === 'super_admin';

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/5'
                    : isAdminTab
                    ? 'text-amber-400/80 hover:text-amber-300 hover:bg-[#181510] border border-amber-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-[#121214]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-amber-500' : isAdminTab ? 'text-amber-400' : 'text-zinc-400 group-hover:text-zinc-200'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      item.badge === 'ADMIN'
                        ? 'bg-amber-500 text-black font-extrabold'
                        : item.badge === 'IA'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {currentTenant && (
          <div className="mt-8 p-4 rounded-2xl bg-gradient-to-b from-[#18181B] to-[#121214] border border-amber-500/20 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-20 h-20 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
            
            <div className="flex items-center justify-between mb-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {currentTenant.plan}
              </span>
            </div>

            <h4 className="text-xs font-bold text-white mb-1 truncate">{currentTenant.name}</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
              Licença com <strong className="text-amber-400">{currentTenant.accessDaysRemaining} dias</strong> de acesso restantes.
            </p>

            <button
              onClick={() => setActiveTab('super_admin')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-amber-500/20 text-amber-400 font-bold text-xs border border-zinc-700 transition-all cursor-pointer"
            >
              <span>Gerenciar Licença</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121214] border-t border-zinc-800 safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {mobileNavItems.map((tabId) => {
            const item = menuItems.find(m => m.id === tabId);
            const isActive = activeTab === tabId;
            
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  isActive 
                    ? 'text-amber-400' 
                    : 'text-zinc-500'
                }`}
              >
                <div className={`p-2 rounded-xl ${isActive ? 'bg-amber-500/10' : ''}`}>
                  {item?.icon}
                </div>
                <span className="text-[10px] font-bold">{item?.label}</span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
