import React, { useState } from 'react';
import { Package, Plus, Search, Tag, DollarSign, Layers } from 'lucide-react';
import { Product, CurrencyType } from '../types';

interface ProductsModuleProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  currency: CurrencyType;
}

export const ProductsModule: React.FC<ProductsModuleProps> = ({ products, setProducts, currency }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/50">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Catálogo de Produtos Finais
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Prontos para Venda
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Produtos finais cadastrados manualmente ou gerados automaticamente a partir de Fichas Técnicas.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 rounded-2xl bg-[#121214] border border-zinc-800/80">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, SKU ou categoria..."
            className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-4 relative group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-amber-500">{p.sku}</span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {p.category}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center font-black text-amber-500 text-base">
                {p.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white leading-tight">{p.name}</h3>
                <div className="text-xs text-zinc-400 mt-0.5">{p.itemsSold} vendidos</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800/60 text-xs">
              <div>
                <div className="text-[10px] text-zinc-500">Estoque Atual</div>
                <div className="font-extrabold text-white">{p.stockQuantity} un</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500">Preço de Venda</div>
                <div className="font-black text-amber-400 text-sm">{formatCurrency(p.newPrice)}</div>
              </div>
            </div>

            {p.fichaTecnicaId && (
              <div className="text-[10px] text-zinc-500 flex items-center gap-1 font-medium pt-1">
                <Layers className="w-3 h-3 text-amber-500" /> Gerado via Ficha Técnica
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
};
