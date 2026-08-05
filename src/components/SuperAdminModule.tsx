import React, { useState } from 'react';
import {
  ShieldAlert,
  Users,
  Store,
  Calendar,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Search,
  ShieldCheck,
  UserCheck,
  Power,
  TrendingUp,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { Tenant, SubscriptionPlan, SubscriptionStatus, CurrencyType } from '../types';
import { tenantsService } from '../lib/database';

interface SuperAdminModuleProps {
  tenants: Tenant[];
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
  activeTenantId: string;
  onSelectTenantContext: (tenantId: string) => void;
  currency: CurrencyType;
}

export const SuperAdminModule: React.FC<SuperAdminModuleProps> = ({
  tenants,
  setTenants,
  activeTenantId,
  onSelectTenantContext,
  currency,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  // Form fields for create/edit
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [plan, setPlan] = useState<SubscriptionPlan>('Pro');
  const [status, setStatus] = useState<SubscriptionStatus>('Ativo');
  const [accessDays, setAccessDays] = useState<number>(30);

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStores = tenants.length;
  const activeStores = tenants.filter((t) => t.status === 'Ativo').length;
  const totalScansProcessed = tenants.reduce((acc, t) => acc + t.scansUsedThisMonth, 0);
  const estimatedMRR = tenants.reduce((acc, t) => {
    if (t.status !== 'Ativo') return acc;
    if (t.plan === 'Pro') return acc + 197;
    if (t.plan === 'Enterprise') return acc + 497;
    return acc;
  }, 0);

  const handleOpenCreateModal = () => {
    setEditingTenant(null);
    setStoreName('');
    setOwnerName('');
    setEmail('');
    setPassword('');
    setCnpj('');
    setPlan('Pro');
    setStatus('Ativo');
    setAccessDays(30);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: Tenant) => {
    setEditingTenant(t);
    setStoreName(t.name);
    setOwnerName(t.ownerName);
    setEmail(t.email);
    setPassword('');
    setCnpj(t.cnpjStore || '');
    setPlan(t.plan);
    setStatus(t.status);
    setAccessDays(t.accessDaysRemaining);
    setIsModalOpen(true);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !ownerName) {
      alert('Informe o nome da loja e do proprietário.');
      return;
    }

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + accessDays);
    const expStr = expDate.toISOString().split('T')[0];

    if (editingTenant) {
      try {
        const updated = await tenantsService.update(editingTenant.id, {
          name: storeName, ownerName, email, cnpjStore: cnpj, plan, status,
          accessDaysRemaining: accessDays, expirationDate: expStr,
        });
        setTenants(tenants.map((t) => t.id === editingTenant.id ? updated : t));
      } catch (err) {
        console.error('Error updating tenant:', err);
        alert('Erro ao salvar no banco de dados.');
      }
    } else {
      try {
         const newTenant = await tenantsService.createWithOwner({
           name: storeName, ownerName, email, password,
          cnpjStore: cnpj || '', plan, status,
          accessDaysRemaining: accessDays, expirationDate: expStr,
          maxMonthlyScans: plan === 'Enterprise' ? 1000 : plan === 'Pro' ? 300 : 30,
          scansUsedThisMonth: 0,
        });
        setTenants([newTenant, ...tenants]);
      } catch (err) {
        console.error('Error creating tenant:', err);
        alert('Erro ao salvar no banco de dados.');
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteTenant = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir o cliente "${name}" e todos os seus dados?`)) {
      try {
        await tenantsService.delete(id);
        setTenants(tenants.filter((t) => t.id !== id));
      } catch (err) {
        console.error('Error deleting tenant:', err);
        alert('Erro ao excluir no banco de dados.');
      }
    }
  };

  const handleQuickAddDays = async (id: string, daysToAdd: number) => {
    const tenant = tenants.find(t => t.id === id);
    if (!tenant) return;
    const newDays = tenant.accessDaysRemaining + daysToAdd;
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + newDays);
    try {
      await tenantsService.update(id, {
        accessDaysRemaining: newDays,
        expirationDate: expDate.toISOString().split('T')[0],
        status: 'Ativo',
      });
      setTenants(
        tenants.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              accessDaysRemaining: newDays,
              expirationDate: expDate.toISOString().split('T')[0],
              status: 'Ativo' as SubscriptionStatus,
            };
          }
          return t;
        })
      );
    } catch (err) {
      console.error('Error updating tenant days:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Super Admin Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#1A1208] via-[#121214] to-[#0D1512] border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Painel Super Admin SaaS
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-[10px]">
                Gestão Geral de Licenças
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Gerencie cadastros, planos de assinaturas, libere dias de acesso e controle o isolamento multi-tenant.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Novo Lojista
        </button>
      </div>

      {/* Global SaaS KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 font-medium">Lojas Cadastradas</div>
            <div className="text-2xl font-black text-white mt-1">{totalStores}</div>
            <div className="text-[10px] text-emerald-400 font-bold mt-1">{activeStores} ativas no momento</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-800 text-amber-500 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 font-medium">MRR Estimado (Mensal)</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{formatCurrency(estimatedMRR)}</div>
            <div className="text-[10px] text-zinc-500 mt-1">Planos Pro & Enterprise</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-800 text-amber-500 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 font-medium">Scans OCR IA no Mês</div>
            <div className="text-2xl font-black text-white mt-1">{totalScansProcessed}</div>
            <div className="text-[10px] text-amber-400 font-bold mt-1">Uso de API Gemini Ativo</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-800 text-amber-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#121214] border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 font-medium">Status de Isolamento</div>
            <div className="text-sm font-black text-emerald-400 mt-1">100% Multi-Tenant</div>
            <div className="text-[10px] text-zinc-500 mt-1">Dados de lojas 100% segregados</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-800 text-emerald-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tenants Management Table */}
      <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Lojistas & Assinantes
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Gerencie dias de teste, status do plano e altere o contexto para inspecionar.</p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar lojista ou e-mail..."
              className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-[#17171A] text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Estabelecimento / Dono</th>
                <th className="py-3 px-4">Plano</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Acesso Restante</th>
                <th className="py-3 px-4">Uso de OCR</th>
                <th className="py-3 px-4 text-center">Ações Rápidas</th>
                <th className="py-3 px-4 text-right">Acessar Loja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filteredTenants.map((t) => {
                const isSelected = activeTenantId === t.id;

                let statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                if (t.status === 'Trial') statusBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                if (t.status === 'Suspenso') statusBadge = 'bg-red-500/10 text-red-400 border-red-500/20';

                return (
                  <tr key={t.id} className={`hover:bg-zinc-800/40 transition-colors ${isSelected ? 'bg-amber-500/5' : ''}`}>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-white flex items-center gap-2">
                        {t.name}
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-black">
                            Ativo no Painel
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{t.ownerName} ({t.email}){t.cnpjStore ? ` | CNPJ/CPF: ${t.cnpjStore}` : ''}</span>
                         <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[9px] border border-zinc-700">
                           Login do proprietário
                         </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-amber-400">
                      <span className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700">
                        {t.plan}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-md border text-[10px] font-bold ${statusBadge}`}>
                        ● {t.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t.accessDaysRemaining} dias</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-sans">Expira em: {t.expirationDate}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono text-zinc-200 font-bold">
                        {t.scansUsedThisMonth} / {t.maxMonthlyScans}
                      </div>
                      <div className="w-24 bg-zinc-800 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, (t.scansUsedThisMonth / t.maxMonthlyScans) * 100)}%` }}
                        ></div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          title="+30 Dias de Acesso"
                          onClick={() => handleQuickAddDays(t.id, 30)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-amber-500/20 text-amber-400 border border-zinc-700 text-[10px] font-bold"
                        >
                          +30d
                        </button>
                        <button
                          title="+365 Dias de Acesso"
                          onClick={() => handleQuickAddDays(t.id, 365)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-emerald-500/20 text-emerald-400 border border-zinc-700 text-[10px] font-bold"
                        >
                          +1 ano
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(t.id, t.name)}
                          className="p-1.5 rounded bg-zinc-800 hover:bg-red-500/20 text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onSelectTenantContext(t.id)}
                        className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-all flex items-center gap-1 ml-auto ${
                          isSelected
                            ? 'bg-amber-500 text-black shadow-md'
                            : 'bg-zinc-800 hover:bg-amber-500/20 hover:text-amber-400 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {isSelected ? 'Loja Selecionada' : 'Acessar Loja'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

       {/* CREATE / EDIT TENANT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTenant}
            className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 w-full max-w-lg space-y-4 text-xs shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-500" />
                {editingTenant ? 'Editar Licença do Lojista' : 'Cadastrar Novo Lojista'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Nome do Estabelecimento / Loja</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex: Padaria & Confeitaria Bela Vista"
                  className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

               <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Nome do Proprietário</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Ex: Carlos Andrade"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">CNPJ / CPF do Estabelecimento <span className="text-zinc-500 font-normal">(Opcional)</span></label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00 ou CPF (Opcional)"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">E-mail de login do proprietário</label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingTenant)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dono@loja.com.br"
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </div>

                {!editingTenant && (
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Senha inicial do proprietário</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                      className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Plano SaaS</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Gratuito">Gratuito</option>
                    <option value="Pro">Pro (300 scans)</option>
                    <option value="Enterprise">Enterprise (1000 scans)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Trial">Trial / Teste</option>
                    <option value="Suspenso">Suspenso</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Dias de Acesso</label>
                  <input
                    type="number"
                    min="1"
                    value={accessDays}
                    onChange={(e) => setAccessDays(Number(e.target.value))}
                    className="w-full bg-[#1A1A1E] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
               </div>
             </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20"
              >
                Salvar Licença
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
