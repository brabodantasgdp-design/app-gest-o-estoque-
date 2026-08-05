/**
 * Vercel Serverless API — mínimo essencial.
 * Rotas que funcionam via fetch direto do cliente.
 */
import express from "express";

const app = express();
app.use(express.json({ limit: "25mb" }));

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

function supabaseClients() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase server credentials are missing.");
  return import("@supabase/supabase-js").then(({ createClient }) => ({
    auth: createClient(url, anonKey, { auth: { persistSession: false } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false } }),
  }));
}

app.post("/api/admin/stores", async (req, res) => {
  const { name, ownerName, email, password, cnpjStore, plan, status, accessDaysRemaining, expirationDate, maxMonthlyScans, scansUsedThisMonth } = req.body || {};
  if (!name || !ownerName || !email || !password || password.length < 6) {
    return res.status(400).json({ error: "Informe loja, dono, email e uma senha de pelo menos 6 caracteres." });
  }

  try {
    const { auth, admin } = await supabaseClients();
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Sessão ausente." });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return res.status(401).json({ error: "Sessão inválida." });
    const { data: profile } = await admin.from("users").select("role").eq("id", authData.user.id).single();
    if (profile?.role !== "super_admin") return res.status(403).json({ error: "Apenas o superadmin pode criar lojas." });

    const { data: tenant, error: tenantError } = await admin.from("tenants").insert({
      name, owner_name: ownerName, email, cnpj_store: cnpjStore || null, plan: plan || "Pro",
      status: status || "Ativo", access_days_remaining: Number(accessDaysRemaining) || 30,
      expiration_date: expirationDate || null, max_monthly_scans: Number(maxMonthlyScans) || 30,
      scans_used_this_month: Number(scansUsedThisMonth) || 0,
    }).select().single();
    if (tenantError || !tenant) return res.status(400).json({ error: tenantError?.message || "Erro ao criar loja." });

    const { data: newAuth, error: createAuthError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name: ownerName, role: "store_owner", tenant_id: tenant.id },
    });
    if (createAuthError || !newAuth.user) {
      await admin.from("tenants").delete().eq("id", tenant.id);
      return res.status(400).json({ error: createAuthError?.message || "Erro ao criar login do dono." });
    }

    const { error: profileError } = await admin.from("users").upsert({
      id: newAuth.user.id, name: ownerName, email, role: "store_owner", tenant_id: tenant.id,
    }, { onConflict: "id" });
    if (profileError) {
      await admin.auth.admin.deleteUser(newAuth.user.id);
      await admin.from("tenants").delete().eq("id", tenant.id);
      return res.status(400).json({ error: profileError.message });
    }
    return res.status(201).json({ tenant });
  } catch (error) {
    console.error("admin store creation error:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao criar loja." });
  }
});

// Gemini agent proxy (unica rota que precisa de servidor)
app.post("/api/ebdAi/agent", async (req, res) => {
  try {
    const { contents, systemInstruction, tools } = req.body;
    if (!contents) return res.status(400).json({ error: "contents required" });
    if (!GEMINI_KEY) return res.json({ text: "", functionCalls: [] });
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const response = await ai.models.generateContent({ model: "gemini-2.0-flash", contents, config: { systemInstruction, tools, temperature: 0.7, maxOutputTokens: 512 } });
    const parts = response.candidates?.[0]?.content?.parts || [];
    return res.json({ success: true, text: parts.filter(p => p.text).map(p => p.text).join(""), functionCalls: parts.filter(p => p.functionCall).map(p => p.functionCall) });
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

export default app;
