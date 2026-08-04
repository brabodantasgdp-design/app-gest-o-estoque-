import React, { useState, useMemo } from 'react';
import { X, Package, Calculator, Info } from 'lucide-react';
import { Insumo, CurrencyType } from '../types';

type UnitType = 'g' | 'ml' | 'un';

interface AddInsumoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: Omit<Insumo, 'id'>) => Promise<void>;
  currency: CurrencyType;
  activeTenantId: string;
}

interface FormData {
  name: string;
  code: string;
  category: string;
  unit: UnitType;
  currentStock: string;
  minStock: string;
  pricePaid: string;
  packageSize: string;
  supplier: string;
}

const UNIT_LABELS: Record<UnitType, {
  package: string;
  costPerUnit: string;
  stock: string;
  minStock: string;
  placeholder: {
    packageSize: string;
    costPerUnit: string;
  };
}> = {
  g: {
    package: 'Tamanho da Embalagem (g)',
    costPerUnit: 'Custo por grama',
    stock: 'Estoque Atual (g)',
    minStock: 'Estoque Mínimo (g)',
    placeholder: {
      packageSize: 'Ex: 1000 (1kg)',
      costPerUnit: 'R$ por grama',
    },
  },
  ml: {
    package: 'Tamanho da Embalagem (ml)',
    costPerUnit: 'Custo por ml',
    stock: 'Estoque Atual (ml)',
    minStock: 'Estoque Mínimo (ml)',
    placeholder: {
      packageSize: 'Ex: 5000 (5L)',
      costPerUnit: 'R$ por ml',
    },
  },
  un: {
    package: 'Quantidade na Embalagem (un)',
    costPerUnit: 'Custo por unidade',
    stock: 'Estoque Atual (un)',
    minStock: 'Estoque Mínimo (un)',
    placeholder: {
      packageSize: 'Ex: 12 (dúzia)',
      costPerUnit: 'R$ por unidade',
    },
  },
};

const UNIT_GROUPS = [
  { value: 'g', label: 'g', sublabel: 'Gramas' },
  { value: 'ml', label: 'ml', sublabel: 'Mililitros' },
  { value: 'un', label: 'un', sublabel: 'Unidades' },
] as const;

export const AddInsumoModal: React.FC<AddInsumoModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  currency,
  activeTenantId,
}) => {
  const [form, setForm] = useState<FormData>({
    name: '',
    code: `INS-${Math.floor(100 + Math.random() * 900)}`,
    category: '',
    unit: 'g',
    currentStock: '',
    minStock: '',
    pricePaid: '',
    packageSize: '',
    supplier: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate cost per unit automatically
  const costPerUnit = useMemo(() => {
    const price = parseFloat(form.pricePaid) || 0;
    const size = parseFloat(form.packageSize) || 0;
    if (price > 0 && size > 0) {
      return price / size;
    }
    return 0;
  }, [form.pricePaid, form.packageSize]);

  // Get labels based on selected unit
  const labels = UNIT_LABELS[form.unit];

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toFixed(4)}`;
    if (currency === 'EUR') return `€${val.toFixed(4)}`;
    return `$${val.toFixed(4)}`;
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    const qty = parseFloat(form.currentStock);
    if (!form.currentStock || isNaN(qty) || qty < 0) {
      newErrors.currentStock = 'Quantidade inválida';
    }

    if (form.pricePaid && form.packageSize) {
      const price = parseFloat(form.pricePaid);
      const size = parseFloat(form.packageSize);
      if (isNaN(price) || price < 0) {
        newErrors.pricePaid = 'Preço inválido';
      }
      if (isNaN(size) || size <= 0) {
        newErrors.packageSize = 'Tamanho inválido';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const qty = parseFloat(form.currentStock) || 0;
      const minQty = parseFloat(form.minStock) || Math.floor(qty * 0.2);

      const newInsumo: Omit<Insumo, 'id'> = {
        tenantId: activeTenantId,
        code: form.code,
        name: form.name.trim(),
        category: form.category || 'Geral',
        unit: form.unit,
        currentStock: qty,
        minStock: minQty,
        unitCost: costPerUnit,
        supplier: form.supplier || 'Não informado',
        lastUpdated: new Date().toISOString().split('T')[0],
      };

      await onAdd(newInsumo);
      onClose();
      
      // Reset form
      setForm({
        name: '',
        code: `INS-${Math.floor(100 + Math.random() * 900)}`,
        category: '',
        unit: 'g',
        currentStock: '',
        minStock: '',
        pricePaid: '',
        packageSize: '',
        supplier: '',
      });
    } catch (err) {
      console.error('Error adding insumo:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80">
      <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Package className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Novo Insumo</h3>
              <p className="text-[10px] text-zinc-500">Preencha os dados do produto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          
          {/* Name */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
              Nome do Insumo *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Ex: Farinha de Trigo"
              className={`w-full bg-[#1A1A1E] border rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors ${
                errors.name ? 'border-red-500' : 'border-zinc-800'
              }`}
            />
            {errors.name && (
              <p className="text-[10px] text-red-400 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Unit Selector */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
              Unidade de Medida *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {UNIT_GROUPS.map(u => (
                <button
                  key={u.value}
                  onClick={() => updateField('unit', u.value)}
                  className={`py-3 rounded-xl border text-center transition-all ${
                    form.unit === u.value
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-[#1A1A1E] border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-lg font-black">{u.label}</div>
                  <div className="text-[9px] text-zinc-500">{u.sublabel}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Price Paid & Package Size - Calculator */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-amber-500" />
              <span className="text-[11px] font-bold text-amber-400">Calculadora de Custo</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 mb-1 block">
                  Preço Pago (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pricePaid}
                  onChange={(e) => updateField('pricePaid', e.target.value)}
                  placeholder="Ex: 45.90"
                  className={`w-full bg-[#0B0B0C] border rounded-xl p-3 text-sm text-emerald-400 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors ${
                    errors.pricePaid ? 'border-red-500' : 'border-zinc-800'
                  }`}
                />
                {errors.pricePaid && (
                  <p className="text-[10px] text-red-400 mt-1">{errors.pricePaid}</p>
                )}
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-zinc-400 mb-1 block">
                  {labels.package} *
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.packageSize}
                  onChange={(e) => updateField('packageSize', e.target.value)}
                  placeholder={labels.placeholder.packageSize}
                  className={`w-full bg-[#0B0B0C] border rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors ${
                    errors.packageSize ? 'border-red-500' : 'border-zinc-800'
                  }`}
                />
                {errors.packageSize && (
                  <p className="text-[10px] text-red-400 mt-1">{errors.packageSize}</p>
                )}
              </div>
            </div>

            {/* Calculated Cost Result */}
            {costPerUnit > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-emerald-400 font-bold">{labels.costPerUnit}</p>
                    <p className="text-lg font-black text-emerald-400">{formatCurrency(costPerUnit)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-zinc-500">
                      {form.unit === 'g' && `${(costPerUnit * 1000).toFixed(2)}/kg`}
                      {form.unit === 'ml' && `${(costPerUnit * 1000).toFixed(2)}/L`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stock Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
                {labels.stock} *
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={form.currentStock}
                onChange={(e) => updateField('currentStock', e.target.value)}
                placeholder="0"
                className={`w-full bg-[#1A1A1E] border rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors ${
                  errors.currentStock ? 'border-red-500' : 'border-zinc-800'
                }`}
              />
              {errors.currentStock && (
                <p className="text-[10px] text-red-400 mt-1">{errors.currentStock}</p>
              )}
            </div>
            
            <div>
              <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
                {labels.minStock}
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={form.minStock}
                onChange={(e) => updateField('minStock', e.target.value)}
                placeholder="Mínimo"
                className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Category & Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
                Categoria
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                placeholder="Ex: Farináceos"
                className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            
            <div>
              <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
                Fornecedor
              </label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => updateField('supplier', e.target.value)}
                placeholder="Opcional"
                className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-[10px] text-zinc-400 leading-relaxed">
                <span className="text-blue-400 font-bold">Dica:</span> Preencha o preço pago e o tamanho da embalagem para calcular automaticamente o custo por {form.unit === 'g' ? 'grama' : form.unit === 'ml' ? 'ml' : 'unidade'}.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 bg-[#0B0B0C]">
          <button
            onClick={handleSubmit}
            disabled={!form.name || !form.currentStock || isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? 'Adicionando...' : 'Adicionar Insumo'}
          </button>
        </div>
      </div>
    </div>
  );
};
