import React, { useState } from 'react';
import { X, FileText, CheckCircle2, Image as ImageIcon, Calendar, Building2, Tag, Edit3, Save, Layers, RefreshCw } from 'lucide-react';
import { InvoiceScan, InvoiceCategoryEnum, CurrencyType } from '../../types';

interface InvoiceDetailModalProps {
  invoice: InvoiceScan | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateInvoice: (updated: InvoiceScan) => void;
  currency: CurrencyType;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onUpdateInvoice,
  currency,
}) => {
  const [category, setCategory] = useState<InvoiceCategoryEnum>(invoice?.category || 'insumos');
  const [notes, setNotes] = useState<string>(invoice?.notes || '');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen || !invoice) return null;

  const formatCurrency = (amount: number) => {
    const symbol = currency === 'BRL' ? 'R$' : currency === 'USD' ? '$' : '€';
    return `${symbol} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate total from items
  const itemsTotal = invoice.items?.reduce(
    (sum, item) => sum + (item.totalCost || 0), 
    0
  ) || 0;
  
  const hasDiscrepancy = itemsTotal > 0 && Math.abs(itemsTotal - invoice.totalAmount) > 0.01;

  const handleSave = () => {
    const updated: InvoiceScan = {
      ...invoice,
      category,
      notes,
    };
    onUpdateInvoice(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleRecalculateTotal = () => {
    if (invoice.items && invoice.items.length > 0) {
      const newTotal = invoice.items.reduce(
        (sum, item) => sum + (item.totalCost || 0), 
        0
      );
      const updated: InvoiceScan = {
        ...invoice,
        totalAmount: newTotal,
        category,
        notes,
      };
      onUpdateInvoice(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 selection:bg-amber-500 selection:text-black">
      <div className="w-full max-w-4xl bg-[#121214] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#18181b]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Detalhes da Nota Fiscal</span>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  {invoice.invoiceNumber}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Visualização do documento, dados extraídos por OCR e observações
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Grid Layout: Image Preview + Metadata Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Image / Document Scan Preview */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                <span>Imagem / Documento da Nota Fiscal</span>
              </label>

              <div className="relative aspect-[3/4] bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center p-2 group">
                {invoice.imageUrl ? (
                  <img
                    src={invoice.imageUrl}
                    alt="Documento Nota Fiscal"
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <FileText className="w-12 h-12 text-zinc-600 mx-auto" />
                    <p className="text-xs text-zinc-400 font-medium">
                      Nota enviada via texto / arquivo PDF integrado
                    </p>
                    <div className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 inline-block font-mono">
                      {invoice.supplierName} - {invoice.invoiceNumber}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Extracted Data Form */}
            <div className="space-y-4">
              
              <div className="p-4 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                  <span className="text-zinc-400 font-bold">Fornecedor</span>
                  <span className="font-extrabold text-white text-right">{invoice.supplierName}</span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                  <span className="text-zinc-400 font-bold">CNPJ do Emitente</span>
                  <span className="font-mono text-zinc-300">{invoice.cnpj}</span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                  <span className="text-zinc-400 font-bold">Data da Emissão</span>
                  <span className="font-semibold text-zinc-300">{invoice.invoiceDate}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-zinc-400 font-bold">Valor Total Bruto</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-amber-400">{formatCurrency(invoice.totalAmount)}</span>
                    {hasDiscrepancy && (
                      <div className="text-[10px] text-red-400 font-bold mt-0.5">
                        Itens somam {formatCurrency(itemsTotal)} (diferença: {formatCurrency(Math.abs(itemsTotal - invoice.totalAmount))})
                      </div>
                    )}
                    {!hasDiscrepancy && itemsTotal > 0 && (
                      <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                        ✓ Itens conferem
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Editable Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  <span>Categoria da Nota Fiscal</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as InvoiceCategoryEnum)}
                  className="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold cursor-pointer"
                >
                  <option value="alimentacao">Alimentação</option>
                  <option value="transporte">Transporte & Fretes</option>
                  <option value="servicos">Serviços & Manutenção</option>
                  <option value="insumos">Insumos & Matéria-Prima</option>
                  <option value="impostos">Impostos & Tributos (DAS)</option>
                  <option value="outros">Outros Gastos</option>
                </select>
              </div>

              {/* Free Text Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Observações Libres (Notes)</span>
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Escreva anotações sobre este lançamento fiscal..."
                  className="w-full bg-[#18181b] border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all resize-none"
                />
              </div>

              {hasDiscrepancy && invoice.items && invoice.items.length > 0 && (
                <button
                  type="button"
                  onClick={handleRecalculateTotal}
                  className="w-full py-2 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-emerald-500/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  Corrigir Total (usar soma dos itens: {formatCurrency(itemsTotal)})
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-black" />
                    <span>Salvo com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações da Nota</span>
                  </>
                )}
              </button>

            </div>

          </div>

          {/* Line Items Breakdown Table */}
          {invoice.items && invoice.items.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Itens / Insumos Extraídos via OCR ({invoice.items.length})</span>
              </h3>

              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#18181b]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 text-zinc-400 font-bold border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Item Impresso</th>
                      <th className="p-3">Insumo Mapeado</th>
                      <th className="p-3 text-center">Quantidade</th>
                      <th className="p-3 text-right">Custo Unit.</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/40">
                        <td className="p-3 font-medium text-white">{item.rawName}</td>
                        <td className="p-3 text-amber-400 font-semibold">{item.matchedInsumoName}</td>
                        <td className="p-3 text-center font-mono">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-3 text-right font-mono">{formatCurrency(item.unitCost)}</td>
                        <td className="p-3 text-right font-black text-white">{formatCurrency(item.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
