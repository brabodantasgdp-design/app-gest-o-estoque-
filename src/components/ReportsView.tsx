import React from 'react';
import { TrendingUp, DollarSign, BarChart3, Package } from 'lucide-react';
import { FichaTecnica, Insumo, Product, InvoiceScan, CurrencyType, Tenant } from '../types';

interface ReportsViewProps {
  fichas: FichaTecnica[];
  insumos: Insumo[];
  products: Product[];
  invoices: InvoiceScan[];
  currency: CurrencyType;
  currentTenant?: Tenant;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  fichas,
  insumos,
  products,
  invoices,
  currency,
  currentTenant,
}) => {
  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const avgMargin = fichas.length > 0
    ? fichas.reduce((acc, f) => acc + f.profitMarginRate, 0) / fichas.length
    : 0;

  const totalInsumoValue = insumos.reduce((acc, i) => acc + i.currentStock * i.unitCost, 0);
  const totalInvoiceSpent = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalProductsRevenue = products.reduce((acc, p) => acc + p.newPrice * p.itemsSold, 0);
  const avgCMV = totalProductsRevenue > 0
    ? (totalInsumoValue / totalProductsRevenue) * 100
    : 0;

  const fichasWithHighestMargin = [...fichas].sort((a, b) => b.profitMarginRate - a.profitMarginRate).slice(0, 5);
  const fichasWithLowestMargin = [...fichas].sort((a, b) => a.profitMarginRate - b.profitMarginRate).slice(0, 5);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="pb-2 border-b border-zinc-800/50">
        <h1 className="text-xl font-extrabold text-white">Relatórios Financeiros & Lucratividade</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Análise de margem por ficha técnica e CMV da loja: <strong className="text-amber-400">{currentTenant?.name || 'EBD ElBravoDantas'}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Margem Média de Lucro</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-400">{avgMargin.toFixed(1)}%</div>
          <div className="text-[10px] text-zinc-500">Baseado em {fichas.length} fichas técnicas</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">CMV (Custo Matéria-Prima)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-white">{avgCMV.toFixed(1)}%</div>
          <div className="text-[10px] text-zinc-500">Custo total em estoque: {formatCurrency(totalInsumoValue)}</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Total Gasto em NFs</span>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-blue-400">{formatCurrency(totalInvoiceSpent)}</div>
          <div className="text-[10px] text-zinc-500">{invoices.length} notas fiscais processadas</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Produtos Cadastrados</span>
            <Package className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-black text-purple-400">{products.length}</div>
          <div className="text-[10px] text-zinc-500">Receita total: {formatCurrency(totalProductsRevenue)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Top 5 Maior Margem de Lucro
          </h3>
          {fichasWithHighestMargin.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-6">Nenhuma ficha técnica cadastrada.</div>
          ) : (
            <div className="space-y-2">
              {fichasWithHighestMargin.map((f, idx) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-extrabold text-xs flex items-center justify-center border border-emerald-500/20">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{f.productName}</div>
                      <div className="text-[10px] text-zinc-500">{f.code} • {f.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-emerald-400">{f.profitMarginRate.toFixed(1)}%</div>
                    <div className="text-[10px] text-zinc-400">{formatCurrency(f.netProfitPerUnit)}/un</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-500" />
            Top 5 Menor Margem (Revisão)
          </h3>
          {fichasWithLowestMargin.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-6">Nenhuma ficha técnica cadastrada.</div>
          ) : (
            <div className="space-y-2">
              {fichasWithLowestMargin.map((f, idx) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 font-extrabold text-xs flex items-center justify-center border border-amber-500/20">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{f.productName}</div>
                      <div className="text-[10px] text-zinc-500">{f.code} • Custo: {formatCurrency(f.totalProductionCost)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-amber-400">{f.profitMarginRate.toFixed(1)}%</div>
                    <div className="text-[10px] text-zinc-400">Preço: {formatCurrency(f.finalPrice)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
