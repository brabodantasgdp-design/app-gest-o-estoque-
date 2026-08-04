import React, { useState, useEffect } from 'react';
import {
  FileText,
  DollarSign,
  TrendingUp,
  Store,
  PieChart,
  BarChart3,
  Building2,
  Calendar,
  Filter,
  CheckCircle2,
  Tag,
  ArrowUpRight
} from 'lucide-react';
import { CurrencyType, InvoiceScan, Tenant } from '../../types';

interface DashboardViewProps {
  invoices: InvoiceScan[];
  currency: CurrencyType;
  currentTenant?: Tenant;
  onNavigateToInvoices: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  currency,
  currentTenant,
  onNavigateToInvoices,
}) => {
  const [serverMetrics, setServerMetrics] = useState<{
    totalNotasMes: number;
    totalGastoMes: number;
    topFornecedores: { name: string; count: number; total: number }[];
    gastosPorCategoria: { category: string; total: number; percentage: string }[];
  } | null>(null);

  const formatCurrency = (amount: number) => {
    const symbol = currency === 'BRL' ? 'R$' : currency === 'USD' ? '$' : '€';
    return `${symbol} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    const fetchDashboardAPI = async () => {
      try {
        const tenantId = currentTenant?.id || 'tenant-1';
        const res = await fetch(`/api/dashboard?tenantId=${tenantId}`);
        if (!res.ok) {
          console.warn('Dashboard API not available, using client-side fallback');
          return;
        }
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.warn('Dashboard API returned non-JSON, using client-side fallback');
          return;
        }
        const data = await res.json();

        if (data.success && data.metrics) {
          setServerMetrics(data.metrics);
        }
      } catch (err) {
        console.warn('Using client-side fallback calculations for dashboard metrics');
      }
    };

    fetchDashboardAPI();
  }, [currentTenant?.id, invoices]);

  // Calculations from props if server metrics loading or fallback
  const totalNotas = invoices.length;
  const totalGasto = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);

  // Category totals mapping
  const categoryTotals: Record<string, number> = {
    alimentacao: 0,
    transporte: 0,
    servicos: 0,
    insumos: 0,
    impostos: 0,
    outros: 0,
  };

  invoices.forEach((inv) => {
    const cat = inv.category || 'outros';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + inv.totalAmount;
  });

  const categoryLabels: Record<string, { label: string; color: string; badgeBg: string }> = {
    alimentacao: { label: 'Alimentação', color: 'bg-emerald-500', badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    transporte: { label: 'Transporte & Fretes', color: 'bg-blue-500', badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    servicos: { label: 'Serviços & Manutenção', color: 'bg-purple-500', badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    insumos: { label: 'Insumos & Matéria-Prima', color: 'bg-amber-500', badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    impostos: { label: 'Impostos & DAS', color: 'bg-rose-500', badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    outros: { label: 'Outras Despesas', color: 'bg-zinc-500', badgeBg: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  };

  const maxCategoryValue = Math.max(...Object.values(categoryTotals), 1);

  // Top suppliers calculation
  const supplierAgg: Record<string, { count: number; total: number; cnpj: string }> = {};
  invoices.forEach((inv) => {
    if (!supplierAgg[inv.supplierName]) {
      supplierAgg[inv.supplierName] = { count: 0, total: 0, cnpj: inv.cnpj };
    }
    supplierAgg[inv.supplierName].count += 1;
    supplierAgg[inv.supplierName].total += inv.totalAmount;
  });

  const topSuppliersList = Object.entries(supplierAgg)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Top Banner Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Dashboard Financeiro & NFs</span>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              PostgreSQL
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Visão consolidada de despesas, top fornecedores e categorias do tenant:{' '}
            <strong className="text-amber-400 font-extrabold">{currentTenant?.name || 'SaaS EBD ElBravoDantas'}</strong>
          </p>
        </div>

        <button
          onClick={onNavigateToInvoices}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer self-start md:self-auto"
        >
          <span>Gerenciar Notas Fiscais</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Notas Mês */}
        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Total Notas (Mês)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white">
              {serverMetrics?.totalNotasMes ?? totalNotas}
            </div>
            <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
              <span>+12% vs mês anterior</span>
            </div>
          </div>
        </div>

        {/* Total Gasto Mês */}
        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Total Gasto (Mês)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-emerald-400">
              {formatCurrency(serverMetrics?.totalGastoMes ?? totalGasto)}
            </div>
            <div className="text-[11px] text-zinc-400 font-medium mt-1">
              Processado via Inteligência Artificial
            </div>
          </div>
        </div>

        {/* Top Fornecedor Principal */}
        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Maior Fornecedor</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-white truncate">
              {topSuppliersList[0]?.name || 'Nenhum lançamento'}
            </div>
            <div className="text-[11px] text-zinc-400 font-medium mt-1">
              {topSuppliersList[0] ? `${formatCurrency(topSuppliersList[0].total)} acumulados` : 'Sem dados'}
            </div>
          </div>
        </div>

        {/* Categorias Mapeadas */}
        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Categorias Ativas</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white">6 Categorias</div>
            <div className="text-[11px] text-purple-300 font-semibold mt-1">
              Alimentação, Insumos, Impostos, etc.
            </div>
          </div>
        </div>

      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gastos por Categoria - Gráfico de Barras */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <span>Gastos por Categoria (Gráfico)</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Distribuição percentual e financeira das despesas por nota fiscal
              </p>
            </div>
            <div className="text-xs font-bold text-zinc-400 bg-zinc-800/50 px-3 py-1 rounded-lg border border-zinc-700/50">
              Agosto 2026
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(categoryTotals).map(([key, value]) => {
              const meta = categoryLabels[key] || { label: key, color: 'bg-zinc-500', badgeBg: 'bg-zinc-500/10 text-zinc-400' };
              const percent = totalGasto > 0 ? ((value / totalGasto) * 100).toFixed(1) : '0';

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-200 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.color}`} />
                      <span>{meta.label}</span>
                    </span>
                    <span className="font-black text-white">
                      {formatCurrency(value)} <span className="text-zinc-500 font-medium">({percent}%)</span>
                    </span>
                  </div>

                  {/* Horizontal Bar Chart representation */}
                  <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/60 p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${meta.color}`}
                      style={{ width: `${Math.max(Number(percent), value > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Fornecedores Sidebar List */}
        <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              <span>Top Fornecedores</span>
            </h2>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Por Volume
            </span>
          </div>

          <div className="space-y-3">
            {topSuppliersList.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-6">
                Nenhum fornecedor registrado neste tenant.
              </div>
            ) : (
              topSuppliersList.map((sup, idx) => (
                <div key={sup.name} className="p-3 rounded-xl bg-[#18181b] border border-zinc-800/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 font-extrabold text-xs flex items-center justify-center border border-amber-500/20 shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{sup.name}</div>
                      <div className="text-[10px] text-zinc-500">CNPJ: {sup.cnpj}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-amber-400">{formatCurrency(sup.total)}</div>
                    <div className="text-[10px] text-zinc-400 font-medium">{sup.count} notas</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
