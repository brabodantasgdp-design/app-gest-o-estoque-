import express from "express";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json({ limit: "25mb" }));

// WhatsApp config (UAZAPI)
const UAZAPI_URL = process.env.UAZAPI_BASE_URL || "";
const UAZAPI_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN || "";

const MOCK_INVOICES = [
  { id: "inv-101", tenantId: "tenant-1", supplierName: "Distribuidores & Atacadista do Sul Ltda", cnpj: "12.345.678/0001-90", invoiceNumber: "NF-84920", invoiceDate: "2026-08-03", totalAmount: 1450.80, category: "insumos", notes: "Reposição de farinhas.", processed: true, processedAt: "14:20", items: [] },
  { id: "inv-102", tenantId: "tenant-1", supplierName: "Laticínios Vale Verde S.A.", cnpj: "98.765.432/0001-22", invoiceNumber: "NF-91024", invoiceDate: "2026-08-02", totalAmount: 890.50, category: "alimentacao", notes: "Manteiga culinária.", processed: true, processedAt: "10:15", items: [] },
  { id: "inv-103", tenantId: "tenant-1", supplierName: "Express Logística", cnpj: "45.889.112/0001-33", invoiceNumber: "NF-33219", invoiceDate: "2026-08-01", totalAmount: 320.00, category: "transporte", notes: "Frete embalagens.", processed: true, processedAt: "16:45", items: [] },
  { id: "inv-104", tenantId: "tenant-1", supplierName: "TechAssist", cnpj: "33.111.222/0001-88", invoiceNumber: "NF-77412", invoiceDate: "2026-07-28", totalAmount: 1250.00, category: "servicos", notes: "Manutenção.", processed: false, items: [] },
  { id: "inv-105", tenantId: "tenant-1", supplierName: "Receita Estadual", cnpj: "00.000.000/0001-00", invoiceNumber: "DAS-202607", invoiceDate: "2026-07-25", totalAmount: 2180.40, category: "impostos", notes: "Guia DAS.", processed: true, processedAt: "09:00", items: [] },
  { id: "inv-201", tenantId: "tenant-2", supplierName: "Moka Barista", cnpj: "77.888.999/0001-44", invoiceNumber: "NF-11029", invoiceDate: "2026-08-03", totalAmount: 640.00, category: "insumos", notes: "Café especial.", processed: false, items: [] },
];

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.SUPABASE_ADMIN_EMAIL;
  const adminPassword = process.env.SUPABASE_ADMIN_PASSWORD;
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (!authError && authData.user) {
        const { data: userProfile } = await supabase.from("users").select("*, tenants(name)").eq("id", authData.user.id).single();
        if (userProfile) return res.json({ success: true, user: { id: userProfile.id, name: userProfile.name, email: userProfile.email, role: userProfile.role, tenantId: userProfile.tenant_id, tenantName: userProfile.tenants?.name || "" }, token: authData.session?.access_token });
      }
    }
  } catch (err) { console.log("Supabase off"); }
  if (adminEmail && email === adminEmail && password === adminPassword) return res.json({ success: true, user: { id: "usr-superadmin", name: "Brabo Dantas", email, role: "super_admin", tenantName: "Painel Global SaaS" }, token: "jwt" });
  return res.json({ success: true, user: { id: "usr-demo", name: email?.split("@")[0] || "Lojista", email: email || "dono@loja.com.br", role: "store_owner", tenantId: "tenant-1", tenantName: "Loja Demo" }, token: "jwt_demo" });
});

app.get("/api/dashboard", (req, res) => {
  try {
    const { tenantId = "tenant-1" } = req.query;
    let items = MOCK_INVOICES;
    if (tenantId && tenantId !== "all") items = items.filter((i) => i.tenantId === tenantId);
    const totalNotasMes = items.length;
    const totalGastoMes = items.reduce((acc, i) => acc + i.totalAmount, 0);
    const supplierMap = {};
    items.forEach((inv) => { if (!supplierMap[inv.supplierName]) supplierMap[inv.supplierName] = { count: 0, total: 0 }; supplierMap[inv.supplierName].count += 1; supplierMap[inv.supplierName].total += inv.totalAmount; });
    const topFornecedores = Object.entries(supplierMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total).slice(0, 5);
    const categoryMap = { alimentacao: 0, transporte: 0, servicos: 0, insumos: 0, impostos: 0, outros: 0 };
    items.forEach((inv) => { const cat = inv.category || "outros"; categoryMap[cat] = (categoryMap[cat] || 0) + inv.totalAmount; });
    const gastosPorCategoria = Object.entries(categoryMap).map(([category, total]) => ({ category, total, percentage: totalGastoMes > 0 ? ((total / totalGastoMes) * 100).toFixed(1) : "0" }));
    return res.json({ success: true, tenantId, metrics: { totalNotasMes, totalGastoMes, topFornecedores, gastosPorCategoria } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/invoices", (req, res) => {
  const { tenantId } = req.query;
  let results = [...MOCK_INVOICES];
  if (tenantId && tenantId !== "all") results = results.filter((inv) => inv.tenantId === tenantId);
  return res.json({ success: true, count: results.length, invoices: results });
});

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

app.post("/api/ebdAi/agent", async (req, res) => {
  try {
    const { contents, systemInstruction, tools } = req.body;
    if (!contents) return res.status(400).json({ error: "contents required" });
    if (!GEMINI_KEY) return res.status(500).json({ error: "GEMINI_API_KEY not set" });
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: { systemInstruction, tools, temperature: 0.7, maxOutputTokens: 512 },
    });
    const parts = response.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => p.text).map((p) => p.text).join("");
    const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
    return res.json({ success: true, text, functionCalls });
  } catch (e) {
    console.error("Agent proxy error:", e?.message || e, e?.stack?.slice?.(0, 300));
    return res.status(500).json({ success: false, error: e?.message || String(e), stack: e?.stack?.slice?.(0, 500) });
  }
});

// ============================================================
// BUFFER DEBOUNCE (acumula msgs por X segundos antes de processar)
// ============================================================
const BUFFER_SECONDS = parseInt(process.env.BUFFER_SECONDS || "6");
const buffers = {}; // { number: { texts: [], timer: Timeout } };

function bufferAdd(number, text, onFlush) {
  if (!buffers[number]) buffers[number] = { texts: [], timer: null };
  const b = buffers[number];
  b.texts.push(text);
  if (b.timer) clearTimeout(b.timer);
  b.timer = setTimeout(() => {
    const texts = [...b.texts];
    delete buffers[number];
    console.log(`[buffer] flush user=${number} msgs=${texts.length}`);
    onFlush(number, texts);
  }, BUFFER_SECONDS * 1000);
}

// ============================================================
// WHATSAPP WEBHOOK + REPLY ENGINE
// ============================================================

async function sendWp(number, text) {
  if (!UAZAPI_URL || !UAZAPI_TOKEN) return;
  try {
    await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
      body: JSON.stringify({ number, text }),
    });
  } catch (e) { console.error("sendWp error:", e.message); }
}

async function sendPresence(number, presence) {
  if (!UAZAPI_URL || !UAZAPI_TOKEN) return;
  try {
    await fetch(`${UAZAPI_URL}/send/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
      body: JSON.stringify({ number, presence }),
    });
  } catch {}
}

async function markRead(number, messageId) {
  if (!UAZAPI_URL || !UAZAPI_TOKEN || !messageId || messageId === "0") return;
  try {
    await fetch(`${UAZAPI_URL}/send/read`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
      body: JSON.stringify({ number, messageId }),
    });
  } catch {}
}

// Supabase command parser (mesma logica do Modo Local do liveAgent.ts)
async function processCommand(text, tenantId) {
  const lower = text.toLowerCase().trim();
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return "Sistema offline.";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // CADASTRAR
  const regMatch = lower.match(/(?:cadastrar?|cria|novo)\s+(?:insumo|item|ingrediente)?\s*(.+?)(?:\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l))?(?:\s+(?:pre[çc]o|custo|a|por)\s*r?\$?\s*(\d+[\.,]?\d*))?/);
  if (regMatch) {
    const name = regMatch[1]?.trim();
    if (!name || name.length < 2) return null;
    const rawQty = regMatch[2]; const rawUnit = regMatch[3] || "g"; const rawPrice = regMatch[4];
    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const unit = rawUnit === "kg" ? "g" : rawUnit === "l" ? "ml" : rawUnit;
    const { data: exist } = await supabase.from("insumos").select("*").eq("tenant_id", tenantId).ilike("name", `%${name}%`).single();
    if (exist) return `Insumo "${exist.name}" ja existe. Codigo: ${exist.code}`;
    const qty = rawQty ? parseFloat(rawQty.replace(",", ".")) * factor : 0;
    const code = "INS-" + Date.now().toString(36).toUpperCase();
    const { error } = await supabase.from("insumos").insert({ tenant_id: tenantId, code, name, category: "Geral", unit, current_stock: qty, min_stock: Math.max(1, Math.floor(qty * 0.2)), unit_cost: rawPrice ? parseFloat(rawPrice.replace(",", ".")) : 0, supplier: "", last_updated: new Date().toISOString().split("T")[0] });
    return error ? "Erro ao cadastrar." : `${name} cadastrado. ${qty}${unit} em estoque.`;
  }

  // ADICIONAR
  const addMatch = lower.match(/(?:adicione?|adicionar|entrou|chegou|recebi|coloca|bota)\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l)?\s+(?:do|da|de)?\s*(.+)/);
  if (addMatch) {
    const rawQty = parseFloat(addMatch[1].replace(",", ".")); const rawUnit = addMatch[2] || "g"; const name = addMatch[3]?.trim();
    if (!name) return null;
    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const { data: item } = await supabase.from("insumos").select("*").eq("tenant_id", tenantId).ilike("name", `%${name}%`).single();
    if (!item) return `Nao encontrei "${name}".`;
    const ns = item.current_stock + rawQty * factor;
    await supabase.from("insumos").update({ current_stock: ns, last_updated: new Date().toISOString().split("T")[0] }).eq("id", item.id);
    return `+${rawQty * factor} de ${item.name}. Total: ${ns}${item.unit}.`;
  }

  // REMOVER
  const remMatch = lower.match(/(?:gastou?|gastei|usou?|usei|remove?|remover|tirar|baixar|consumiu|perdi)\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l)?\s+(?:do|da|de)?\s*(.+)/);
  if (remMatch) {
    const rawQty = parseFloat(remMatch[1].replace(",", ".")); const rawUnit = remMatch[2] || "g"; const name = remMatch[3]?.trim();
    if (!name) return null;
    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const { data: item } = await supabase.from("insumos").select("*").eq("tenant_id", tenantId).ilike("name", `%${name}%`).single();
    if (!item) return `Nao encontrei "${name}".`;
    const ns = Math.max(0, item.current_stock - rawQty * factor);
    await supabase.from("insumos").update({ current_stock: ns, last_updated: new Date().toISOString().split("T")[0] }).eq("id", item.id);
    return ns <= 0 ? `${item.name} zerou!` : `-${rawQty * factor} de ${item.name}. Restam ${ns}${item.unit}.`;
  }

  // CONSULTAR
  const qMatch = lower.match(/(?:quanto|qual|estoque|consultar?)\s+(?:tem|tenho|est[aá])?\s*(?:de|do|da)?\s*(.+)/);
  if (qMatch) {
    const name = qMatch[1]?.trim();
    if (!name) return null;
    const { data: item } = await supabase.from("insumos").select("*").eq("tenant_id", tenantId).ilike("name", `%${name}%`).single();
    return item ? `${item.name}: ${item.current_stock}${item.unit} (min: ${item.min_stock})` : `Nao encontrei "${name}".`;
  }

  // RESUMO
  if (/(?:resumo|relat[oó]rio|como\s+(?:est[aá]|t[aá])|dashboard)/i.test(lower)) {
    const { data: ins } = await supabase.from("insumos").select("*").eq("tenant_id", tenantId);
    const { data: prod } = await supabase.from("products").select("*").eq("tenant_id", tenantId);
    const alerts = ins ? ins.filter(i => i.current_stock <= i.min_stock).length : 0;
    return `${ins ? ins.length : 0} insumos, ${prod ? prod.length : 0} produtos. ${alerts} alertas.`;
  }

  // ALERTAS
  if (/(?:alerta|estoque\s+baixo|cr[ií]tico|zerado|acabou|problema)/i.test(lower)) {
    const { data: ins } = await supabase.from("insumos").select("*").eq("tenant_id", tenantId);
    const empty = ins ? ins.filter(i => i.current_stock <= 0) : [];
    const critical = ins ? ins.filter(i => i.current_stock > 0 && i.current_stock <= i.min_stock * 0.5) : [];
    const low = ins ? ins.filter(i => i.current_stock > i.min_stock * 0.5 && i.current_stock <= i.min_stock) : [];
    if (empty.length === 0 && critical.length === 0 && low.length === 0) return "Tudo ok, sem alertas.";
    return `${empty.length} zerados, ${critical.length} criticos, ${low.length} baixos.`;
  }

  return null; // comando nao reconhecido
}

function splitReply(text) {
  const chunks = [];
  for (const para of text.split(/\n\n+/)) {
    const t = para.trim();
    if (!t) continue;
    if (t.length <= 800) { chunks.push(t); continue; }
    const sentences = t.split(/(?<=\.)\s+/);
    let current = "";
    for (const s of sentences) {
      if ((current + s).length > 800 && current) { chunks.push(current.trim()); current = s; }
      else current += s;
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks.length > 0 ? chunks : [text];
}

async function flushAndReply(number, texts) {
  const tenantId = process.env.DEFAULT_TENANT_ID || "tenant-1";
  const combined = texts.join("\n");

  // Try Gemini first, fall back to local parser
  let reply = "";
  try {
    if (GEMINI_API_KEY) {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const res = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: combined }] }],
        config: {
          systemInstruction: "Voce e a EBD, assistente de estoque. Responda no WhatsApp. Seja breve, natural, maximo 2-3 frases. Use '\\n\\n' para separar ideias. Portugues do Brasil.",
          maxOutputTokens: 300,
        },
      });
      reply = res.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    }
  } catch (e) { console.log("[wp] Gemini off, usando parser local"); }

  if (!reply) reply = (await processCommand(combined, tenantId)) || "Comandos: cadastrar [nome] [qtd], adicionar [qtd] de [nome], gastar [qtd] de [nome], consultar [nome], resumo, alertas.";

  // Send reply in chunks with typing indicators
  const chunks = splitReply(reply);
  for (let i = 0; i < chunks.length; i++) {
    await sendPresence(number, "composing");
    await new Promise(r => setTimeout(r, 800 + Math.floor(chunks[i].length / 100) * 200));
    await sendWp(number, chunks[i]);
  }
  await sendPresence(number, "paused");
}

app.post("/api/whatsapp/webhook", async (req, res) => {
  res.sendStatus(200); // responde rapido, processa em background
  try {
    const { event, data } = req.body;
    if (event !== "message") return;

    const number = (data?.from || "").replace("@s.whatsapp.net", "").replace("@c.us", "");
    const text = data?.body || "";
    const type = data?.type || "text";
    const fromMe = data?.fromMe === true;
    const isGroup = data?.isGroup === true;

    if (!number || !text || fromMe || isGroup || type !== "text") return;

    console.log(`[wp] ${number}: ${text.slice(0, 80)}`);
    await markRead(number, data?.id || "0");
    bufferAdd(number, text, flushAndReply);
  } catch (e) { console.error("[wp] webhook error:", e.message); }
});

export default app;
