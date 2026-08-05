import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

function getClients() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error('Supabase server credentials are missing.');
  return {
    auth: createClient(url, anonKey, { auth: { persistSession: false } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false } }),
  };
}

export function adminRoutes(): Router {
  const router = Router();

  router.post('/stores', async (req: Request, res: Response) => {
    const { name, ownerName, email, password, cnpjStore, plan, status, accessDaysRemaining, expirationDate, maxMonthlyScans, scansUsedThisMonth } = req.body || {};
    if (!name || !ownerName || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Informe loja, dono, email e uma senha de pelo menos 6 caracteres.' });
    }

    let admin: ReturnType<typeof getClients>['admin'];
    try {
      const clients = getClients();
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Sessão ausente.' });
      const { data: authData, error: authError } = await clients.auth.auth.getUser(token);
      if (authError || !authData.user) return res.status(401).json({ error: 'Sessão inválida.' });
      admin = clients.admin;
      const { data: profile } = await admin.from('users').select('role').eq('id', authData.user.id).single();
      if (profile?.role !== 'super_admin') return res.status(403).json({ error: 'Apenas o superadmin pode criar lojas.' });

      const tenantPayload = {
        name, owner_name: ownerName, email, cnpj_store: cnpjStore || null, plan: plan || 'Pro',
        status: status || 'Ativo', access_days_remaining: Number(accessDaysRemaining) || 30,
        expiration_date: expirationDate || null, max_monthly_scans: Number(maxMonthlyScans) || 30,
        scans_used_this_month: Number(scansUsedThisMonth) || 0,
      };
      const { data: tenant, error: tenantError } = await admin.from('tenants').insert(tenantPayload).select().single();
      if (tenantError || !tenant) return res.status(400).json({ error: tenantError?.message || 'Erro ao criar loja.' });

      const { data: newAuth, error: createAuthError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name: ownerName, role: 'store_owner', tenant_id: tenant.id },
      });
      if (createAuthError || !newAuth.user) {
        await admin.from('tenants').delete().eq('id', tenant.id);
        return res.status(400).json({ error: createAuthError?.message || 'Erro ao criar login do dono.' });
      }

      const { error: profileError } = await admin.from('users').upsert({
        id: newAuth.user.id, name: ownerName, email, role: 'store_owner', tenant_id: tenant.id,
      }, { onConflict: 'id' });
      if (profileError) {
        await admin.auth.admin.deleteUser(newAuth.user.id);
        await admin.from('tenants').delete().eq('id', tenant.id);
        return res.status(400).json({ error: profileError.message });
      }
      return res.status(201).json({ tenant });
    } catch (error: any) {
      console.error('admin store creation error:', error);
      return res.status(500).json({ error: error.message || 'Erro interno ao criar loja.' });
    }
  });

  return router;
}
