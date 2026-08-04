const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(express.json({ limit: "25mb" }));

// Inline all routes to avoid TypeScript import issues on Vercel
const MOCK_INVOICES = [
  { id: "inv-101", tenantId: "tenant-1", supplierName: "Distribuidores & Atacadista do Sul Ltda", cnpj: "12.345.678/0001-90", invoiceNumber: "NF-84920", invoiceDate: "2026-08-03", totalAmount: 1450.80, category: "insumos", notes: "Reposição quinzenal de farinhas e grãos gourmet.", processed: true, processedAt: "14:20", items: [] },
  { id: "inv-102", tenantId: "tenant-1", supplierName: "Laticínios Vale Verde S.A.", cnpj: "98.765.432/0001-22", invoiceNumber: "NF-91024", invoiceDate: "2026-08-02", totalAmount: 890.50, category: "alimentacao", notes: "Compra de manteiga culinária.", processed: true, processedAt: "10:15", items: [] },
  { id: "inv-103", tenantId: "tenant-1", supplierName: "Express Logística & Transporte", cnpj: "45.889.112/0001-33", invoiceNumber: "NF-33219", invoiceDate: "2026-08-01", totalAmount: 320.00, category: "transporte", notes: "Frete de embalagens.", processed: true, processedAt: "16:45", items: [] },
  { id: "inv-104", tenantId: "tenant-1", supplierName: "TechAssist Manutenção", cnpj: "33.111.222/0001-88", invoiceNumber: "NF-77412", invoiceDate: "2026-07-28", totalAmount: 1250.00, category: "servicos", notes: "Manutenção preventiva.", processed: false, items: [] },
  { id: "inv-105", tenantId: "tenant-1", supplierName: "Receita Estadual", cnpj: "00.000.000/0001-00", invoiceNumber: "DAS-202607", invoiceDate: "2026-07-25", totalAmount: 2180.40, category: "impostos", notes: "Guia DAS mensal.", processed: true, processedAt: "09:00", items: [] },
  { id: "inv-201", tenantId: "tenant-2", supplierName: "Moka Barista Supplier", cnpj: "77.888.999/0001-44", invoiceNumber: "NF-11029", invoiceDate: "2026-08-03", totalAmount: 640.00, category: "insumos", notes: "Café especial.", processed: false, items: [] },
];

// Auth route
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.SUPABASE_ADMIN_EMAIL;
  const adminPassword = process.env.SUPABASE_ADMIN_PASSWORD;

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const { createClient } = require("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (!authError && authData.user) {
        const { data: userProfile } = await supabase.from("users").select("*, tenants(name)").eq("id", authData.user.id).single();
        if (userProfile) {
          return res.json({ success: true, user: { id: userProfile.id, name: userProfile.name, email: userProfile.email, role: userProfile.role, tenantId: userProfile.tenant_id, tenantName: userProfile.tenants?.name || "" }, token: authData.session?.access_token });
        }
      }
    }
  } catch (err) { console.log("Supabase not configured"); }

  if (adminEmail && email === adminEmail && password === adminPassword) {
    return res.json({ success: true, user: { id: "usr-superadmin", name: "Brabo Dantas", email, role: "super_admin", tenantName: "Painel Global SaaS" }, token: "jwt_fallback" });
  }

  return res.json({ success: true, user: { id: "usr-demo", name: email?.split("@")[0] || "Lojista", email: email || "dono@loja.com.br", role: "store_owner", tenantId: "tenant-1", tenantName: "Loja Demo" }, token: "jwt_demo" });
});

// Dashboard
app.get("/api/dashboard", (req, res) => {
  const { tenantId = "tenant-1" } = req.query;
  let items = MOCK_INVOICES;
  if (tenantId && tenantId !== "all") items = items.filter((i) => i.tenantId === tenantId);

  const totalNotasMes = items.length;
  const totalGastoMes = items.reduce((acc, i) => acc + i.totalAmount, 0);

  const supplierMap = {};
  items.forEach((inv) => {
    if (!supplierMap[inv.supplierName]) supplierMap[inv.supplierName] = { count: 0, total: 0 };
    supplierMap[inv.supplierName].count += 1;
    supplierMap[inv.supplierName].total += inv.totalAmount;
  });

  const topFornecedores = Object.entries(supplierMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total).slice(0, 5);

  const categoryMap = { alimentacao: 0, transporte: 0, servicos: 0, insumos: 0, impostos: 0, outros: 0 };
  items.forEach((inv) => { const cat = inv.category || "outros"; categoryMap[cat] = (categoryMap[cat] || 0) + inv.totalAmount; });

  const gastosPorCategoria = Object.entries(categoryMap).map(([category, total]) => ({ category, total, percentage: totalGastoMes > 0 ? ((total / totalGastoMes) * 100).toFixed(1) : "0" }));

  return res.json({ success: true, tenantId, metrics: { totalNotasMes, totalGastoMes, topFornecedores, gastosPorCategoria } });
});

// Invoices list
app.get("/api/invoices", (req, res) => {
  const { tenantId } = req.query;
  let results = [...MOCK_INVOICES];
  if (tenantId && tenantId !== "all") results = results.filter((inv) => inv.tenantId === tenantId);
  return res.json({ success: true, count: results.length, invoices: results });
});

// Gemini agent proxy
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

app.post("/api/ebdAi/agent", async (req, res) => {
  try {
    const { contents, systemInstruction, tools } = req.body;
    if (!contents) return res.status(400).json({ error: "contents required" });
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        tools: tools || undefined,
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => p.text).map((p) => p.text).join("");
    const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

    return res.json({ success: true, text, functionCalls });
  } catch (error) {
    console.error("Agent proxy error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;
