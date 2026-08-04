import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Tag,
  CheckCircle2,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw
} from 'lucide-react';
import { InvoiceScan, InvoiceCategoryEnum, CurrencyType, Tenant } from '../../types';
import { InvoiceDetailModal } from './InvoiceDetailModal';

interface InvoicesListViewProps {
  invoices: InvoiceScan[];
  setInvoices: React.Dispatch<React.SetStateAction<InvoiceScan[]>>;
  currency: CurrencyType;
  currentTenant?: Tenant;
  onOpenOCRScan: () => void;
}

export const InvoicesListView: React.FC<InvoicesListViewProps> = ({
  invoices,
  setInvoices,
  currency,
  currentTenant,
  onOpenOCRScan,
}) => {
  // Filters State
  const [supplierSearch, setSupplierSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Selected Invoice for Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceScan | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    const symbol = currency === 'BRL' ? 'R$' : currency === 'USD' ? '$' : '€';
    return `${symbol} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered dataset
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Supplier search
      if (
        supplierSearch &&
        !inv.supplierName.toLowerCase().includes(supplierSearch.toLowerCase()) &&
        !inv.cnpj.includes(supplierSearch) &&
        !inv.invoiceNumber.toLowerCase().includes(supplierSearch.toLowerCase())
      ) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'todas' && inv.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'todos') {
        const isProc = statusFilter === 'processed';
        if (inv.processed !== isProc) return false;
      }

      // Date filter
      if (dateFilter && !inv.invoiceDate.includes(dateFilter)) {
        return false;
      }

      // Value Min / Max
      if (minValue && inv.totalAmount < Number(minValue)) return false;
      if (maxValue && inv.totalAmount > Number(maxValue)) return false;

      return true;
    });
  }, [invoices, supplierSearch, categoryFilter, statusFilter, dateFilter, minValue, maxValue]);

  // Pagination logic
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  const handleUpdateInvoice = (updated: InvoiceScan) => {
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedInvoice(updated);
  };

  const handleExportCSV = () => {
    const tenantId = currentTenant?.id || '';
    window.open(`/api/invoices/export?tenantId=${tenantId}`, '_blank');
  };

  const categoryBadgeStyles: Record<string, { label: string; style: string }> = {
    alimentacao: { label: 'Alimentação', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    transporte: { label: 'Transporte', style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    servicos: { label: 'Serviços', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    insumos: { label: 'Insumos', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    impostos: { label: 'Impostos', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    outros: { label: 'Outros', style: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Listagem de Notas Fiscais (NF-e / NFC-e)</span>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              {filteredInvoices.length} Lançamentos
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Filtros por data, fornecedor, faixa de preço, categoria e status com exportação CSV.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700/80 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={onOpenOCRScan}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Escanear Nota IA</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-3">
        <div className="text-xs font-extrabold text-zinc-300 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-amber-500" />
          <span>Filtros Avançados de Busca</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          
          {/* Supplier / CNPJ Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              placeholder="Buscar fornecedor, CNPJ ou N.º da nota..."
              className="w-full bg-[#18181b] border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#18181b] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="todas">Todas Categorias</option>
            <option value="alimentacao">Alimentação</option>
            <option value="transporte">Transporte</option>
            <option value="servicos">Serviços</option>
            <option value="insumos">Insumos</option>
            <option value="impostos">Impostos (DAS)</option>
            <option value="outros">Outros</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#18181b] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="todos">Todos Status</option>
            <option value="processed">Processadas</option>
            <option value="pending">Pendentes</option>
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-[#18181b] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          />

          {/* Min Value */}
          <input
            type="number"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
            placeholder="Mín R$"
            className="bg-[#18181b] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />

        </div>
      </div>

      {/* Main Table */}
      <div className="border border-zinc-800/80 rounded-2xl overflow-hidden bg-[#121214] shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#18181b] text-zinc-400 font-extrabold uppercase tracking-wider border-b border-zinc-800">
              <tr>
                <th className="p-4">N.º Nota / ID</th>
                <th className="p-4">Fornecedor / CNPJ</th>
                <th className="p-4">Data Emissão</th>
                <th className="p-4">Categoria</th>
                <th className="p-4 text-right">Valor Total</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-zinc-500">
                    Nenhuma nota fiscal encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const catMeta = categoryBadgeStyles[inv.category] || categoryBadgeStyles.outros;

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setIsDetailOpen(true);
                      }}
                      className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-mono font-bold text-amber-400">
                        {inv.invoiceNumber}
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-white group-hover:text-amber-300 transition-colors">
                          {inv.supplierName}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">CNPJ: {inv.cnpj}</div>
                      </td>

                      <td className="p-4 text-zinc-300 font-medium">
                        {inv.invoiceDate}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${catMeta.style}`}>
                          {catMeta.label}
                        </span>
                      </td>

                      <td className="p-4 text-right font-black text-white text-sm">
                        {formatCurrency(inv.totalAmount)}
                      </td>

                      <td className="p-4 text-center">
                        {inv.processed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Processada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-extrabold border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            <span>Pendente</span>
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                            setIsDetailOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Nota</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 bg-[#18181b] border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div>
            Exibindo página <strong className="text-white">{currentPage}</strong> de <strong className="text-white">{totalPages}</strong> ({filteredInvoices.length} notas no total)
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg font-extrabold text-white">
              {currentPage}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Invoice Detail View Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdateInvoice={handleUpdateInvoice}
        currency={currency}
      />

    </div>
  );
};
