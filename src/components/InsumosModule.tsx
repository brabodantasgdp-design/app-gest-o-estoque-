import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  RefreshCw,
  Edit,
  Trash2,
  Check,
  TrendingDown,
  ArrowUpDown,
  Mic
} from 'lucide-react';
import { Insumo, CurrencyType, Product, Order } from '../types';
import { insumosService } from '../lib/database';
import { VoiceAssistant } from './VoiceAssistant';

interface InsumosModuleProps {
  insumos: Insumo[];
  setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
  currency: CurrencyType;
  activeTenantId: string;
  onRefresh: () => Promise<void>;
}

export const InsumosModule: React.FC<InsumosModuleProps> = ({ insumos, setInsumos, currency, activeTenantId, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stockAdjustModal, setStockAdjustModal] = useState<Insumo | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(1000);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);

  // Form State for new insumo
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Farináceos & Grãos');
  const [unit, setUnit] = useState<'g' | 'ml' | 'un'>('g');
  const [currentStock, setCurrentStock] = useState<number>(5000);
  const [minStock, setMinStock] = useState<number>(1000);
  const [unitCost, setUnitCost] = useState<number>(0.01);
  const [supplier, setSupplier] = useState('');

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 4 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 4 })}`;
  };

  const categories = ['All', ...Array.from(new Set(insumos.map((i) => i.category)))];

  const filteredInsumos = insumos.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesLowStock = !showLowStockOnly || item.currentStock <= item.minStock;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const handleCreateInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const newInsumo: Insumo = {
      id: `ins-${Date.now()}`,
      tenantId: activeTenantId,
      code: `INS-${Math.floor(100 + Math.random() * 900)}`,
      name,
      category,
      unit,
      currentStock: Number(currentStock),
      minStock: Number(minStock),
      unitCost: Number(unitCost),
      supplier: supplier || 'Fornecedor Padrão',
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    try {
      await insumosService.create(newInsumo);
      await onRefresh();
    } catch (err) {
      console.error('Error creating insumo:', err);
      setInsumos([newInsumo, ...insumos]);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setCategory('Farináceos & Grãos');
    setUnit('g');
    setCurrentStock(5000);
    setMinStock(1000);
    setUnitCost(0.01);
    setSupplier('');
  };

  const handleStockAdjustment = async (delta: number) => {
    if (!stockAdjustModal) return;
    const updated = {
      ...stockAdjustModal,
      currentStock: Math.max(0, stockAdjustModal.currentStock + delta),
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    try {
      await insumosService.update(stockAdjustModal.id, updated);
      await onRefresh();
    } catch (err) {
      console.error('Error adjusting stock:', err);
      setInsumos(
        insumos.map((item) =>
          item.id === stockAdjustModal.id ? updated : item
        )
      );
    }
    setStockAdjustModal(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este insumo?')) {
      try {
        await insumosService.delete(id);
        await onRefresh();
      } catch (err) {
        console.error('Error deleting insumo:', err);
        setInsumos(insumos.filter((i) => i.id !== id));
      }
    }
  };

  const handleVoiceAddStock = async (insumoName: string, quantity: number, unit: string) => {
    const insumo = insumos.find(i => 
      i.name.toLowerCase().includes(insumoName.toLowerCase())
    );
    if (!insumo) {
      throw new Error(`Insumo "${insumoName}" não encontrado`);
    }
    const updated = {
      ...insumo,
      currentStock: insumo.currentStock + quantity,
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    await insumosService.update(insumo.id, updated);
    await onRefresh();
  };

  const handleVoiceRemoveStock = async (insumoName: string, quantity: number, unit: string) => {
    const insumo = insumos.find(i => 
      i.name.toLowerCase().includes(insumoName.toLowerCase())
    );
    if (!insumo) {
      throw new Error(`Insumo "${insumoName}" não encontrado`);
    }
    const updated = {
      ...insumo,
      currentStock: Math.max(0, insumo.currentStock - quantity),
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    await insumosService.update(insumo.id, updated);
    await onRefresh();
  };

  const handleVoiceCreateInsumo = async (name: string, quantity: number, unit: string, price: number) => {
    const newInsumo: Insumo = {
      id: `ins-${Date.now()}`,
      tenantId: activeTenantId,
      code: `INS-${Math.floor(100 + Math.random() * 900)}`,
      name,
      category: 'Voz',
      unit: unit as 'g' | 'ml' | 'un',
      currentStock: quantity,
      minStock: Math.floor(quantity * 0.2),
      unitCost: price / quantity,
      supplier: 'Via assistente de voz',
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    await insumosService.create(newInsumo);
    await onRefresh();
  };

  const handleVoiceQueryStock = (insumoName: string) => {
    const insumo = insumos.find(i => 
      i.name.toLowerCase().includes(insumoName.toLowerCase())
    );
    if (!insumo) return null;
    return { currentStock: insumo.currentStock, unit: insumo.unit };
  };

  const formatUnitDisplay = (qty: number, unit: 'g' | 'ml' | 'un') => {
    if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toLocaleString('pt-BR')} kg`;
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toLocaleString('pt-BR')} L`;
    return `${qty.toLocaleString('pt-BR')} ${unit}`;
  };

  return (
    <div className="space-y-4 lg:space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header & Action Bar */}
      <div className="flex flex-col gap-4 pb-2 border-b border-zinc-800/50">
        <div>
          <h1 className="text-lg lg:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span className="truncate">Insumos & Matérias-Primas</span>
            <span className="text-[10px] lg:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
              g / ml / un
            </span>
          </h1>
          <p className="text-[11px] lg:text-xs text-zinc-400 mt-1">
            Controle de estoques e custo unitário.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsVoiceAssistantOpen(true)}
            className="flex items-center justify-center gap-2 px-3 lg:px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-extrabold text-xs shadow-lg shadow-purple-500/20 transition-all active:scale-95"
          >
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Assistente de Voz</span>
            <span className="sm:hidden">Voz</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 lg:px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Insumo</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="p-3 lg:p-4 rounded-2xl bg-[#121214] border border-zinc-800/80">
          <div className="text-[10px] lg:text-xs text-zinc-400">Total</div>
          <div className="text-xl lg:text-2xl font-black text-white mt-1">{insumos.length}</div>
          <div className="text-[9px] lg:text-[10px] text-zinc-500 mt-1">insumos</div>
        </div>

        <div className="p-3 lg:p-4 rounded-2xl bg-[#121214] border border-zinc-800/80">
          <div className="text-[10px] lg:text-xs text-zinc-400">Alertas</div>
          <div className="text-xl lg:text-2xl font-black text-amber-400 mt-1">
            {insumos.filter((i) => i.currentStock <= i.minStock).length}
          </div>
          <div className="text-[9px] lg:text-[10px] text-amber-500 mt-1 font-medium">estoque baixo</div>
        </div>

        <div className="p-3 lg:p-4 rounded-2xl bg-[#121214] border border-zinc-800/80">
          <div className="text-[10px] lg:text-xs text-zinc-400">Valor Total</div>
          <div className="text-lg lg:text-2xl font-black text-emerald-400 mt-1">
            {formatCurrency(
              insumos.reduce((acc, i) => acc + i.currentStock * i.unitCost, 0)
            )}
          </div>
          <div className="text-[9px] lg:text-[10px] text-zinc-500 mt-1">estoque</div>
        </div>

        <div className="p-3 lg:p-4 rounded-2xl bg-[#121214] border border-zinc-800/80">
          <div className="text-[10px] lg:text-xs text-zinc-400">Categorias</div>
          <div className="text-xl lg:text-2xl font-black text-white mt-1">{categories.length - 1}</div>
          <div className="text-[9px] lg:text-[10px] text-zinc-500 mt-1">ativas</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 lg:p-4 rounded-2xl bg-[#121214] border border-zinc-800/80 flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar insumo..."
            className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 min-w-[120px] bg-[#1A1A1E] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'Todas' : c}</option>
            ))}
          </select>

          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`flex-1 min-w-[100px] px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              showLowStockOnly
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-[#1A1A1E] text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Estoque Crítico
          </button>
        </div>
      </div>

      {/* Insumos Main Table - Desktop */}
      <div className="hidden lg:block bg-[#121214] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-[#17171A] text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Insumo</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Unid.</th>
                <th className="py-3.5 px-4">Estoque Atual</th>
                <th className="py-3.5 px-4">Estoque Mín.</th>
                <th className="py-3.5 px-4">Custo Base</th>
                <th className="py-3.5 px-4">Fornecedor</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filteredInsumos.map((item) => {
                const isLowStock = item.currentStock <= item.minStock;

                return (
                  <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-amber-500 font-bold">{item.code}</td>
                    <td className="py-3.5 px-4 font-extrabold text-white">{item.name}</td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-medium text-[11px]">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">{item.unit}</td>
                    <td className="py-3.5 px-4 font-extrabold text-white">
                      <div className="flex items-center gap-2">
                        <span>{formatUnitDisplay(item.currentStock, item.unit)}</span>
                        {isLowStock && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Crítico
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-medium">
                      {formatUnitDisplay(item.minStock, item.unit)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-400">
                      {formatCurrency(item.unitCost)} / {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 max-w-[150px] truncate">{item.supplier}</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setStockAdjustModal(item)}
                          title="Ajustar Estoque"
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 transition-colors"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Excluir"
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInsumos.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500">
                    Nenhum insumo encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insumos Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredInsumos.map((item) => {
          const isLowStock = item.currentStock <= item.minStock;
          return (
            <div key={item.id} className={`p-4 rounded-2xl border ${isLowStock ? 'bg-red-500/5 border-red-500/20' : 'bg-[#121214] border-zinc-800/80'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-amber-500">{item.code}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400">{item.unit}</span>
                    {isLowStock && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[9px] font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Baixo
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-extrabold text-white truncate">{item.name}</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{item.category}</p>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    onClick={() => setStockAdjustModal(item)}
                    className="p-2 rounded-lg bg-zinc-800 text-amber-400"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 rounded-xl bg-[#1A1A1E]">
                  <div className="text-[9px] text-zinc-500 mb-0.5">Estoque</div>
                  <div className="text-xs font-bold text-white">{formatUnitDisplay(item.currentStock, item.unit)}</div>
                </div>
                <div className="p-2 rounded-xl bg-[#1A1A1E]">
                  <div className="text-[9px] text-zinc-500 mb-0.5">Mínimo</div>
                  <div className="text-xs font-bold text-zinc-400">{formatUnitDisplay(item.minStock, item.unit)}</div>
                </div>
                <div className="p-2 rounded-xl bg-[#1A1A1E]">
                  <div className="text-[9px] text-zinc-500 mb-0.5">Custo</div>
                  <div className="text-xs font-bold text-emerald-400">{formatCurrency(item.unitCost)}</div>
                </div>
              </div>
              
              {item.supplier && (
                <p className="text-[10px] text-zinc-500 mt-2 truncate">Forn: {item.supplier}</p>
              )}
            </div>
          );
        })}

        {filteredInsumos.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-sm">
            Nenhum insumo encontrado.
          </div>
        )}
      </div>

      {/* MODAL: Novo Insumo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#121214] border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-500" /> Cadastrar Novo Insumo
            </h3>

            <form onSubmit={handleCreateInsumo} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Nome da Matéria-Prima / Insumo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Farinha de Trigo Especial 1kg"
                  className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Farináceos, Laticínios"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Unidade de Medida</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-bold text-amber-400"
                  >
                    <option value="g">Gramas (g)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="un">Unidades (un)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Estoque Inicial ({unit})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={currentStock}
                    onChange={(e) => setCurrentStock(Number(e.target.value))}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Ponto Mínimo ({unit})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Custo por 1 {unit}</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Fornecedor Preferencial</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ex: Atacadão Distribuidora Ltda"
                  className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold hover:from-amber-600 hover:to-orange-600 shadow-md"
                >
                  Salvar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ajuste Rápido de Estoque */}
      {stockAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-extrabold text-white">
              Ajustar Saldo de Estoque - <span className="text-amber-500">{stockAdjustModal.name}</span>
            </h3>

            <div className="p-3 rounded-xl bg-[#1A1A1E] border border-zinc-800 text-xs space-y-1">
              <div className="text-zinc-400">Saldo Atual: <strong className="text-white">{formatUnitDisplay(stockAdjustModal.currentStock, stockAdjustModal.unit)}</strong></div>
              <div className="text-zinc-400">Custo Base Atual: <strong className="text-emerald-400">{formatCurrency(stockAdjustModal.unitCost)}/{stockAdjustModal.unit}</strong></div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-bold mb-1">
                Quantidade a Adicionar/Remover ({stockAdjustModal.unit}):
              </label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleStockAdjustment(adjustAmount)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs"
              >
                + Entrada ({adjustAmount} {stockAdjustModal.unit})
              </button>
              <button
                onClick={() => handleStockAdjustment(-adjustAmount)}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs"
              >
                - Saída / Baixa
              </button>
            </div>

            <button
              onClick={() => setStockAdjustModal(null)}
              className="w-full py-2 text-center text-xs text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Voice Assistant Modal */}
      <VoiceAssistant
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        insumos={insumos}
        products={[]}
        orders={[]}
        onAddStock={handleVoiceAddStock}
        onRemoveStock={handleVoiceRemoveStock}
        onCreateInsumo={handleVoiceCreateInsumo}
        onQueryStock={handleVoiceQueryStock}
      />

    </div>
  );
};
