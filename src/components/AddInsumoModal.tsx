import React, { useState, useMemo } from 'react';
import { X, Package, Calculator, Info, AlertCircle } from 'lucide-react';
import { Insumo, CurrencyType } from '../types';

type UnitType = 'g' | 'ml' | 'un';

interface AddInsumoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: Omit<Insumo, 'id'>) => Promise<void>;
  currency: CurrencyType;
  activeTenantId: string;
}

const UNIT_LABELS: Record<UnitType, {
  packageSize: string;
  costPerUnit: string;
  stock: string;
  stockHelp: string;
  qtyPackages: string;
  placeholder: {
    packageSize: string;
    qtyPackages: string;
  };
}> = {
  g: {
    packageSize: 'Tamanho da Embalagem (g)',
    costPerUnit: 'Custo por grama',
    stock: 'Estoque Atual (g)',
    stockHelp: 'Total em gramas',
    qtyPackages: 'Qtd. Comprada (embalagens)',
    placeholder: {
      packageSize: 'Ex: 395 (lata)',
      qtyPackages: 'Ex: 2',
    },
  },
  ml: {
    packageSize: 'Tamanho da Embalagem (ml)',
    costPerUnit: 'Custo por ml',
    stock: 'Estoque Atual (ml)',
    stockHelp: 'Total em mililitros',
    qtyPackages: 'Qtd. Comprada (embalagens)',
    placeholder: {
      packageSize: 'Ex: 500 (garrafa)',
      qtyPackages: 'Ex: 3',
    },
  },
  un: {
    packageSize: 'Quantidade na Embalagem (un)',
    costPerUnit: 'Custo por unidade',
    stock: 'Estoque Atual (un)',
    stockHelp: 'Total em unidades',
    qtyPackages: 'Qtd. Comprada (embalagens)',
    placeholder: {
      packageSize: 'Ex: 12 (dúzia)',
      qtyPackages: 'Ex: 1',
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
  // Form state
  const [name, setName] = useState('');
  const [code] = useState(`INS-${Math.floor(100 + Math.random() * 900)}`);
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState<UnitType>('g');
  const [supplier, setSupplier] = useState('');
  const [minStock, setMinStock] = useState('');

  // Calculator state
  const [precoPago, setPrecoPago] = useState('');
  const [tamanhoEmbalagem, setTamanhoEmbalagem] = useState('');
  const [quantidadeEmbalagens, setQuantidadeEmbalagens] = useState('1');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get labels based on selected unit
  const labels = UNIT_LABELS[unit];

  // Derived calculations in real-time
  const precoNum = parseFloat(precoPago) || 0;
  const tamanhoNum = parseFloat(tamanhoEmbalagem) || 0;
  const qtdEmbNum = parseFloat(quantidadeEmbalagens) || 1;

  // Cost per 1g / 1ml / 1un
  const custoUnitarioBase = tamanhoNum > 0 ? precoNum / tamanhoNum : 0;

  // Total stock to add (e.g., 2 packages of 395g = 790g)
  const estoqueTotalCalculado = tamanhoNum * qtdEmbNum;

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toFixed(4)}`;
    if (currency === 'EUR') return `€${val.toFixed(4)}`;
    return `$${val.toFixed(4)}`;
  };

  const updateUnit = (newUnit: UnitType) => {
    setUnit(newUnit);
    setTamanhoEmbalagem('');
    setPrecoPago('');
    setQuantidadeEmbalagens('1');
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!precoPago || precoNum <= 0) {
      newErrors.precoPago = 'Informe o preço pago';
    }

    if (!tamanhoEmbalagem || tamanhoNum <= 0) {
      newErrors.tamanhoEmbalagem = 'Informe o tamanho da embalagem';
    }

    if (!quantidadeEmbalagens || qtdEmbNum <= 0) {
      newErrors.quantidadeEmbalagens = 'Quantidade inválida';
    }

    if (estoqueTotalCalculado <= 0) {
      newErrors.estoque = 'Estoque deve ser maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const minQty = parseFloat(minStock) || Math.floor(estoqueTotalCalculado * 0.2);

      const newInsumo: Omit<Insumo, 'id'> = {
        tenantId: activeTenantId,
        code,
        name: name.trim(),
        category: category || 'Geral',
        unit,
        currentStock: estoqueTotalCalculado, // Total: tamanho × quantidade
        minStock: minQty,
        unitCost: custoUnitarioBase, // Custo por 1g/1ml/1un
        supplier: supplier || 'Não informado',
        lastUpdated: new Date().toISOString().split('T')[0],
      };

      await onAdd(newInsumo);
      onClose();
      
      // Reset form
      setName('');
      setCategory('');
      setUnit('g');
      setSupplier('');
      setMinStock('');
      setPrecoPago('');
      setTamanhoEmbalagem('');
      setQuantidadeEmbalagens('1');
      setErrors({});
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
              <p className="text-[10px] text-zinc-500">Adicione produto ao estoque</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Name */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
              Nome do Insumo *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
              placeholder="Ex: Farinha de Trigo"
              className={`w-full bg-[#1A1A1E] border rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors ${
                errors.name ? 'border-red-500' : 'border-zinc-800'
              }`}
            />
            {errors.name && (
              <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.name}
              </p>
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
                  type="button"
                  onClick={() => updateUnit(u.value)}
                  className={`py-3 rounded-xl border text-center transition-all ${
                    unit === u.value
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

          {/* Calculator Section */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-amber-500" />
              <span className="text-[11px] font-bold text-amber-400">Calculadora de Custo</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Preço Pago */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 mb-1 block">
                  Preço Pago (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoPago}
                  onChange={(e) => {
                    setPrecoPago(e.target.value);
                    if (errors.precoPago) setErrors(prev => ({ ...prev, precoPago: '' }));
                  }}
                  placeholder="5.99"
                  className={`w-full bg-[#0B0B0C] border rounded-xl p-3 text-sm text-emerald-400 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors ${
                    errors.precoPago ? 'border-red-500' : 'border-zinc-800'
                  }`}
                />
                {errors.precoPago && (
                  <p className="text-[9px] text-red-400 mt-1">{errors.precoPago}</p>
                )}
              </div>
              
              {/* Tamanho da Embalagem */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 mb-1 block">
                  Tamanho da Emb. ({unit}) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={tamanhoEmbalagem}
                  onChange={(e) => {
                    setTamanhoEmbalagem(e.target.value);
                    if (errors.tamanhoEmbalagem) setErrors(prev => ({ ...prev, tamanhoEmbalagem: '' }));
                  }}
                  placeholder={labels.placeholder.packageSize}
                  className={`w-full bg-[#0B0B0C] border rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors ${
                    errors.tamanhoEmbalagem ? 'border-red-500' : 'border-zinc-800'
                  }`}
                />
                {errors.tamanhoEmbalagem && (
                  <p className="text-[9px] text-red-400 mt-1">{errors.tamanhoEmbalagem}</p>
                )}
              </div>
            </div>

            {/* Quantidade de Embalagens */}
            <div className="mb-3">
              <label className="text-[10px] font-bold text-zinc-400 mb-1 block">
                {labels.qtyPackages} *
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={quantidadeEmbalagens}
                onChange={(e) => {
                  setQuantidadeEmbalagens(e.target.value);
                  if (errors.quantidadeEmbalagens) setErrors(prev => ({ ...prev, quantidadeEmbalagens: '' }));
                }}
                placeholder={labels.placeholder.qtyPackages}
                className={`w-full bg-[#0B0B0C] border rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors ${
                  errors.quantidadeEmbalagens ? 'border-red-500' : 'border-zinc-800'
                }`}
              />
              {errors.quantidadeEmbalagens && (
                <p className="text-[9px] text-red-400 mt-1">{errors.quantidadeEmbalagens}</p>
              )}
            </div>

            {/* Results */}
            {custoUnitarioBase > 0 && estoqueTotalCalculado > 0 && (
              <div className="space-y-2 pt-3 border-t border-amber-500/20">
                {/* Custo por unidade */}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400">
                    Custo por {unit === 'g' ? 'grama' : unit === 'ml' ? 'ml' : 'unidade'}:
                  </span>
                  <span className="text-sm font-black text-amber-400 font-mono">
                    {formatCurrency(custoUnitarioBase)}
                  </span>
                </div>
                
                {/* Estoque total */}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400">
                    Estoque resultante:
                  </span>
                  <span className="text-sm font-bold text-white font-mono">
                    {estoqueTotalCalculado} {unit}
                    {unit === 'g' && estoqueTotalCalculado >= 1000 && (
                      <span className="text-zinc-500 text-[10px] ml-1">
                        ({(estoqueTotalCalculado / 1000).toFixed(2)} kg)
                      </span>
                    )}
                    {unit === 'ml' && estoqueTotalCalculado >= 1000 && (
                      <span className="text-zinc-500 text-[10px] ml-1">
                        ({(estoqueTotalCalculado / 1000).toFixed(2)} L)
                      </span>
                    )}
                  </span>
                </div>

                {/* Custo total */}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400">
                    Custo total investido:
                  </span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {formatCurrency(precoNum)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Stock Minimum */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
              {labels.stock} (Mínimo)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder={`Mín: ${Math.floor(estoqueTotalCalculado * 0.2)}`}
              className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <p className="text-[9px] text-zinc-500 mt-1">
              Padrão: 20% do estoque ({Math.floor(estoqueTotalCalculado * 0.2)} {unit})
            </p>
          </div>

          {/* Category & Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-400 mb-1.5 block">
                Categoria
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
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
                <span className="text-blue-400 font-bold">Como funciona:</span><br />
                • <strong>Preço Pago:</strong> Valor total da embalagem<br />
                • <strong>Tamanho:</strong> Quantidade dentro da embalagem<br />
                • <strong>Qtd:</strong> Quantas embalagens comprou<br />
                • <strong>Estoque:</strong> Tamanho × Quantidade = Total
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 bg-[#0B0B0C]">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!name || !precoPago || !tamanhoEmbalagem || isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? 'Adicionando...' : 'Adicionar Insumo ao Sistema'}
          </button>
        </div>
      </div>
    </div>
  );
};
