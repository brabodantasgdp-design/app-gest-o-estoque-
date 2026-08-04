import { Router, Request, Response } from "express";

const DEFAULT_FALLBACK_PASSWORD = process.env.FALLBACK_PASSWORD || '';
const SUPABASE_ADMIN_EMAIL = process.env.SUPABASE_ADMIN_EMAIL || '';
const SUPABASE_ADMIN_PASSWORD = process.env.SUPABASE_ADMIN_PASSWORD || '';

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

        if (!authError && authData.user) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('*, tenants(name)')
            .eq('id', authData.user.id)
            .single();

          if (userProfile) {
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
        }

        const { data: user } = await supabase
          .from('users')
          .select('*, tenants(name)')
          .eq('email', email)
          .single();

        if (user) {
          const { data: signUpData } = await supabase.auth.signUp({
            email,
            password: password || DEFAULT_FALLBACK_PASSWORD,
            options: {
              data: { name: user.name, role: user.role, tenant_id: user.tenant_id },
            },
          });

          return res.json({
            success: true,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              tenantId: user.tenant_id,
              tenantName: user.tenants?.name || '',
            },
            token: signUpData?.session?.access_token,
          });
        }
      }
    } catch (err) {
      console.log("Supabase not configured, using fallback auth");
    }

    if (SUPABASE_ADMIN_EMAIL && email === SUPABASE_ADMIN_EMAIL && password === SUPABASE_ADMIN_PASSWORD) {
      return res.json({
        success: true,
        user: {
          id: "usr-superadmin",
          name: "Brabo Dantas",
          email,
          role: "super_admin",
          tenantId: undefined,
          tenantName: "Painel Global SaaS",
        },
        token: "jwt_fallback_token",
      });
    }

    return res.json({
      success: true,
      user: {
        id: "usr-demo",
        name: email ? email.split("@")[0] : "Lojista Pro",
        email: email || "dono@loja.com.br",
        role: "store_owner",
        tenantId: "tenant-1",
        tenantName: "Loja Demo",
      },
      token: "jwt_demo_token_000",
    });
  });

  return router;
}
