import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Calculator,
  Percent,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  PackageCheck
} from 'lucide-react';
import { FichaTecnica, Insumo, RecipeItem, CurrencyType, Product } from '../types';
import { fichasService, productsService } from '../lib/database';

interface FichaTecnicaModuleProps {
  fichas: FichaTecnica[];
  setFichas: React.Dispatch<React.SetStateAction<FichaTecnica[]>>;
  insumos: Insumo[];
  currency: CurrencyType;
  onSaveToProducts: (newProduct: Product) => Promise<void>;
  activeTenantId: string;
  onRefresh: () => Promise<void>;
}

export const FichaTecnicaModule: React.FC<FichaTecnicaModuleProps> = ({
  fichas,
  setFichas,
  insumos,
  currency,
  onSaveToProducts,
  activeTenantId,
  onRefresh,
}) => {
  const [selectedFicha, setSelectedFicha] = useState<FichaTecnica | null>(fichas[0] || null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New Ficha Form State
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Bebidas Quentes');
  const [yieldQuantity, setYieldQuantity] = useState<number>(1);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>(insumos[0]?.id || '');
  const [selectedQty, setSelectedQty] = useState<number>(100);

  // Financial Parameters State
  const [wasteMarginPercent, setWasteMarginPercent] = useState<number>(5);
  const [operationalOverheadPercent, setOperationalOverheadPercent] = useState<number>(15);
  const [taxPercent, setTaxPercent] = useState<number>(8);
  const [targetProfitMarginPercent, setTargetProfitMarginPercent] = useState<number>(60);
  const [manualPrice, setManualPrice] = useState<number | ''>('');

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Add item to active recipe builder
  const handleAddIngredient = () => {
    const foundInsumo = insumos.find((i) => i.id === selectedInsumoId);
    if (!foundInsumo) return;

    const calcCost = foundInsumo.unitCost * selectedQty;
    const newItem: RecipeItem = {
      insumoId: foundInsumo.id,
      insumoName: foundInsumo.name,
      quantity: selectedQty,
      unit: foundInsumo.unit,
      calculatedCost: calcCost,
    };

    setRecipeItems([...recipeItems, newItem]);
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  // Dynamic Calculations
  const rawInsumoCost = recipeItems.reduce((acc, item) => acc + item.calculatedCost, 0);
  const costWithWaste = rawInsumoCost * (1 + wasteMarginPercent / 100);
  const totalProductionCost = costWithWaste * (1 + (operationalOverheadPercent + taxPercent) / 100);
  const effectiveBatchCost = totalProductionCost / (yieldQuantity || 1);

  // Formula for suggested price with markup: Price = Cost / (1 - ProfitMargin%)
  const marginDecimal = Math.min(0.95, targetProfitMarginPercent / 100);
  const calculatedPrice = effectiveBatchCost / (1 - marginDecimal);
  const finalPrice = typeof manualPrice === 'number' && manualPrice > 0 ? manualPrice : calculatedPrice;
  const netProfitPerUnit = finalPrice - effectiveBatchCost;
  const profitMarginRate = finalPrice > 0 ? (netProfitPerUnit / finalPrice) * 100 : 0;

  const handleSaveFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || recipeItems.length === 0) {
      alert('Por favor informe o nome do produto e adicione pelo menos 1 insumo à ficha técnica.');
      return;
    }

    const newFicha: FichaTecnica = {
      id: `ft-${Date.now()}`,
      tenantId: activeTenantId,
      code: `FT-${Math.floor(200 + Math.random() * 800)}`,
      productName,
      category,
      yieldQuantity,
      ingredients: recipeItems,
      rawInsumoCost,
      wasteMarginPercent,
      operationalOverheadPercent,
      taxPercent,
      totalProductionCost: effectiveBatchCost,
      targetProfitMarginPercent,
      calculatedPrice,
      manualOverridePrice: typeof manualPrice === 'number' ? manualPrice : undefined,
      finalPrice,
      netProfitPerUnit,
      profitMarginRate,
    };

    try {
      await fichasService.create(newFicha, recipeItems);
      await onRefresh();
    } catch (err) {
      console.error('Error saving ficha:', err);
      setFichas([newFicha, ...fichas]);
    }

    setSelectedFicha(newFicha);
    setIsCreatingNew(false);
  };

  const handleDeleteFicha = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta ficha técnica?')) {
      try {
        await fichasService.delete(id);
        await onRefresh();
        if (selectedFicha?.id === id) setSelectedFicha(null);
      } catch (err) {
        console.error('Error deleting ficha:', err);
        setFichas(fichas.filter((f) => f.id !== id));
      }
    }
  };

  const handleExportProduct = async (ficha: FichaTecnica) => {
    const newProd: Product = {
      id: `p-${Date.now()}`,
      tenantId: ficha.tenantId || 'tenant-1',
      name: ficha.productName,
      category: ficha.category,
      sku: `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
      stockQuantity: 100,
      oldPrice: Number((ficha.finalPrice * 1.2).toFixed(2)),
      saleDiscountPercent: 10,
      newPrice: Number(ficha.finalPrice.toFixed(2)),
      itemsSold: 0,
      status: 'In Stock',
      fichaTecnicaId: ficha.id,
    };

    onSaveToProducts(newProd);
    alert(`Produto "${ficha.productName}" foi publicado com sucesso no catálogo de vendas!`);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/50">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Fichas Técnicas & Precificação Automática
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Engenharia de Custos
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Crie receitas parametrizadas, calcule custo exato por g/ml/un e simule a margem de lucro ideal.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreatingNew(true);
            setProductName('');
            setRecipeItems([]);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Ficha Técnica
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: List of Existing Fichas */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
            Fichas Técnicas Cadastradas ({fichas.length})
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {fichas.map((f) => {
              const isSelected = selectedFicha?.id === f.id && !isCreatingNew;
              return (
                <div
                  key={f.id}
                  onClick={() => {
                    setSelectedFicha(f);
                    setIsCreatingNew(false);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                      : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-amber-500">{f.code}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                        {f.category}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFicha(f.id);
                        }}
                        className="p-1 rounded-lg bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-extrabold text-white mb-2">{f.productName}</h3>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-800/60">
                    <div>
                      <div className="text-[10px] text-zinc-500">Custo de Produção</div>
                      <div className="font-mono font-bold text-zinc-200">{formatCurrency(f.totalProductionCost)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">Preço de Venda</div>
                      <div className="font-mono font-extrabold text-amber-400">{formatCurrency(f.finalPrice)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Builder / Detail View */}
        <div className="lg:col-span-2 space-y-6">
          
          {isCreatingNew ? (
            /* CREATION BUILDER FORM */
            <form onSubmit={handleSaveFicha} className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-500" />
                  Criar Nova Ficha Técnica
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Nome do Produto Final</label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Ex: Croissant Artesanal 150g"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Padaria / Bebidas"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Rendimento da Receita</label>
                  <input
                    type="number"
                    min="1"
                    value={yieldQuantity}
                    onChange={(e) => setYieldQuantity(Number(e.target.value))}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Add Insumos to Recipe */}
              <div className="space-y-3 p-4 rounded-xl bg-[#1A1A1E] border border-zinc-800/80">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Ingredientes & Insumos da Receita
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 text-xs">
                  <select
                    value={selectedInsumoId}
                    onChange={(e) => setSelectedInsumoId(e.target.value)}
                    className="flex-1 w-full bg-[#121214] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({formatCurrency(i.unitCost)}/{i.unit})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="number"
                      step="any"
                      value={selectedQty}
                      onChange={(e) => setSelectedQty(Number(e.target.value))}
                      placeholder="Qtd (g/ml/un)"
                      className="w-28 bg-[#121214] border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                    />

                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-600 transition-all whitespace-nowrap"
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>

                {/* Ingredients List */}
                <div className="space-y-2 mt-3">
                  {recipeItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#121214] border border-zinc-800 text-xs"
                    >
                      <span className="font-bold text-white">{item.insumoName}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-amber-400">{item.quantity} {item.unit}</span>
                        <span className="font-mono text-emerald-400 font-bold">{formatCurrency(item.calculatedCost)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {recipeItems.length === 0 && (
                    <div className="text-center py-4 text-zinc-500 text-xs italic">
                      Nenhum ingrediente adicionado à receita ainda.
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Simulator Sliders */}
              <div className="space-y-4 p-4 rounded-xl bg-[#1A1A1E] border border-zinc-800">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Parâmetros de Margem & Precificação Automática
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Margem de Perda (%)</label>
                    <input
                      type="number"
                      value={wasteMarginPercent}
                      onChange={(e) => setWasteMarginPercent(Number(e.target.value))}
                      className="w-full bg-[#121214] border border-zinc-800 rounded-xl p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Custos Fixos/Labor (%)</label>
                    <input
                      type="number"
                      value={operationalOverheadPercent}
                      onChange={(e) => setOperationalOverheadPercent(Number(e.target.value))}
                      className="w-full bg-[#121214] border border-zinc-800 rounded-xl p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Impostos (%)</label>
                    <input
                      type="number"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(Number(e.target.value))}
                      className="w-full bg-[#121214] border border-zinc-800 rounded-xl p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Margem de Lucro Desejada (%)</label>
                    <input
                      type="number"
                      value={targetProfitMarginPercent}
                      onChange={(e) => setTargetProfitMarginPercent(Number(e.target.value))}
                      className="w-full bg-[#121214] border border-zinc-800 rounded-xl p-2 text-amber-400 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Live Output Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800 text-center">
                  <div className="p-2.5 rounded-xl bg-[#121214]">
                    <div className="text-[10px] text-zinc-500">Custo de Insumos</div>
                    <div className="text-xs font-mono font-bold text-white">{formatCurrency(rawInsumoCost)}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#121214]">
                    <div className="text-[10px] text-zinc-500">Custo Total Un.</div>
                    <div className="text-xs font-mono font-bold text-amber-400">{formatCurrency(effectiveBatchCost)}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#121214]">
                    <div className="text-[10px] text-zinc-500">Preço Sugerido</div>
                    <div className="text-xs font-mono font-extrabold text-emerald-400">{formatCurrency(calculatedPrice)}</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#121214]">
                    <div className="text-[10px] text-zinc-500">Lucro Líquido / Un</div>
                    <div className="text-xs font-mono font-bold text-emerald-300">{formatCurrency(netProfitPerUnit)}</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-xs hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/20"
                >
                  Salvar Ficha Técnica
                </button>
              </div>
            </form>
          ) : selectedFicha ? (
            /* ACTIVE FICHA DETAILS VIEW */
            <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div>
                  <span className="text-xs font-mono font-bold text-amber-500">{selectedFicha.code}</span>
                  <h2 className="text-lg font-extrabold text-white">{selectedFicha.productName}</h2>
                </div>

                <button
                  onClick={() => handleExportProduct(selectedFicha)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-black font-extrabold text-xs shadow-md transition-all"
                >
                  <PackageCheck className="w-4 h-4" />
                  Publicar em Produtos Finais
                </button>
              </div>

              {/* Recipe Ingredients */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Composição da Ficha Técnica (Ingredientes)
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 font-semibold text-[10px]">
                        <th className="py-2">Insumo</th>
                        <th className="py-2">Quantidade</th>
                        <th className="py-2 text-right">Custo do Insumo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      {selectedFicha.ingredients.map((ing, i) => (
                        <tr key={i}>
                          <td className="py-2.5 font-bold text-white">{ing.insumoName}</td>
                          <td className="py-2.5 font-mono text-amber-400">{ing.quantity} {ing.unit}</td>
                          <td className="py-2.5 font-mono text-emerald-400 text-right font-bold">
                            {formatCurrency(ing.calculatedCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#17171A] border border-zinc-800/80">
                <div>
                  <span className="text-[10px] text-zinc-500 font-medium">Custo de Produção Base</span>
                  <div className="text-lg font-black text-white">{formatCurrency(selectedFicha.totalProductionCost)}</div>
                  <div className="text-[10px] text-zinc-500">Inclui perda ({selectedFicha.wasteMarginPercent}%) e overhead ({selectedFicha.operationalOverheadPercent}%)</div>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-medium">Preço de Venda Definido</span>
                  <div className="text-lg font-black text-amber-400">{formatCurrency(selectedFicha.finalPrice)}</div>
                  <div className="text-[10px] text-emerald-400 font-bold">Margem de Lucro: {selectedFicha.profitMarginRate.toFixed(1)}%</div>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-medium">Lucro Líquido por Unidade</span>
                  <div className="text-lg font-black text-emerald-400">{formatCurrency(selectedFicha.netProfitPerUnit)}</div>
                  <div className="text-[10px] text-zinc-500">Por item comercializado</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
              Selecione uma ficha técnica existente ou crie uma nova.
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
