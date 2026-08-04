import React, { useState } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Trash2,
  Mic,
  Package,
  Minus,
  X
} from 'lucide-react';
import { Insumo, CurrencyType } from '../types';
import { insumosService } from '../lib/database';

interface InsumosModuleProps {
  insumos: Insumo[];
  setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
  currency: CurrencyType;
  activeTenantId: string;
  onRefresh: () => Promise<void>;
}

export const InsumosModule: React.FC<InsumosModuleProps> = ({ 
  insumos, 
  setInsumos, 
  currency, 
  activeTenantId, 
  onRefresh 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState<Insumo | null>(null);
  
  // Quick Add State
  const [quickName, setQuickName] = useState('');
  const [quickQty, setQuickQty] = useState('');
  const [quickUnit, setQuickUnit] = useState<'g' | 'ml' | 'un'>('g');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickPrice, setQuickPrice] = useState('');
  
  // Adjust State
  const [adjustQty, setAdjustQty] = useState('');

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toFixed(2)}`;
    if (currency === 'EUR') return `€${val.toFixed(2)}`;
    return `$${val.toFixed(2)}`;
  };

  const formatUnit = (qty: number, unit: string) => {
    if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(1)}kg`;
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(1)}L`;
    return `${qty}${unit}`;
  };

  const filteredInsumos = insumos.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStock = !showLowStockOnly || item.currentStock <= item.minStock;
    return matchSearch && matchStock;
  });

  const lowStockCount = insumos.filter(i => i.currentStock <= i.minStock).length;
  const totalValue = insumos.reduce((acc, i) => acc + i.currentStock * i.unitCost, 0);

  // Quick Add New Insumo
  const handleQuickAddNew = async () => {
    if (!quickName || !quickQty) return;
    
    const newInsumo: Omit<Insumo, 'id'> = {
      tenantId: activeTenantId,
      code: `INS-${Math.floor(100 + Math.random() * 900)}`,
      name: quickName,
      category: quickCategory || 'Geral',
      unit: quickUnit,
      currentStock: Number(quickQty),
      minStock: Math.floor(Number(quickQty) * 0.2),
      unitCost: quickPrice ? Number(quickPrice) / Number(quickQty) : 0,
      supplier: 'Não informado',
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    try {
      await insumosService.create(newInsumo);
      await onRefresh();
      resetQuickAdd();
      setShowAddModal(false);
    } catch (err) {
      console.error('Error:', err);
      // Fallback local
      setInsumos([{ ...newInsumo, id: `ins-${Date.now()}` }, ...insumos]);
      resetQuickAdd();
      setShowAddModal(false);
    }
  };

  // Quick Adjust Stock
  const handleQuickAdjust = async (insumo: Insumo, delta: number) => {
    const newStock = Math.max(0, insumo.currentStock + delta);
    const updated = { ...insumo, currentStock: newStock, lastUpdated: new Date().toISOString().split('T')[0] };
    
    try {
      await insumosService.update(insumo.id, updated);
      await onRefresh();
    } catch (err) {
      setInsumos(insumos.map(i => i.id === insumo.id ? updated : i));
    }
    setShowQuickAdd(null);
    setAdjustQty('');
  };

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este insumo?')) return;
    try {
      await insumosService.delete(id);
      await onRefresh();
    } catch (err) {
      setInsumos(insumos.filter(i => i.id !== id));
    }
  };

  const resetQuickAdd = () => {
    setQuickName('');
    setQuickQty('');
    setQuickUnit('g');
    setQuickCategory('');
    setQuickPrice('');
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            Insumos
          </h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-[#121214] border border-zinc-800 text-center">
            <div className="text-lg font-black text-white">{insumos.length}</div>
            <div className="text-[10px] text-zinc-500">Total</div>
          </div>
          <div className="p-3 rounded-xl bg-[#121214] border border-zinc-800 text-center">
            <div className="text-lg font-black text-amber-400">{lowStockCount}</div>
            <div className="text-[10px] text-amber-500">Estoque Baixo</div>
          </div>
          <div className="p-3 rounded-xl bg-[#121214] border border-zinc-800 text-center">
            <div className="text-lg font-black text-emerald-400 text-sm">{formatCurrency(totalValue)}</div>
            <div className="text-[10px] text-zinc-500">Valor Total</div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border ${
              showLowStockOnly 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                : 'bg-[#1A1A1E] text-zinc-400 border-zinc-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Insumos List */}
      <div className="space-y-2">
        {filteredInsumos.map(insumo => {
          const isLow = insumo.currentStock <= insumo.minStock;
          return (
            <div 
              key={insumo.id}
              className={`p-3 rounded-xl border ${
                isLow ? 'bg-red-500/5 border-red-500/20' : 'bg-[#121214] border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500">{insumo.code}</span>
                    {isLow && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">
                        BAIXO
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white truncate">{insumo.name}</h3>
                  <p className="text-[10px] text-zinc-500">{insumo.category}</p>
                </div>
                
                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    onClick={() => setShowQuickAdd(insumo)}
                    className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(insumo.id)}
                    className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[#1A1A1E]">
                  <div className="text-[9px] text-zinc-500">Estoque</div>
                  <div className={`text-xs font-bold ${isLow ? 'text-red-400' : 'text-white'}`}>
                    {formatUnit(insumo.currentStock, insumo.unit)}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#1A1A1E]">
                  <div className="text-[9px] text-zinc-500">Mínimo</div>
                  <div className="text-xs font-bold text-zinc-400">
                    {formatUnit(insumo.minStock, insumo.unit)}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#1A1A1E]">
                  <div className="text-[9px] text-zinc-500">Custo</div>
                  <div className="text-xs font-bold text-emerald-400">
                    {formatCurrency(insumo.unitCost)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredInsumos.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-sm">
            Nenhum insumo encontrado
          </div>
        )}
      </div>

      {/* MODAL: Add New Insumo */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80">
          <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Novo Insumo</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="Nome do insumo"
                className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={quickQty}
                  onChange={(e) => setQuickQty(e.target.value)}
                  placeholder="Qtd"
                  className="col-span-1 bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <div className="col-span-1 flex bg-[#1A1A1E] border border-zinc-800 rounded-xl overflow-hidden">
                  {(['g', 'ml', 'un'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => setQuickUnit(u)}
                      className={`flex-1 text-xs font-bold ${quickUnit === u ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value)}
                  placeholder="Categoria"
                  className="col-span-1 bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <input
                type="number"
                step="0.01"
                value={quickPrice}
                onChange={(e) => setQuickPrice(e.target.value)}
                placeholder="Custo total (opcional)"
                className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-sm text-emerald-400 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={handleQuickAddNew}
              disabled={!quickName || !quickQty}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm disabled:opacity-50"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Quick Adjust Stock */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm bg-[#121214] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <h3 className="text-base font-bold text-white">{showQuickAdd.name}</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Estoque atual: <span className="text-amber-400 font-bold">{formatUnit(showQuickAdd.currentStock, showQuickAdd.unit)}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleQuickAdjust(showQuickAdd, -Number(adjustQty || 1))}
                className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Minus className="w-4 h-4" />
                Remover
              </button>
              <button
                onClick={() => handleQuickAdjust(showQuickAdd, Number(adjustQty || 1))}
                className="flex-1 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            <input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="Quantidade"
              className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-center text-sm text-white font-bold focus:outline-none focus:border-amber-500"
            />

            <button
              onClick={() => { setShowQuickAdd(null); setAdjustQty(''); }}
              className="w-full py-2 text-center text-xs text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
