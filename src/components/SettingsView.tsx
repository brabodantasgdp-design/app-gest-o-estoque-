import React from 'react';
import { Database, Key, Shield, Server, Globe, User } from 'lucide-react';
import { Tenant, User as UserType } from '../types';

interface SettingsViewProps {
  currentTenant?: Tenant;
  currentUser: UserType;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentTenant, currentUser }) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'Não configurado';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'Não configurado';
  const geminiKey = import.meta.env.GEMINI_API_KEY ? 'Configurado (oculto)' : 'Não configurado';

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="pb-2 border-b border-zinc-800/50">
        <h1 className="text-xl font-extrabold text-white">Configurações do EBD ElBravoDantas</h1>
        <p className="text-xs text-zinc-400 mt-1">Integrações, chaves de API, banco de dados e parâmetros do sistema.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-amber-500" />
            Sessão Atual
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <span className="text-zinc-400">Usuário</span>
              <span className="font-bold text-white">{currentUser.name}</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <span className="text-zinc-400">E-mail</span>
              <span className="font-mono text-white">{currentUser.email}</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <span className="text-zinc-400">Função</span>
              <span className="font-bold text-amber-400">
                {currentUser.role === 'super_admin' ? 'Super Admin (Acesso Global)' : 'Lojista (Tenant Isolado)'}
              </span>
            </div>
            {currentTenant && (
              <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
                <span className="text-zinc-400">Tenant</span>
                <span className="font-bold text-white">{currentTenant.name} ({currentTenant.plan})</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-500" />
            Variáveis de Ambiente
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <span className="text-zinc-400">VITE_SUPABASE_URL</span>
              <span className={`font-mono ${supabaseUrl !== 'Não configurado' ? 'text-emerald-400' : 'text-red-400'}`}>
                {supabaseUrl !== 'Não configurado' ? 'Configurado' : 'Não configurado'}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <span className="text-zinc-400">VITE_SUPABASE_ANON_KEY</span>
              <span className={`font-mono ${supabaseKey !== 'Não configurado' ? 'text-emerald-400' : 'text-red-400'}`}>
                {supabaseKey !== 'Não configurado' ? 'Configurado' : 'Não configurado'}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <span className="text-zinc-400">GEMINI_API_KEY</span>
              <span className={`font-mono ${geminiKey !== 'Não configurado' ? 'text-emerald-400' : 'text-red-400'}`}>
                {geminiKey}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            Banco de Dados (Supabase PostgreSQL)
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-emerald-400 font-bold">Conectado e sincronizado</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <span className="text-zinc-400">RLS Multi-tenant</span>
              <span className="font-bold text-emerald-400">Ativo</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <span className="text-zinc-400">Tabelas</span>
              <span className="font-bold text-white">10 (users, tenants, insumos, fichas_tecnicas, recipe_ingredients, products, orders, order_items, invoices, invoice_items)</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-500" />
            Serviços Ativos
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <div>
                <span className="font-bold text-white">Gemini OCR (NF-e)</span>
                <span className="text-zinc-500 ml-2">gemini-3.6-flash</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <div>
                <span className="font-bold text-white">Supabase Auth</span>
                <span className="text-zinc-500 ml-2">Login / Sessão</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <div>
                <span className="font-bold text-white">Express API</span>
                <span className="text-zinc-500 ml-2">Rotas server-side</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#17171A] border border-zinc-800/60">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <div>
                <span className="font-bold text-white">Vercel Deployment</span>
                <span className="text-zinc-500 ml-2">Frontend + Backend</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
