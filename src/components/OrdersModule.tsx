import React, { useState } from 'react';
import { ShoppingCart, Plus, Search, Filter, ShoppingBag } from 'lucide-react';
import { Order, CurrencyType } from '../types';

interface OrdersModuleProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currency: CurrencyType;
}

export const OrdersModule: React.FC<OrdersModuleProps> = ({ orders, setOrders, currency }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/50">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Rastreamento de Pedidos & Vendas
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Real-time
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Acompanhe a entrada de novos pedidos, atualizações de entrega e faturamento.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="p-4 rounded-2xl bg-[#121214] border border-zinc-800/80">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por #pedido, cliente ou status..."
            className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-[#17171A] text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Pedido</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Itens</th>
                <th className="py-3.5 px-4">Valor Total</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Data / Horário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filteredOrders.map((ord) => {
                let statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                if (ord.status === 'Processing') statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                if (ord.status === 'Shipped') statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                if (ord.status === 'Cancelled') statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';

                return (
                  <tr key={ord.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-amber-500 font-mono">{ord.orderNumber}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-white">{ord.customerName}</div>
                      <div className="text-[10px] text-zinc-500">{ord.customerEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {ord.items.map((i, idx) => (
                        <div key={idx} className="text-[11px]">
                          {i.quantity}x {i.productName}
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-4 font-black text-white">{formatCurrency(ord.totalAmount)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-md border text-[10px] font-bold ${statusColor}`}>
                        ● {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-zinc-400 font-medium">
                      <div>{ord.date}</div>
                      <div className="text-[10px] text-zinc-500">{ord.timeAgo}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
