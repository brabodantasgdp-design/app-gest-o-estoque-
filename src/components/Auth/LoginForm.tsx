import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { User, Tenant } from '../../types';
import { authService } from '../../lib/database';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
  tenants: Tenant[];
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, tenants }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authService.login(email, password);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.message || 'Falha na autenticacao. Verifique suas credenciais.');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center p-4 selection:bg-amber-500 selection:text-black">
      <div className="w-full max-w-md bg-[#121214] border border-zinc-800/80 rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />

        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 font-black text-black text-sm tracking-widest shadow-lg shadow-orange-500/20 mb-2">
            EBD
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            <span>EBD</span>
            <span className="text-amber-400">ElBravoDantas</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Acesso seguro via <strong className="text-amber-400">Supabase Auth</strong> & PostgreSQL
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-zinc-300 block">E-mail Corporativo</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className="w-full bg-[#18181b] border border-zinc-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-zinc-300 block">Senha de Acesso</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#18181b] border border-zinc-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-xs tracking-wide shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Autenticando...</span>
            ) : (
              <>
                <span>Entrar na Plataforma</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-800/60 text-center">
          <p className="text-[11px] text-zinc-500">
            Isolamento de dados RLS ativo no Supabase PostgreSQL.
          </p>
        </div>

      </div>
    </div>
  );
};
