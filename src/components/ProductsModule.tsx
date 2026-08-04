import React, { useState } from 'react';
import { Package, Plus, Search, Trash2, Edit2, X, Save } from 'lucide-react';
import { Product, CurrencyType } from '../types';
import { productsService } from '../lib/database';

interface ProductsModuleProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  currency: CurrencyType;
  activeTenantId: string;
  onRefresh: () => Promise<void>;
}

export const ProductsModule: React.FC<ProductsModuleProps> = ({ products, setProducts, currency, activeTenantId, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [itemsSold, setItemsSold] = useState<number>(0);

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

  const resetForm = () => {
    setName('');
    setCategory('');
    setSku('');
    setStockQuantity(0);
    setNewPrice(0);
    setItemsSold(0);
    setEditingProduct(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category);
    setSku(p.sku);
    setStockQuantity(p.stockQuantity);
    setNewPrice(p.newPrice);
    setItemsSold(p.itemsSold);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !category) return;

    const saleDiscountPercent = editingProduct?.saleDiscountPercent || 0;
    const oldPrice = editingProduct?.oldPrice || newPrice;

    if (editingProduct) {
      const updates: Partial<Product> = {
        name,
        category,
        sku,
        stockQuantity,
        newPrice,
        itemsSold,
      };
      try {
        await productsService.update(editingProduct.id, updates);
        await onRefresh();
      } catch (err) {
        console.error('Error updating product:', err);
        setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...updates } : p));
      }
    } else {
      const newProduct: Product = {
        id: `p-${Date.now()}`,
        tenantId: activeTenantId,
        name,
        category,
        sku: sku || `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
        stockQuantity,
        oldPrice: newPrice * 1.2,
        saleDiscountPercent: 10,
        newPrice,
        itemsSold,
        status: stockQuantity > 0 ? 'In Stock' : 'Out of Stock',
      };
      try {
        await productsService.create(newProduct);
        await onRefresh();
      } catch (err) {
        console.error('Error creating product:', err);
        setProducts([newProduct, ...products]);
      }
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await productsService.delete(id);
        await onRefresh();
      } catch (err) {
        console.error('Error deleting product:', err);
        setProducts(products.filter(p => p.id !== id));
      }
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/50">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Catálogo de Produtos Finais
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {products.length} itens
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Produtos finais cadastrados manualmente ou gerados automaticamente a partir de Fichas Técnicas.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
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
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {p.category}
                </span>
                <button
                  onClick={() => openEditModal(p)}
                  className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1 rounded-lg bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
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
                <div className={`font-extrabold ${p.stockQuantity < 10 ? 'text-amber-400' : 'text-white'}`}>{p.stockQuantity} un</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500">Preço de Venda</div>
                <div className="font-black text-amber-400 text-sm">{formatCurrency(p.newPrice)}</div>
              </div>
            </div>

            {p.fichaTecnicaId && (
              <div className="text-[10px] text-zinc-500 flex items-center gap-1 font-medium pt-1">
                Vinculado à Ficha Técnica
              </div>
            )}
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="col-span-full p-12 rounded-2xl bg-[#121214] border border-zinc-800/80 text-center text-zinc-500 text-xs">
            Nenhum produto encontrado. Cadastre um novo produto ou gere a partir de uma Ficha Técnica.
          </div>
        )}
      </div>

      {/* MODAL: Criar/Editar Produto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#121214] border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-zinc-400 font-bold mb-1">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Croissant Artesanal"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Categoria</label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Padaria"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Auto-gerado se vazio"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Estoque (un)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Preço de Venda</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Itens Vendidos</label>
                  <input
                    type="number"
                    min="0"
                    value={itemsSold}
                    onChange={(e) => setItemsSold(Number(e.target.value))}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold hover:from-amber-600 hover:to-orange-600 shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
