import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingBag,
  SlidersHorizontal,
  MoreVertical,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Product, Order, CurrencyType } from '../types';

interface BentoDashboardProps {
  products: Product[];
  orders: Order[];
  currency: CurrencyType;
  onNavigate: (tab: any) => void;
}

export const BentoDashboard: React.FC<BentoDashboardProps> = ({
  products,
  orders,
  currency,
  onNavigate,
}) => {
  const [timeFilter, setTimeFilter] = useState<'All time' | 'Weekly' | 'Monthly'>('Monthly');

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/50">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Visão Geral de Vendas & Estoque
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Tempo Real
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Acompanhe o desempenho comercial, margem de lucro e movimento de insumos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('ocr')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all"
          >
            <Layers className="w-3.5 h-3.5" />
            Scanner de NF-e (OCR IA)
          </button>
          <button
            onClick={() => onNavigate('fichas')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all border border-zinc-700/50"
          >
            Fichas Técnicas
          </button>
        </div>
      </div>

      {/* BENTO GRID - ROW 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: Recent Orders Sparkline */}
        <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700/80 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Recent Orders</span>
            <button className="text-zinc-500 hover:text-white">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white tracking-tight">{formatCurrency(18745)}</span>
              <span className="text-xs font-bold text-red-400 flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" />
                8.4%
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">{formatCurrency(20461)} last month</div>
          </div>

          {/* SVG Sparkline Graph */}
          <div className="mt-4 pt-2 relative">
            <svg className="w-full h-12 overflow-visible" viewBox="0 0 200 40">
              <defs>
                <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF7A00" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#FF7A00" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0,35 Q 30,30 60,25 T 120,30 T 160,10 T 200,18"
                fill="none"
                stroke="#FF7A00"
                strokeWidth="2.5"
              />
              <path
                d="M 0,35 Q 30,30 60,25 T 120,30 T 160,10 T 200,18 L 200,40 L 0,40 Z"
                fill="url(#amberGrad)"
              />
              {/* Highlight Dot */}
              <circle cx="160" cy="10" r="4" fill="#FF7A00" className="animate-pulse" />
            </svg>
            <div className="absolute top-[-10px] right-8 bg-[#1A1A1E] text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/30 shadow-md">
              {formatCurrency(2104)}
            </div>
            <div className="flex justify-between text-[9px] text-zinc-500 mt-1 font-medium">
              <span>1 May</span>
              <span>8 May</span>
              <span>15 May</span>
              <span>22 May</span>
              <span>29 May</span>
            </div>
          </div>
        </div>

        {/* CARD 2: Total Customers */}
        <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Total Customers</span>
            <div className="p-1.5 rounded-lg bg-zinc-800/50 text-zinc-400">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div className="text-[10px] text-zinc-500">Current Customers</div>
              <div className="text-lg font-extrabold text-white">2,847</div>
              <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> 12.6% vs last mo
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500">New Customers (May)</div>
              <div className="text-lg font-extrabold text-white">742</div>
              <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> 16.3% vs Apr
              </div>
            </div>
          </div>

          {/* Gender Distribution Bar */}
          <div>
            <div className="text-[10px] text-zinc-400 mb-1.5 font-medium">Gender Distribution</div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
              <div className="bg-amber-500 h-full w-[58%]"></div>
              <div className="bg-zinc-600 h-full w-[42%]"></div>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400 mt-2 font-medium">
              <div>
                <span className="text-white font-bold">58%</span> Men (1,652)
              </div>
              <div>
                <span className="text-white font-bold">42%</span> Women (1,195)
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: Total Revenue */}
        <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Total Revenue</span>
            <div className="p-1.5 rounded-lg bg-zinc-800/50 text-zinc-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white tracking-tight">{formatCurrency(124680)}</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                22.7%
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{formatCurrency(101630)} last month</div>
          </div>

          {/* Revenue Bar Chart */}
          <div className="mt-3">
            <div className="text-[10px] text-zinc-400 mb-2 font-medium">Revenue over last 7 days</div>
            <div className="flex items-end justify-between gap-1.5 h-12">
              {[
                { day: 'Mon', h1: 40, h2: 25 },
                { day: 'Tue', h1: 65, h2: 40 },
                { day: 'Wed', h1: 50, h2: 30 },
                { day: 'Thu', h1: 85, h2: 55 },
                { day: 'Fri', h1: 95, h2: 70 },
                { day: 'Sat', h1: 75, h2: 50 },
                { day: 'Sun', h1: 60, h2: 35 },
              ].map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 h-10">
                    <div className="w-1.5 bg-amber-500 rounded-t-sm" style={{ height: `${bar.h1}%` }}></div>
                    <div className="w-1.5 bg-zinc-600 rounded-t-sm" style={{ height: `${bar.h2}%` }}></div>
                  </div>
                  <span className="text-[8px] text-zinc-500 font-medium">{bar.day}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-[9px] text-zinc-400 mt-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> This week
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span> Last week
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4: Top Categories Pie Chart */}
        <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Top Categories</span>
            <button className="text-zinc-500 hover:text-white">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Donut Simulation */}
          <div className="flex items-center justify-center my-1 relative">
            <div className="w-24 h-24 rounded-full border-[10px] border-amber-500 border-t-orange-600 border-r-amber-400 border-b-zinc-700 flex items-center justify-center relative">
              <div className="text-center">
                <div className="text-sm font-extrabold text-white">30%</div>
                <div className="text-[9px] text-zinc-400">Hoodies</div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-zinc-400 mt-1">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Hoodies 30%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-600"></span> Jeans 22%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Jackets 18%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-600"></span> Shoes 15%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-700"></span> T-Shirts 10%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-700"></span> Other 5%</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-center gap-1 bg-[#1A1A1E] p-1 rounded-xl mt-3">
            {(['All time', 'Weekly', 'Monthly'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setTimeFilter(item)}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  timeFilter === item ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* BENTO GRID - ROW 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* CARD 5: Total Orders Stacked Bar Chart */}
        <div className="lg:col-span-2 bg-[#121214] border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all flex flex-col justify-between relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white">Total Orders</h3>
              <p className="text-xs text-zinc-400">Evolução diária de Receita x Lucro Líquido</p>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Income
              </span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600"></span> Profit
              </span>
              <button className="text-zinc-500 hover:text-white p-1">
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tooltip Overlay Example (Matching Reference Image) */}
          <div className="absolute top-16 left-1/3 bg-[#1A1A1E] border border-zinc-700/80 rounded-xl p-3 shadow-2xl z-20 pointer-events-none text-xs space-y-1 animate-in fade-in">
            <div className="text-[10px] font-bold text-zinc-400">7 May</div>
            <div className="flex justify-between gap-4 text-zinc-300">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Income</span>
              <span className="font-bold text-white">{formatCurrency(4620)}</span>
            </div>
            <div className="flex justify-between gap-4 text-zinc-300">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-600"></span> Profit</span>
              <span className="font-bold text-white">{formatCurrency(1080)}</span>
            </div>
            <div className="border-t border-zinc-700 pt-1 flex justify-between gap-4 text-white font-bold">
              <span>Total</span>
              <span>{formatCurrency(5700)}</span>
            </div>
          </div>

          {/* Stacked Bars */}
          <div className="h-48 flex items-end justify-between gap-2 pt-6">
            {[
              { day: '1 May', inc: 45, prof: 15 },
              { day: '2 May', inc: 50, prof: 20 },
              { day: '3 May', inc: 55, prof: 18 },
              { day: '4 May', inc: 48, prof: 16 },
              { day: '5 May', inc: 60, prof: 22 },
              { day: '6 May', inc: 52, prof: 19 },
              { day: '7 May', inc: 75, prof: 28 }, // Peak
              { day: '8 May', inc: 40, prof: 12 },
              { day: '9 May', inc: 50, prof: 18 },
              { day: '10 May', inc: 58, prof: 20 },
              { day: '11 May', inc: 65, prof: 24 },
              { day: '12 May', inc: 78, prof: 30 },
              { day: '13 May', inc: 70, prof: 25 },
              { day: '14 May', inc: 55, prof: 20 },
              { day: '15 May', inc: 50, prof: 18 },
            ].map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer">
                <div className="w-full max-w-[18px] rounded-t-sm overflow-hidden flex flex-col-reverse group-hover:scale-105 transition-transform">
                  <div className="bg-amber-500 w-full" style={{ height: `${bar.inc * 1.8}px` }}></div>
                  <div className="bg-orange-600 w-full" style={{ height: `${bar.prof * 1.8}px` }}></div>
                </div>
                <span className="text-[9px] text-zinc-500 group-hover:text-amber-400 transition-colors font-medium whitespace-nowrap">
                  {bar.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 6: Customer Demographics */}
        <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white">Customer Demographics</h3>
              <p className="text-xs text-zinc-400">Perfil etário dos compradores</p>
            </div>
            <button className="text-zinc-500 hover:text-white">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {[
              { age: '18 - 24', pct: 24 },
              { age: '25 - 34', pct: 29 },
              { age: '35 - 44', pct: 21 },
              { age: '45 - 54', pct: 16 },
              { age: '55+', pct: 10 },
            ].map((demo, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-300">
                  <span>{demo.age}</span>
                  <span className="text-amber-400">{demo.pct}%</span>
                </div>
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                    style={{ width: `${demo.pct}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1 bg-[#1A1A1E] p-1 rounded-xl mt-4">
            <button className="flex-1 py-1 text-[10px] font-bold rounded-lg bg-amber-500 text-black">All time</button>
            <button className="flex-1 py-1 text-[10px] font-bold rounded-lg text-zinc-400 hover:text-white">Weekly</button>
            <button className="flex-1 py-1 text-[10px] font-bold rounded-lg text-zinc-400 hover:text-white">Monthly</button>
          </div>
        </div>

      </div>

      {/* BENTO GRID - ROW 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* CARD 7: Product Sales Table */}
        <div className="lg:col-span-2 bg-[#121214] border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white">Product Sales & Inventory</h3>
              <p className="text-xs text-zinc-400">Produtos mais vendidos e nível de estoque</p>
            </div>
            <button onClick={() => onNavigate('products')} className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1">
              Ver Todos <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-semibold text-[11px] pb-2">
                  <th className="pb-3">Item</th>
                  <th className="pb-3">Stock</th>
                  <th className="pb-3">Old Price</th>
                  <th className="pb-3">Sale</th>
                  <th className="pb-3">New Price</th>
                  <th className="pb-3 text-right">Items Sold</th>
                  <th className="pb-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 font-semibold text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center font-bold text-amber-500 text-xs shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <span className="truncate max-w-[140px]">{p.name}</span>
                    </td>
                    <td className="py-3 text-zinc-300 font-medium">
                      <span className={p.stockQuantity < 50 ? 'text-amber-400 font-bold' : ''}>
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-500 line-through">{formatCurrency(p.oldPrice)}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-bold text-[10px] border border-amber-500/20">
                        {p.saleDiscountPercent}%
                      </span>
                    </td>
                    <td className="py-3 text-white font-extrabold">{formatCurrency(p.newPrice)}</td>
                    <td className="py-3 text-right text-zinc-300 font-bold">{p.itemsSold}</td>
                    <td className="py-3 text-center text-zinc-500 hover:text-white">
                      <MoreVertical className="w-4 h-4 cursor-pointer inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARD 8: Recent Orders Feed */}
        <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white">Recent Orders</h3>
                <p className="text-xs text-zinc-400">Status de entregas em tempo real</p>
              </div>
              <button onClick={() => onNavigate('orders')} className="text-xs font-bold text-amber-500 hover:underline">
                Ver Pedidos
              </button>
            </div>

            <div className="space-y-3.5">
              {orders.map((ord) => {
                let statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                if (ord.status === 'Processing') statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                if (ord.status === 'Shipped') statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                if (ord.status === 'Cancelled') statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';

                return (
                  <div key={ord.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#17171A] border border-zinc-800/60 hover:border-zinc-700/80 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-white flex items-center gap-2">
                          {ord.orderNumber}
                        </div>
                        <div className="text-[11px] text-zinc-400">{ord.customerName}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-extrabold text-white mb-1">{formatCurrency(ord.totalAmount)}</div>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusColor}`}>
                          ● {ord.status}
                        </span>
                        <span className="text-[10px] text-zinc-500">{ord.timeAgo}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onNavigate('orders')}
            className="w-full mt-4 py-2 text-center text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-xl transition-all border border-zinc-700/50"
          >
            Gerenciar Todos os Pedidos
          </button>
        </div>

      </div>

    </div>
  );
};
