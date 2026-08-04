import { z } from "zod";

// ============================================================
// ZOD SCHEMAS
// ============================================================

const InventoryQuerySchema = z.object({ item_name: z.string().optional() });
const InventoryRegisterSchema = z.object({
  name: z.string().min(2), quantity: z.number().positive(),
  unit: z.enum(["g", "ml", "un"]),
  unitCost: z.number().min(0).optional(), supplier: z.string().optional(),
  category: z.string().optional(), minStock: z.number().min(0).optional(),
});
const InventoryAddSchema = z.object({ item_name: z.string().min(2), quantity: z.number().positive() });
const InventoryRemoveSchema = z.object({ item_name: z.string().min(2), quantity: z.number().positive() });
const ReportSummarySchema = z.object({ type: z.enum(["resumo", "estoque", "produtos"]).optional() });
const ProductCreateSchema = z.object({ name: z.string().min(2), price: z.number().positive(), category: z.string().optional() });

// ============================================================
// TOOLS
// ============================================================

const OBJ = "OBJECT" as const;
const STR = "STRING" as const;
const NUM = "NUMBER" as const;
const BOOL = "BOOLEAN" as const;

const TOOLS = [{
  functionDeclarations: [
    { name: "inventory_query", description: "Consultar estoque. Use para: quanto tem de X, estoque de Y, lista de insumos.", parameters: { type: OBJ, properties: { item_name: { type: STR } } } },
    { name: "inventory_register", description: "Cadastrar insumo novo. Use para: cadastrar, criar, registrar.", parameters: { type: OBJ, properties: { name: { type: STR }, quantity: { type: NUM }, unit: { type: STR }, unitCost: { type: NUM }, supplier: { type: STR }, category: { type: STR } }, required: ["name", "quantity", "unit"] } },
    { name: "inventory_add", description: "Adicionar estoque. Use para: entrou, chegou, recebeu, adicionou.", parameters: { type: OBJ, properties: { item_name: { type: STR }, quantity: { type: NUM } }, required: ["item_name", "quantity"] } },
    { name: "inventory_remove", description: "Remover estoque. Use para: usou, gastou, removeu, consumiu.", parameters: { type: OBJ, properties: { item_name: { type: STR }, quantity: { type: NUM } }, required: ["item_name", "quantity"] } },
    { name: "inventory_alert", description: "Verificar alertas de estoque baixo/crítico/zerado.", parameters: { type: OBJ, properties: {} } },
    { name: "report_summary", description: "Relatório rápido do negócio. Use para: resumo, como tá o negócio.", parameters: { type: OBJ, properties: { type: { type: STR } } } },
    { name: "product_create", description: "Criar produto novo. Use para: criar produto, cadastrar item.", parameters: { type: OBJ, properties: { name: { type: STR }, price: { type: NUM }, category: { type: STR } }, required: ["name", "price"] } },
  ],
}];

const SYSTEM_PROMPT = `Você é a EBD, assistente de voz do RetailPro. Funcionário perfeito.
Tom: direto, rápido, profissional mas informal. Máximo 3 frases. Português do Brasil.
Chame o usuário de "chefe" ou "Brabo". Varie o tom, não repita frases.
Use contrações: "tá", "pronto", "beleza", "feito".
SEMPRE execute a ferramenta antes de responder. Converta kg→g (*1000), L→ml (*1000).
Após cada ação confirme com números exatos.
Se estoque baixo ou zerado, ALERTE imediatamente.`;

// ============================================================
// TYPES
// ============================================================

export interface LiveAgentState {
  status: "idle" | "listening" | "thinking" | "speaking" | "error";
  transcript: string;
  response: string;
  lastAction: string;
  error: string | null;
  proactiveAlert: string | null;
}

export type LiveAgentCallback = (state: LiveAgentState) => void;

export interface SupabaseContext {
  tenantId: string;
  insumosCreate: (data: any) => Promise<any>;
  insumosFindByName: (name: string, tenantId: string) => Promise<any | null>;
  insumosUpdate: (id: string, data: any) => Promise<any>;
  insumosGetAll: (tenantId: string) => Promise<any[]>;
  productsGetAll: (tenantId: string) => Promise<any[]>;
  productsCreate: (data: any) => Promise<any>;
}

export interface LiveAgentConfig {
  context?: SupabaseContext;
  onState: LiveAgentCallback;
  proactiveInterval?: number;
  useAI?: boolean; // false = local regex + TTS, zero API cost
}

// ============================================================
// AGENT ENGINE
// ============================================================

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export class LiveAgent {
  private config: LiveAgentConfig;
  private ctx: SupabaseContext | null = null;
  private proactiveTimer: ReturnType<typeof setInterval> | null = null;
  private proactiveInterval: number;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  state: LiveAgentState = {
    status: "idle", transcript: "", response: "", lastAction: "", error: null, proactiveAlert: null,
  };

  constructor(config: LiveAgentConfig) {
    this.config = config;
    this.proactiveInterval = config.proactiveInterval || 120000;
    if (config.context) this.setContext(config.context);
  }

  setContext(ctx: SupabaseContext) {
    this.ctx = ctx;
  }

  private update(p: Partial<LiveAgentState>) {
    this.state = { ...this.state, ...p };
    this.config.onState(this.state);
  }

  start() {
    if (!this.ctx) { this.update({ status: "error", error: "Sem contexto" }); return; }
    this.update({ status: "idle", error: null });
    this.startProactive();
  }

  stop() {
    this.stopListening();
    window.speechSynthesis?.cancel();
    this.stopProactive();
    this.update({ status: "idle" });
  }

  // ============================================================
  // AUDIO RECORDING (MediaRecorder → Gemini multimodal)
  // ============================================================

  async startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (this.audioChunks.length === 0) return;
        const blob = new Blob(this.audioChunks, { type: mimeType });
        await this.processAudio(blob);
      };

      this.mediaRecorder.start();
      this.update({ status: "listening", transcript: "Ouvindo...", response: "", error: null });
    } catch (e: any) {
      console.error("[EBD] Mic error:", e);
      this.update({ status: "error", error: "Microfone bloqueado. Permita no navegador." });
    }
  }

  stopListening() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
  }

  private async processAudio(blob: Blob) {
    this.update({ status: "thinking" });
    try {
      const base64 = await blobToBase64(blob);
      const mimeType = blob.type || "audio/webm";

      const res = await fetch("/api/ebdAi/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ inlineData: { mimeType, data: base64 } }],
          }],
          systemInstruction: SYSTEM_PROMPT,
          tools: TOOLS,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.stack || `Server ${res.status}`);
      }
      const data = await res.json();
      let responseText = data.text || "";
      const functionCalls: any[] = data.functionCalls || [];

      // Execute tools
      const results: any[] = [];
      for (const fc of functionCalls) {
        try {
          const result = await this.executeTool(fc.name, fc.args || {});
          results.push({ name: fc.name, result });
          this.update({ lastAction: fc.name });
        } catch (err: any) {
          results.push({ name: fc.name, error: err.message });
        }
      }

      // Round 2: send tool results back for final response
      if (results.length > 0) {
        const res2 = await fetch("/api/ebdAi/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ inlineData: { mimeType, data: base64 } }] },
              ...functionCalls.map((fc: any) => ({ role: "model", parts: [{ functionCall: fc }] })),
              { role: "user", parts: results.map((r: any) => ({
                functionResponse: { name: r.name, response: r.error ? { error: r.error } : { result: r.result } },
              })) },
            ],
            systemInstruction: SYSTEM_PROMPT,
          }),
        });
        if (res2.ok) {
          const data2 = await res2.json();
          responseText = data2.text || this.formatResult(results);
        } else {
          responseText = this.formatResult(results);
        }
      }

      if (responseText) {
        this.update({ response: responseText });
        this.speak(responseText);
      }
    } catch (err: any) {
      console.error("[EBD] Audio process error:", err);
      this.speak("Erro ao processar áudio.");
      this.update({ status: "error", error: err.message });
    }
  }

  private formatResult(results: any[]): string {
    const r = results[0];
    if (!r) return "Feito.";
    if (r.error) return `Erro: ${r.error}`;
    const d = r.result;
    if (r.name === "inventory_register") return `${d.name} cadastrado. ${d.stock}${d.unit} em estoque.`;
    if (r.name === "inventory_add") return `+${d.added} de ${d.name}. Total: ${d.newStock}${d.unit}.${d.isLow ? " Atenção: estoque baixo!" : ""}`;
    if (r.name === "inventory_remove") return `-${d.removed} de ${d.name}. Restam ${d.newStock}${d.unit}.${d.isEmpty ? " Zerou!" : d.isLow ? " Estoque baixo!" : ""}`;
    if (r.name === "report_summary") return `${d.insumos} insumos, ${d.produtos} produtos. ${d.alertas} alertas. Valor: R$${d.valorEstoque}.`;
    if (r.name === "product_create") return `${d.name} criado. R$${d.price}.`;
    return JSON.stringify(d).slice(0, 100);
  }

  // ============================================================
  // TOOL EXECUTION
  // ============================================================

  private async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const ctx = this.ctx!;

    switch (name) {
      case "inventory_query": {
        const p = InventoryQuerySchema.parse(args);
        const all = await ctx.insumosGetAll(ctx.tenantId);
        if (p.item_name) {
          const found = all.find((i: any) => i.name.toLowerCase().includes(p.item_name!.toLowerCase()));
          if (!found) return { message: `${p.item_name} não encontrado.` };
          return { name: found.name, stock: found.currentStock, unit: found.unit, min: found.minStock, cost: found.unitCost, totalValue: Math.round(found.unitCost * found.currentStock * 100) / 100, low: found.currentStock <= found.minStock };
        }
        const low = all.filter((i: any) => i.currentStock <= i.minStock);
        return { total: all.length, lowCount: low.length, items: all.map((i: any) => ({ name: i.name, stock: i.currentStock, unit: i.unit })) };
      }
      case "inventory_register": {
        const p = InventoryRegisterSchema.parse(args);
        const existing = await ctx.insumosFindByName(p.name, ctx.tenantId);
        if (existing) return { error: `${p.name} já existe.` };
        const saved = await ctx.insumosCreate({ tenantId: ctx.tenantId, code: `INS-${Date.now().toString(36).toUpperCase()}`, name: p.name, category: p.category || "Geral", unit: p.unit, currentStock: p.quantity, minStock: p.minStock ?? Math.max(1, Math.floor(p.quantity * 0.2)), unitCost: p.unitCost || 0, supplier: p.supplier || "", lastUpdated: new Date().toISOString().split("T")[0] });
        return { success: true, name: saved.name, stock: p.quantity, unit: p.unit, cost: p.unitCost };
      }
      case "inventory_add": {
        const p = InventoryAddSchema.parse(args);
        const item = await ctx.insumosFindByName(p.item_name, ctx.tenantId);
        if (!item) return { error: `${p.item_name} não encontrado.` };
        const ns = item.currentStock + p.quantity;
        await ctx.insumosUpdate(item.id, { ...item, currentStock: ns, lastUpdated: new Date().toISOString().split("T")[0] });
        return { name: item.name, added: p.quantity, newStock: ns, unit: item.unit, isLow: ns <= item.minStock };
      }
      case "inventory_remove": {
        const p = InventoryRemoveSchema.parse(args);
        const item = await ctx.insumosFindByName(p.item_name, ctx.tenantId);
        if (!item) return { error: `${p.item_name} não encontrado.` };
        const ns = Math.max(0, item.currentStock - p.quantity);
        await ctx.insumosUpdate(item.id, { ...item, currentStock: ns, lastUpdated: new Date().toISOString().split("T")[0] });
        return { name: item.name, removed: p.quantity, newStock: ns, unit: item.unit, isEmpty: ns <= 0, isLow: ns > 0 && ns <= item.minStock };
      }
      case "inventory_alert": {
        InventoryQuerySchema.parse(args);
        const all = await ctx.insumosGetAll(ctx.tenantId);
        const empty = all.filter((i: any) => i.currentStock <= 0);
        const critical = all.filter((i: any) => i.currentStock > 0 && i.currentStock <= i.minStock * 0.5);
        const low = all.filter((i: any) => i.currentStock > i.minStock * 0.5 && i.currentStock <= i.minStock);
        return { ok: empty.length === 0 && critical.length === 0 && low.length === 0, empty: empty.map((i: any) => i.name), critical: critical.map((i: any) => i.name), low: low.map((i: any) => i.name) };
      }
      case "report_summary": {
        ReportSummarySchema.parse(args);
        const insumos = await ctx.insumosGetAll(ctx.tenantId);
        const products = await ctx.productsGetAll(ctx.tenantId);
        const totalValue = insumos.reduce((s: number, i: any) => s + i.unitCost * i.currentStock, 0);
        const alerts = insumos.filter((i: any) => i.currentStock <= i.minStock).length;
        return { insumos: insumos.length, produtos: products.length, valorEstoque: Math.round(totalValue * 100) / 100, alertas: alerts };
      }
      case "product_create": {
        const p = ProductCreateSchema.parse(args);
        const saved = await ctx.productsCreate({ tenantId: ctx.tenantId, name: p.name, category: p.category || "Geral", sku: `SKU-${Date.now().toString(36).toUpperCase()}`, stockQuantity: 0, oldPrice: p.price, saleDiscountPercent: 0, newPrice: p.price, itemsSold: 0, status: "In Stock" });
        return { name: saved.name, price: p.price };
      }
      default: return { error: `Ferramenta "${name}" desconhecida.` };
    }
  }

  // ============================================================
  // PROACTIVE
  // ============================================================

  private startProactive() {
    this.stopProactive();
    this.proactiveTimer = setInterval(() => this.proactiveCheck(), this.proactiveInterval);
  }

  private stopProactive() {
    if (this.proactiveTimer) { clearInterval(this.proactiveTimer); this.proactiveTimer = null; }
  }

  private async proactiveCheck() {
    if (!this.ctx) return;
    try {
      const insumos = await this.ctx.insumosGetAll(this.ctx.tenantId);
      const empty = insumos.filter((i: any) => i.currentStock <= 0);
      const critical = insumos.filter((i: any) => i.currentStock > 0 && i.currentStock <= i.minStock * 0.5);
      if (empty.length > 0 || critical.length > 0) {
        const alert = empty.length > 0 ? `${empty.length} insumos zerados: ${empty.map((i: any) => i.name).join(", ")}` : `${critical.length} críticos: ${critical.map((i: any) => i.name).join(", ")}`;
        this.update({ proactiveAlert: alert });
      } else {
        this.update({ proactiveAlert: null });
      }
    } catch {}
  }

  // ============================================================
  // TEXT-TO-SPEECH
  // ============================================================

  // ============================================================
  // TEXT INPUT
  // ============================================================

  async sendText(text: string) {
    this.update({ status: "thinking", transcript: text });
    const useAI = (this.config as any).useAI !== false;
    if (useAI) { await this.sendTextWithAI(text); }
    else { await this.sendTextLocal(text); }
    this.update({ status: "idle" });
  }

  private async sendTextLocal(text: string) {
    const parsed = this.localParse(text);
    if (parsed.tool === "unknown") {
      const msg = "Não entendi. O que posso fazer:\n\n• cadastrar [nome] [qtd]\n• adicionar [qtd] de [nome]\n• gastar [qtd] de [nome]\n• consultar [nome]\n• resumo\n• alertas\n• criar produto [nome] preço [valor]";
      this.update({ response: msg }); this.speak(msg); return;
    }
    try {
      const result = await this.executeTool(parsed.tool, parsed.args);
      const msg = this.formatResultDirect(parsed.tool, result);
      this.update({ lastAction: parsed.tool, response: msg }); this.speak(msg);
    } catch (err: any) {
      const msg = "Erro: " + err.message;
      this.update({ response: msg }); this.speak(msg);
    }
  }

  private localParse(text: string): { tool: string; args: Record<string, any> } {
    const lower = text.toLowerCase().trim();

    // CADASTRAR INSUMO: "cadastrar farinha 500g", "add insumo açúcar 2kg", "novo item leite", "incluir café", "quero cadastrar arroz", "cria insumo feijão"
    const regMatch = lower.match(/(?:cadastrar?|criar?|cria|novo|add|adicionar\s+novo|incluir|quero\s+cadastrar|quero\s+add|quero\s+criar)\s+(?:insumo|item|ingrediente)?\s*(.+?)(?:\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l))?(?:\s+(?:pre[çc]o|custo|a|por|valor)\s*r?\$?\s*(\d+[\.,]?\d*))?/);
    if (regMatch) {
      return { tool: "inventory_register", args: { name: regMatch[1].trim(), quantity: 0, unit: "g", unitCost: 0 } };
    }

    // ADICIONAR: "adicionar 5kg de farinha", "entrou 200g açúcar", "chegou 1L leite", "add 500g farinha", "mais 2kg açúcar", "coloca 1kg arroz"
    const addMatch = lower.match(/(?:adicione?|adicionar|entrou|chegou|recebi|coloca|bota|somou?|add|mais|acrescentar|acrescenta)\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l)?\s+(?:do|da|de)?\s*(.+)/);
    if (addMatch) return { tool: "inventory_add", args: { item_name: addMatch[3].trim(), quantity: parseFloat(addMatch[1].replace(",", ".")) * 1 } };

    // REMOVER: "gastei 200g farinha", "usei 1L leite", "remove 500g açúcar", "tira 100g", "menos 200g", "consumiu 1kg"
    const remMatch = lower.match(/(?:gastou?|gastei|usou?|usei|remove?|remover|tirar|tira|baixar|diminuir|consumiu|perdi|saiu|menos|subtrair)\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l)?\s+(?:do|da|de)?\s*(.+)/);
    if (remMatch) return { tool: "inventory_remove", args: { item_name: remMatch[3].trim(), quantity: parseFloat(remMatch[1].replace(",", ".")) * 1 } };

    // CONSULTAR: "quanto tem de farinha", "estoque de açúcar", "ver café", "consulta arroz", "mostra feijão", "qual estoque"
    const qMatch = lower.match(/(?:quanto|qual|estoque|consultar?|ver|mostrar?|mostra|exibir|checar|olhar?)\s+(?:tem|tenho|est[aá]|o\s+estoque\s+de)?\s*(?:de|do|da)?\s*(.+)/);
    if (qMatch) return { tool: "inventory_query", args: { item_name: qMatch[1].trim() } };

    // RESUMO: "resumo", "como tá", "relatório", "visão geral", "status"
    if (/(?:resumo|relat[oó]rio|como\s+(?:est[aá]|t[aá])|dashboard|vis[aã]o\s+geral|status|situa[cç][aã]o)/i.test(lower)) return { tool: "report_summary", args: {} };

    // ALERTAS: "alerta", "estoque baixo", "problema", "crítico", "zerado"
    if (/(?:alerta|estoque\s+baixo|cr[ií]tico|zerado|acabou|problema|sem\s+estoque|faltando)/i.test(lower)) return { tool: "inventory_alert", args: {} };

    // CRIAR PRODUTO
    const prodMatch = lower.match(/(?:criar?|cria|cadastrar?|add|novo)\s+(?:produto|prod|item)\s+(.+?)(?:\s+(?:pre[çc]o|por|a|valor)\s*r?\$?\s*(\d+[\.,]?\d*))?/);
    if (prodMatch) return { tool: "product_create", args: { name: prodMatch[1].trim(), price: prodMatch[2] ? parseFloat(prodMatch[2].replace(",", ".")) : 0 } };

    // Se chegou aqui, retorna unknown - o handler vai mostrar a ajuda
    return { tool: "unknown", args: {} };
  }

  private async sendTextWithAI(text: string) {
    try {
      const res = await fetch("/api/ebdAi/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text }] }], systemInstruction: SYSTEM_PROMPT, tools: TOOLS }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Server " + res.status); }
      const data = await res.json();
      let responseText = data.text || "";
      const fcs: any[] = data.functionCalls || [];
      const results: any[] = [];
      for (const fc of fcs) {
        try { results.push({ name: fc.name, result: await this.executeTool(fc.name, fc.args || {}) }); this.update({ lastAction: fc.name }); }
        catch (err: any) { results.push({ name: fc.name, error: err.message }); }
      }
      if (results.length > 0) responseText = this.formatResult(results);
      if (responseText) { this.update({ response: responseText }); this.speak(responseText); }
    } catch (err: any) {
      this.update({ status: "error", error: err.message });
    }
    this.update({ status: "idle" });
  }

  private formatResultDirect(tool: string, result: any): string {
    if (result.error) return String(result.error);
    if (tool === "inventory_register") return result.name + " cadastrado. " + (result.stock || 0) + (result.unit || "g") + " em estoque.";
    if (tool === "inventory_add") return "+" + result.added + " de " + result.name + ". Total: " + result.newStock + (result.unit || "g") + ".";
    if (tool === "inventory_remove") return "-" + result.removed + " de " + result.name + ". Restam " + result.newStock + (result.unit || "g") + ".";
    if (tool === "report_summary") return result.insumos + " insumos, " + result.produtos + " produtos. " + result.alertas + " alertas.";
    if (tool === "inventory_alert") return result.ok ? "Tudo ok." : (result.empty?.length || 0) + " zerados, " + (result.critical?.length || 0) + " criticos.";
    return JSON.stringify(result).slice(0, 100);
  }

  speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    this.update({ status: "speaking" });
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR"; u.rate = 1.0; u.pitch = 1.1;
    u.onend = () => { if (this.state.status === "speaking") this.update({ status: "idle" }); };
    window.speechSynthesis.speak(u);
  }

}

export function createLiveAgent(config: LiveAgentConfig): LiveAgent {
  return new LiveAgent(config);
}
