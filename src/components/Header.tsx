import React from 'react';
import { Search, Bell, Mail, Command, Sparkles, Store, ShieldCheck } from 'lucide-react';
import { CurrencyType, Tenant } from '../types';

interface HeaderProps {
  currency: CurrencyType;
  setCurrency: (currency: CurrencyType) => void;
  onOpenPromptModal?: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  tenants: Tenant[];
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
  onOpenSuperAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currency,
  setCurrency,
  onOpenPromptModal,
  searchTerm,
  setSearchTerm,
  tenants,
  activeTenantId,
  setActiveTenantId,
  onOpenSuperAdmin,
}) => {
  const currentTenant = tenants.find((t) => t.id === activeTenantId);

  return (
    <header className="sticky top-0 z-40 bg-[#0B0B0C]/90 backdrop-blur-md border-b border-zinc-800/60 px-6 py-3.5 flex items-center justify-between gap-4">
      
      {/* Brand & Search */}
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 font-black text-black text-xs tracking-wider shadow-lg shadow-orange-500/20">
            EBD
          </div>
          <div>
            <div className="font-extrabold text-white text-base tracking-tight leading-none flex items-center gap-1.5">
              <span>EBD</span>
              <span className="text-amber-400 font-black">ElBravoDantas</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                SaaS
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">Multi-tenant Retail & AI</span>
          </div>
        </div>

        {/* Store Context Switcher */}
        {tenants.length > 0 && (
          <div className="relative hidden md:block">
            <select
              value={activeTenantId}
              onChange={(e) => setActiveTenantId(e.target.value)}
              className="bg-[#121214] border border-amber-500/30 rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-400 hover:border-amber-500/60 focus:outline-none transition-all cursor-pointer appearance-none pr-8 shadow-sm"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  🏬 {t.name} ({t.plan})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 text-[10px]">
              ▼
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative flex-1 max-w-sm hidden lg:block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search anything..."
            className="w-full bg-[#121214] border border-zinc-800/80 rounded-xl pl-10 pr-12 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-700/50">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        
        {/* Super Admin Panel Button */}
        <button
          onClick={onOpenSuperAdmin}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Painel Admin</span>
        </button>

        {/* Currency Switcher */}
        <div className="relative">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyType)}
            className="bg-[#121214] border border-zinc-800/80 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-700 focus:outline-none focus:border-amber-500/60 transition-all cursor-pointer appearance-none pr-7"
          >
            <option value="BRL">BRL R$</option>
            <option value="USD">USD $</option>
            <option value="EUR">EUR €</option>
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px]">
            ▼
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-zinc-800/80">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt="User Avatar"
            className="w-8 h-8 rounded-xl object-cover ring-2 ring-amber-500/20"
          />
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold text-white leading-tight">Super Admin</div>
            <div className="text-[10px] text-amber-400 font-bold">Dono do Sistema SaaS</div>
          </div>
        </div>

      </div>
    </header>
  );
};
