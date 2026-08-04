import React, { useState } from 'react';
import { ShoppingCart, Plus, Search, Trash2, Edit2, X, Save, Package } from 'lucide-react';
import { Order, CurrencyType, OrderItem } from '../types';
import { ordersService } from '../lib/database';

interface OrdersModuleProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currency: CurrencyType;
  activeTenantId: string;
  onRefresh: () => Promise<void>;
}

export const OrdersModule: React.FC<OrdersModuleProps> = ({ orders, setOrders, currency, activeTenantId, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemPrice, setItemPrice] = useState<number>(0);
  const [status, setStatus] = useState<Order['status']>('Processing');

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setCustomerName('');
    setCustomerEmail('');
    setOrderItems([]);
    setItemName('');
    setItemQty(1);
    setItemPrice(0);
    setStatus('Processing');
    setEditingOrder(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (o: Order) => {
    setEditingOrder(o);
    setCustomerName(o.customerName);
    setCustomerEmail(o.customerEmail);
    setOrderItems(o.items);
    setStatus(o.status);
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    if (!itemName || itemPrice <= 0) return;
    setOrderItems([...orderItems, { productName: itemName, quantity: itemQty, unitPrice: itemPrice }]);
    setItemName('');
    setItemQty(1);
    setItemPrice(0);
  };

  const handleRemoveItem = (idx: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  const totalAmount = orderItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || orderItems.length === 0) {
      alert('Informe o nome do cliente e adicione pelo menos 1 item ao pedido.');
      return;
    }

    if (editingOrder) {
      try {
        await ordersService.updateStatus(editingOrder.id, status);
        await onRefresh();
      } catch (err) {
        console.error('Error updating order:', err);
        setOrders(orders.map(o => o.id === editingOrder.id ? { ...o, status, items: orderItems, customerName, customerEmail, totalAmount } : o));
      }
    } else {
      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        tenantId: activeTenantId,
        orderNumber: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName,
        customerEmail,
        items: orderItems,
        totalAmount,
        status: 'Processing',
        date: new Date().toISOString().split('T')[0],
        timeAgo: 'Agora',
      };
      try {
        await ordersService.create(newOrder);
        await onRefresh();
      } catch (err) {
        console.error('Error creating order:', err);
        setOrders([newOrder, ...orders]);
      }
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este pedido?')) {
      try {
        await ordersService.delete(id);
        await onRefresh();
      } catch (err) {
        console.error('Error deleting order:', err);
        setOrders(orders.filter(o => o.id !== id));
      }
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      await ordersService.updateStatus(orderId, newStatus);
      await onRefresh();
    } catch (err) {
      console.error('Error updating status:', err);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/50">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Rastreamento de Pedidos & Vendas
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {orders.length} pedidos
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Acompanhe a entrada de novos pedidos, atualizações de entrega e faturamento.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Novo Pedido
        </button>
      </div>

      {/* Filter */}
      <div className="p-4 rounded-2xl bg-[#121214] border border-zinc-800/80">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por #pedido, cliente ou status..."
            className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-[#17171A] text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Pedido</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Itens</th>
                <th className="py-3.5 px-4">Valor Total</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Data</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filteredOrders.map((ord) => {
                let statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                if (ord.status === 'Processing') statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                if (ord.status === 'Shipped') statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                if (ord.status === 'Cancelled') statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';

                return (
                  <tr key={ord.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-amber-500 font-mono">{ord.orderNumber}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-white">{ord.customerName}</div>
                      <div className="text-[10px] text-zinc-500">{ord.customerEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {ord.items.map((i, idx) => (
                        <div key={idx} className="text-[11px]">
                          {i.quantity}x {i.productName}
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-4 font-black text-white">{formatCurrency(ord.totalAmount)}</td>
                    <td className="py-3.5 px-4">
                      <select
                        value={ord.status}
                        onChange={(e) => handleStatusChange(ord.id, e.target.value as Order['status'])}
                        className={`px-2 py-1 rounded-md border text-[10px] font-bold bg-transparent ${statusColor} focus:outline-none cursor-pointer`}
                      >
                        <option value="Processing">Processing</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-medium">
                      <div>{ord.date}</div>
                      <div className="text-[10px] text-zinc-500">{ord.timeAgo}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(ord)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ord.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Criar/Editar Pedido */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#121214] border border-zinc-800 rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                {editingOrder ? 'Editar Pedido' : 'Novo Pedido'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Nome do Cliente</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">E-mail do Cliente</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {!editingOrder && (
                <div className="p-3 rounded-xl bg-[#1A1A1E] border border-zinc-800 space-y-2">
                  <div className="text-xs font-bold text-amber-400">Adicionar Itens ao Pedido</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="Produto"
                      className="flex-1 bg-[#121214] border border-zinc-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={(e) => setItemQty(Number(e.target.value))}
                      className="w-16 bg-[#121214] border border-zinc-800 rounded-xl p-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(Number(e.target.value))}
                      placeholder="Preço"
                      className="w-24 bg-[#121214] border border-zinc-800 rounded-xl p-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-2 rounded-xl bg-amber-500 text-black font-extrabold hover:bg-amber-600"
                    >
                      +
                    </button>
                  </div>
                  {orderItems.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {orderItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#121214] border border-zinc-800">
                          <span className="text-white font-bold">{item.quantity}x {item.productName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-mono">{formatCurrency(item.unitPrice * item.quantity)}</span>
                            <button type="button" onClick={() => handleRemoveItem(idx)} className="text-zinc-500 hover:text-red-400">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="text-right text-xs font-black text-amber-400 pt-1">
                        Total: {formatCurrency(totalAmount)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {editingOrder && (
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Status do Pedido</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Order['status'])}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              )}

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
                  {editingOrder ? 'Salvar Alterações' : 'Criar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
