import { Router, Request, Response } from "express";

export function authRoutes(): Router {
  const router = Router();

  router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email, password,
        });

        if (authError || !authData.user) {
          return res.status(401).json({ success: false, message: 'Email ou senha incorretos.' });
        }
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*, tenants(name)')
          .eq('id', authData.user.id)
          .single();
        if (profileError || !userProfile) return res.status(403).json({ success: false, message: 'Usuário sem perfil de acesso.' });
        return res.json({
          success: true,
          user: {
            id: userProfile.id,
            name: userProfile.name,
            email: userProfile.email,
            role: userProfile.role,
            tenantId: userProfile.tenant_id,
            tenantName: userProfile.tenants?.name || '',
          },
          token: authData.session?.access_token,
        });
      }
    } catch (err) {
      console.error("Supabase authentication error:", err);
    }
    return res.status(503).json({ success: false, message: 'Supabase não está configurado.' });
  });

  return router;
}
