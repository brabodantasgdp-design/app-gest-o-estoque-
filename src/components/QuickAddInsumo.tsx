import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Zap, ChevronDown } from 'lucide-react';
import { Insumo, CurrencyType } from '../types';
import { insumosService } from '../lib/database';

interface QuickAddInsumoProps {
  isOpen: boolean;
  onClose: () => void;
  activeTenantId: string;
  currency: CurrencyType;
  onCreated: () => Promise<void>;
}

const QUICK_CATEGORIES = [
  { label: 'Farinhas', value: 'Farináceos & Grãos', unit: 'g' as const },
  { label: 'Laticínios', value: 'Laticínios', unit: 'g' as const },
  { label: 'Carnes', value: 'Carnes & Aves', unit: 'g' as const },
  { label: 'Bebidas', value: 'Bebidas & Sucos', unit: 'ml' as const },
  { label: 'Óleos', value: 'Óleos & Gorduras', unit: 'ml' as const },
  { label: 'Temperos', value: 'Temperos & Especiarias', unit: 'g' as const },
  { label: 'Embalagens', value: 'Embalagens & Descartáveis', unit: 'un' as const },
  { label: 'Limpeza', value: 'Produtos de Limpeza', unit: 'ml' as const },
  { label: 'Frutas', value: 'Frutas & Verduras', unit: 'g' as const },
  { label: 'Padaria', value: 'Padaria & Confeitaria', unit: 'g' as const },
];

export const QuickAddInsumo: React.FC<QuickAddInsumoProps> = ({
  isOpen,
  onClose,
  activeTenantId,
  currency,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [unit, setUnit] = useState<'g' | 'ml' | 'un'>('g');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && nameRef.current) {
      setTimeout(() => nameRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const resetForm = () => {
    setName('');
    setUnitCost('');
    setUnit('g');
    setCategory('');
    setSupplier('');
    setShowMore(false);
  };

  const handleQuickCategory = (cat: typeof QUICK_CATEGORIES[0]) => {
    setCategory(cat.value);
    setUnit(cat.unit);
  };

  const handleSave = async (andAnother: boolean) => {
    if (!name.trim()) return;
    setSaving(true);

    const newInsumo: Insumo = {
      id: `ins-${Date.now()}`,
      tenantId: activeTenantId,
      code: `INS-${Math.floor(100 + Math.random() * 900)}`,
      name: name.trim(),
      category: category || 'Outros',
      unit,
      currentStock: 0,
      minStock: 0,
      unitCost: Number(unitCost) || 0,
      supplier: supplier || 'Não informado',
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    try {
      await insumosService.create(newInsumo);
      await onCreated();
      setSavedCount(prev => prev + 1);
    } catch (err) {
      console.error('Error creating insumo:', err);
    }

    if (andAnother) {
      resetForm();
      setTimeout(() => nameRef.current?.focus(), 100);
    } else {
      onClose();
      resetForm();
      setSavedCount(0);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#121214] border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#18181b]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Cadastro Rápido</h3>
              {savedCount > 0 && (
                <p className="text-[10px] text-emerald-400 font-bold">{savedCount} insumo(s) salvo(s)</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          
          {/* Quick Category Chips */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Categoria Rápida</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => handleQuickCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                    category === cat.value
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-[#1A1A1E] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name - Main Field */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Nome do Insumo *</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Farinha de Trigo 1kg"
              className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>

          {/* Unit + Cost - Side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Unidade</label>
              <div className="flex bg-[#1A1A1E] border border-zinc-800 rounded-xl overflow-hidden">
                {(['g', 'ml', 'un'] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`flex-1 py-3 text-xs font-extrabold transition-all ${
                      unit === u
                        ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-500'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                Custo / {unit}
              </label>
              <input
                type="number"
                step="0.0001"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3.5 text-sm text-emerald-400 font-mono font-bold placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* More Options Toggle */}
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
            {showMore ? 'Menos opções' : 'Mais opções (fornecedor)'}
          </button>

          {showMore && (
            <div className="animate-in fade-in duration-200">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Fornecedor</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Atacadão"
                className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
        </div>

        {/* Action Buttons - Fixed bottom for thumb reach */}
        <div className="px-5 py-4 border-t border-zinc-800 bg-[#18181b] flex gap-3">
          <button
            onClick={() => handleSave(true)}
            disabled={!name.trim() || saving}
            className="flex-1 py-3.5 rounded-xl bg-[#1A1A1E] border border-zinc-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Salvar + Outro
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={!name.trim() || saving}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-xs hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-orange-500/20"
          >
            {saving ? 'Salvando...' : 'Salvar e Fechar'}
          </button>
        </div>
      </div>
    </div>
  );
};
