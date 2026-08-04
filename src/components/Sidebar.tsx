import React from 'react';
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
  FileText
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
  const menuItems: { id: TabType; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'invoices', label: 'Notas Fiscais (NFs)', icon: <FileText className="w-4 h-4" /> },
    { id: 'insumos', label: 'Insumos & Estoque', icon: <Boxes className="w-4 h-4" />, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { id: 'fichas', label: 'Fichas Técnicas & Precificação', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'ocr', label: 'Leitor OCR de NFs (IA)', icon: <ScanText className="w-4 h-4" />, badge: 'IA' },
    { id: 'products', label: 'Produtos Finais', icon: <Package className="w-4 h-4" /> },
    { id: 'orders', label: 'Pedidos & Vendas', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'reports', label: 'Relatórios & Lucro', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'super_admin', label: 'Painel Super Admin', icon: <ShieldCheck className="w-4 h-4" />, badge: 'ADMIN' },
    { id: 'settings', label: 'Configurações', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-[#0B0B0C] border-r border-zinc-800/60 p-4 flex flex-col justify-between shrink-0 min-h-[calc(100vh-61px)]">
      
      {/* Navigation Links */}
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

      {/* Tenant License Info Widget */}
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
  );
};
