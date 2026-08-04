/**
 * EBD LiveAgent v2 — Universal Voice Agent Module
 *
 * Drop into any web app:
 *   import { createLiveAgent } from "./liveAgent";
 *   const agent = createLiveAgent({ apiKey: "...", context: {...}, onState: (s) => {} });
 *   agent.start();
 *
 * Features:
 *   - Gemini Live WebSocket (gemini-live-2.5-flash-preview)
 *   - Zod parameter validation on all tool calls
 *   - Proactive stock monitoring (background polling)
 *   - Conversation memory (localStorage, context injection)
 *   - Humanized voice personality
 *   - Offline fallback (local regex parser + rule engine)
 *   - Auto-reconnect with exponential backoff
 *   - Tenant-isolated Supabase operations
 */

import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

// ============================================================
// ZOD SCHEMAS — Validação estrita de todas as entradas
// ============================================================

const InventoryQuerySchema = z.object({
  item_name: z.string().optional(),
});

const InventoryRegisterSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  quantity: z.number().positive("Quantidade deve ser positiva"),
  unit: z.enum(["g", "ml", "un"]),
  unitCost: z.number().min(0).optional(),
  supplier: z.string().optional(),
  category: z.string().optional(),
  minStock: z.number().min(0).optional(),
});

const InventoryAddSchema = z.object({
  item_name: z.string().min(2),
  quantity: z.number().positive(),
  unit: z.enum(["g", "ml", "un"]).optional(),
});

const InventoryRemoveSchema = z.object({
  item_name: z.string().min(2),
  quantity: z.number().positive(),
  unit: z.enum(["g", "ml", "un"]).optional(),
});

const ReportSummarySchema = z.object({
  type: z.enum(["resumo", "estoque", "produtos", "vendas"]).optional(),
});

const ProductCreateSchema = z.object({
  name: z.string().min(2),
  price: z.number().positive(),
  category: z.string().optional(),
});

// ============================================================
// TOOLS — Gemini Function Declarations
// ============================================================

const TOOLS = [{
  functionDeclarations: [{
    name: "inventory_query",
    description: "Consultar estoque: item específico ou lista completa. Use quando perguntarem 'quanto tem de X' ou 'estoque'.",
    parameters: { type: Type.OBJECT, properties: { item_name: { type: Type.STRING } } },
  }, {
    name: "inventory_register",
    description: "Cadastrar novo insumo no estoque. Use para: cadastrar, criar, registrar insumo/ingrediente.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Nome do insumo" },
        quantity: { type: Type.NUMBER, description: "Quantidade inicial (converta kg→g multiplicando por 1000, L→ml por 1000)" },
        unit: { type: Type.STRING, description: "Unidade: g, ml ou un" },
        unitCost: { type: Type.NUMBER, description: "Custo unitário por grama/ml/unidade" },
        supplier: { type: Type.STRING },
        category: { type: Type.STRING },
        minStock: { type: Type.NUMBER, description: "Estoque mínimo para alerta" },
      },
      required: ["name", "quantity", "unit"],
    },
  }, {
    name: "inventory_add",
    description: "Adicionar ao estoque (entrada). Use quando: entrou, chegou, recebeu, comprou, adicionou.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_name: { type: Type.STRING, description: "Nome exato do insumo" },
        quantity: { type: Type.NUMBER, description: "Quantidade (kg→g *1000, L→ml *1000)" },
        unit: { type: Type.STRING },
      },
      required: ["item_name", "quantity"],
    },
  }, {
    name: "inventory_remove",
    description: "Remover do estoque (saída). Use quando: usou, gastou, consumiu, removeu, tirou, baixou.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_name: { type: Type.STRING, description: "Nome exato do insumo" },
        quantity: { type: Type.NUMBER, description: "Quantidade (kg→g *1000, L→ml *1000)" },
        unit: { type: Type.STRING },
      },
      required: ["item_name", "quantity"],
    },
  }, {
    name: "inventory_alert",
    description: "Verificar alertas de estoque: baixo, crítico ou zerado. Use quando perguntarem de problemas, alertas, ou disserem 'estoque baixo'.",
    parameters: { type: Type.OBJECT, properties: {} },
  }, {
    name: "report_summary",
    description: "Relatório rápido: visão geral do negócio. Use para: resumo, relatório, dashboard, como está/tá o negócio/loja.",
    parameters: {
      type: Type.OBJECT,
      properties: { type: { type: Type.STRING, description: "resumo, estoque, produtos ou vendas" } },
    },
  }, {
    name: "product_create",
    description: "Criar produto no catálogo. Use para: criar/cadastrar produto, novo item, adicionar ao cardápio.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Nome do produto" },
        price: { type: Type.NUMBER, description: "Preço de venda em reais" },
        category: { type: Type.STRING },
      },
      required: ["name", "price"],
    },
  }],
}];

const SYSTEM_INSTRUCTION = `
Você é a EBD, assistente de voz do RetailPro. Você é o FUNCIONÁRIO PERFEITO.

## QUEM VOCÊ É
- Nome: EBD (ElBravoDantas)
- Tom: direto, rápido, profissional, levemente informal. Como um braço direito de confiança.
- Varie suas respostas. Não repita sempre a mesma frase.
- Seja CONCISO. Máximo 3 frases. Você fala por voz, não escreve textão.
- Sempre em português do Brasil.
- Trate o usuário como "chefe" ou pelo nome "Brabo".
- Após cada ação, CONFIRME com os números exatos.

## COMPORTAMENTO PROATIVO
- Se detectar estoque baixo (< mínimo), alerte IMEDIATAMENTE e sugira reposição.
- Se detectar estoque zerado, alerte com URGÊNCIA.
- Se alguém remover e o estoque ficar baixo, AVISE.
- Pense um passo à frente: o que o chefe precisa saber AGORA?

## REGRAS DE EXECUÇÃO
- SEMPRE execute a ferramenta correta ANTES de responder.
- Converta automaticamente: "5kg" = 5000g, "2 litros" = 2000ml.
- O sistema usa g (gramas), ml (mililitros), un (unidades).
- JAMAIS invente dados. Use o que a ferramenta retornou.
- Se uma ferramenta falhar, diga claramente o que deu errado.

## TOM DE VOZ
- Seja natural. Não soe como robô.
- Use contrações: "tá", "pronto", "beleza", "feito".
- Às vezes comece com "Chefe," ou "Brabo,".
- Varie entre frases curtas e confirmações diretas.
`.trim();

// ============================================================
// OFFLINE PARSER — Quando Gemini está offline
// ============================================================

interface ParsedIntent {
  tool: string;
  args: Record<string, any>;
  confidence: number;
}

function offlineParse(text: string): ParsedIntent {
  const lower = text.toLowerCase();

  // Cadastrar: "cadastrar farinha 5000g preço 0.05"
  const registerMatch = lower.match(/(?:cadastrar?|criar|novo|cadastra)\s+(?:insumo|item|ingrediente)?\s*(.+?)(?:\s+(\d+\.?\d*)\s*(g|ml|un|kg|l))?(?:\s+(?:pre[çc]o|custo|por|a)\s*r?\$?\s*(\d+[\.,]?\d*))?(?:\s+(?:fornecedor|de|do)\s+(.+?))?$/);
  if (registerMatch) {
    const name = registerMatch[1]?.trim();
    const rawQty = registerMatch[2];
    const rawUnit = registerMatch[3];
    const rawPrice = registerMatch[4];
    const supplier = registerMatch[5]?.trim();
    if (!name || name.length < 2) return { tool: "unknown", args: {}, confidence: 0 };

    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const unit = rawUnit === "kg" ? "g" : rawUnit === "l" ? "ml" : (rawUnit as "g" | "ml" | "un" || "g");
    return {
      tool: "inventory_register",
      args: {
        name,
        quantity: rawQty ? parseFloat(rawQty) * factor : 0,
        unit,
        unitCost: rawPrice ? parseFloat(rawPrice.replace(",", ".")) : undefined,
        supplier: supplier || undefined,
      },
      confidence: 0.75,
    };
  }

  // Adicionar: "adicionar 5kg de farinha", "entrou 200g de açúcar"
  const addMatch = lower.match(/(?:adicione?|adicionar|entrou|chegou|recebi|somou?|coloca|bota)\s+(\d+\.?\d*)\s*(g|ml|un|kg|l)?\s+(?:do|da|de)?\s*(.+)/);
  if (addMatch) {
    const rawQty = parseFloat(addMatch[1]);
    const rawUnit = addMatch[2];
    const name = addMatch[3]?.trim();
    if (!name) return { tool: "unknown", args: {}, confidence: 0 };
    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const unit = rawUnit === "kg" ? "g" : rawUnit === "l" ? "ml" : (rawUnit as "g" | "ml" | "un" || "g");
    return { tool: "inventory_add", args: { item_name: name, quantity: rawQty * factor, unit }, confidence: 0.8 };
  }

  // Remover: "gastei 200g de farinha", "usei 1L de leite"
  const removeMatch = lower.match(/(?:remove?|remover|tirar|diminuir|baixar|gastou?|gastei|usou?|usei|consumiu|perdi|saiu)\s+(\d+\.?\d*)\s*(g|ml|un|kg|l)?\s+(?:do|da|de)?\s*(.+)/);
  if (removeMatch) {
    const rawQty = parseFloat(removeMatch[1]);
    const rawUnit = removeMatch[2];
    const name = removeMatch[3]?.trim();
    if (!name) return { tool: "unknown", args: {}, confidence: 0 };
    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const unit = rawUnit === "kg" ? "g" : rawUnit === "l" ? "ml" : (rawUnit as "g" | "ml" | "un" || "g");
    return { tool: "inventory_remove", args: { item_name: name, quantity: rawQty * factor, unit }, confidence: 0.8 };
  }

  // Relatório / resumo
  if (/(?:resumo|relat[oó]rio|dashboard|como\s+(?:est[aá]|t[aá])\s+(?:o\s+)?(?:neg[oó]cio|estoque|loja|empresa))/i.test(lower)) {
    return { tool: "report_summary", args: { type: "resumo" }, confidence: 0.85 };
  }

  // Alertas
  if (/(?:alerta|estoque\s+baixo|cr[ií]tico|problema|zerado|acabou|sem\s+estoque)/i.test(lower)) {
    return { tool: "inventory_alert", args: {}, confidence: 0.85 };
  }

  // Consulta: "quanto tem de farinha"
  const queryMatch = lower.match(/(?:quanto|qual|estoque|consultar?)\s+(?:tem|tenho|est[aá])?\s*(?:de|do|da)?\s*(.+)/);
  if (queryMatch) {
    return { tool: "inventory_query", args: { item_name: queryMatch[1]?.trim() }, confidence: 0.7 };
  }

  // Criar produto
  const productMatch = lower.match(/(?:criar?|cria|cadastrar?)\s+(?:produto|prod|item)\s+(.+?)(?:\s+(?:pre[çc]o|por|a)\s*r?\$?\s*(\d+[\.,]?\d*))?/);
  if (productMatch) {
    const name = productMatch[1]?.trim();
    const price = productMatch[2] ? parseFloat(productMatch[2].replace(",", ".")) : 0;
    if (name) return { tool: "product_create", args: { name, price }, confidence: 0.7 };
  }

  return { tool: "unknown", args: {}, confidence: 0 };
}

// ============================================================
// TYPES
// ============================================================

export interface LiveAgentState {
  status: "disconnected" | "connecting" | "connected" | "error";
  listening: boolean;
  lastSpeech: string;
  lastAction: string;
  lastResponse: string;
  error: string | null;
  proactiveAlert: string | null;
  memoryCount: number;
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
  ordersCreate?: (data: any) => Promise<any>;
}

export interface LiveAgentConfig {
  apiKey: string;
  context?: SupabaseContext;
  onState: LiveAgentCallback;
  proactiveInterval?: number; // ms, default 60s
}

// ============================================================
// MEMORY SYSTEM
// ============================================================

interface MemoryEntry {
  key: string;
  value: any;
  timestamp: number;
}

class MemoryStore {
  private store: Map<string, any> = new Map();
  private readonly maxEntries = 50;
  private readonly storageKey: string;

  constructor(tenantId: string) {
    this.storageKey = `ebd_memory_${tenantId}`;
    this.load();
  }

  remember(key: string, value: any) {
    this.store.set(key, { value, timestamp: Date.now() });
    if (this.store.size > this.maxEntries) {
      const oldest = [...this.store.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.store.delete(oldest[0]);
    }
    this.save();
  }

  recall(key: string): any | null {
    return this.store.get(key)?.value ?? null;
  }

  getRecent(n: number = 5): MemoryEntry[] {
    return [...this.store.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, n);
  }

  all(): Record<string, any> {
    const obj: Record<string, any> = {};
    this.store.forEach((v, k) => { obj[k] = v.value; });
    return obj;
  }

  private load() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
      Object.entries(data).forEach(([k, v]) => this.store.set(k, v));
    } catch {}
  }

  private save() {
    try {
      const obj: Record<string, any> = {};
      this.store.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch {}
  }
}

// ============================================================
// LIVE AGENT ENGINE
// ============================================================

export class LiveAgent {
  private config: LiveAgentConfig;
  private ai: GoogleGenAI | null = null;
  private session: any = null;
  private mediaStream: MediaStream | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private proactiveTimer: ReturnType<typeof setInterval> | null = null;
  private memory: MemoryStore | null = null;
  private audioCtx: AudioContext | null = null;
  private proactiveInterval: number;

  state: LiveAgentState = {
    status: "disconnected",
    listening: false,
    lastSpeech: "",
    lastAction: "",
    lastResponse: "",
    error: null,
    proactiveAlert: null,
    memoryCount: 0,
  };

  constructor(config: LiveAgentConfig) {
    this.config = config;
    this.proactiveInterval = config.proactiveInterval || 60000;
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  setContext(ctx: SupabaseContext) {
    this.config.context = ctx;
    this.memory = new MemoryStore(ctx.tenantId);
    this.update({ memoryCount: this.memory.all() ? Object.keys(this.memory.all()).length : 0 });
  }

  private update(partial: Partial<LiveAgentState>) {
    this.state = { ...this.state, ...partial };
    this.config.onState(this.state);
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  async start() {
    if (!this.config.context) {
      this.update({ status: "error", error: "Contexto Supabase não configurado" });
      return;
    }
    if (!this.memory) {
      this.memory = new MemoryStore(this.config.context.tenantId);
    }

    if (this.reconnectAttempts > 5) {
      this.update({ status: "error", error: "Falha ao conectar após várias tentativas. Recarregue a página." });
      return;
    }

    this.update({ status: "connecting" });

    try {
      if (!this.mediaStream) {
        await this.openMicrophone();
      }
      await this.connectLive();
      this.startProactiveMonitoring();
    } catch (err: any) {
      console.error("[EBD] Start error:", err);
      this.update({ status: "error", error: err.message });
      this.scheduleReconnect();
    }
  }

  stop() {
    this.clearTimers();
    this.session?.close?.();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.stopProactiveMonitoring();
    this.audioCtx?.close();
    this.audioCtx = null;
    this.update({ status: "disconnected", listening: false });
  }

  private clearTimers() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  // ============================================================
  // MICROPHONE
  // ============================================================

  private async openMicrophone() {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  // ============================================================
  // LIVE CONNECTION
  // ============================================================

  private async connectLive() {
    if (!this.ai) throw new Error("AI not initialized");

    // Inject memory context into system instruction
    const memoryContext = this.memory ? this.buildMemoryPrompt() : "";
    const fullSystemPrompt = SYSTEM_INSTRUCTION + memoryContext;

    this.session = await this.ai.live.connect({
      model: "gemini-live-2.5-flash-preview",
      config: {
        systemInstruction: fullSystemPrompt,
        tools: TOOLS as any,
        responseModalities: ["AUDIO"] as any,
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
          topP: 0.95,
        },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {},
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      } as any,
      callbacks: {
        onopen: () => {
          console.log("[EBD] Connected");
          this.reconnectAttempts = 0;
          this.update({ status: "connected", listening: true, error: null });
          this.startStreamingAudio();
        },
        onmessage: (e: any) => {
          this.handleServerMessage(e);
        },
        onerror: (e: any) => {
          console.error("[EBD] Socket error:", e);
        },
        onclose: () => {
          console.log("[EBD] Connection closed");
          this.update({ status: "disconnected", listening: false });
          this.scheduleReconnect();
        },
      },
    });
  }

  private scheduleReconnect() {
    this.clearTimers();
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`[EBD] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.start(), delay);
  }

  // ============================================================
  // AUDIO STREAMING
  // ============================================================

  private startStreamingAudio() {
    if (!this.mediaStream || !this.session) return;

    let mimeType = "audio/webm;codecs=opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "audio/webm";
    }

    const mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.session && this.state.status === "connected") {
        try {
          this.session.sendRealtimeInput({ media: event.data });
        } catch {}
      }
    };

    mediaRecorder.start(100);
  }

  // ============================================================
  // SERVER MESSAGE HANDLER
  // ============================================================

  private handleServerMessage(msg: any) {
    // Tool calls from Gemini
    if (msg.toolCall) {
      const calls = msg.toolCall.functionCalls || [];
      if (calls.length > 0) {
        this.executeToolCalls(calls);
      }
      return;
    }

    // Server content: text + audio
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.text) {
          this.update({ lastResponse: part.text });
          this.memory?.remember("last_response", part.text);
        }
        // Play inline audio from Gemini
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("audio/")) {
          this.playAudioChunk(part.inlineData.data);
        }
      }
    }
  }

  private async playAudioChunk(base64: string) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext({ sampleRate: 24000 });
      }
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);
      source.start(0);
    } catch {
      // Audio decode might fail for streaming chunks — ignore gracefully
    }
  }

  // ============================================================
  // TOOL EXECUTION WITH ZOD VALIDATION
  // ============================================================

  private async executeToolCalls(functionCalls: any[]) {
    const ctx = this.config.context;
    if (!ctx || !this.session) return;

    const toolResponses: any[] = [];

    for (const call of functionCalls) {
      const name = call.name;
      const rawArgs = call.args || {};
      let result: any;

      try {
        const validated = this.validateAndExecute(name, rawArgs, ctx);
        result = await validated;
        this.update({ lastAction: name });
        this.memory?.remember(`last_${name}`, { args: rawArgs, result, time: Date.now() });
      } catch (err: any) {
        result = { error: true, message: err.message };
        console.error(`[EBD] Tool ${name} error:`, err);
      }

      toolResponses.push({
        name,
        response: { result },
      });
    }

    // Send responses back to Gemini so it can speak the result
    if (toolResponses.length > 0) {
      for (const tr of toolResponses) {
        this.session.sendClientContent({
          turns: [{ role: "user", parts: [{ functionResponse: tr }] }],
          turnComplete: true,
        });
      }
    }
  }

  private async validateAndExecute(name: string, args: Record<string, any>, ctx: SupabaseContext): Promise<any> {
    switch (name) {
      case "inventory_query": {
        const p = InventoryQuerySchema.parse(args);
        const all = await ctx.insumosGetAll(ctx.tenantId);
        if (p.item_name) {
          const found = all.find((i: any) => i.name.toLowerCase().includes(p.item_name!.toLowerCase()));
          if (!found) return { message: `Insumo "${p.item_name}" não encontrado.` };
          return {
            name: found.name, currentStock: found.currentStock, unit: found.unit,
            minStock: found.minStock, unitCost: found.unitCost,
            totalValue: Math.round(found.unitCost * found.currentStock * 100) / 100,
            supplier: found.supplier,
            isLow: found.currentStock <= found.minStock,
            isCritical: found.currentStock <= found.minStock * 0.5,
          };
        }
        const low = all.filter((i: any) => i.currentStock <= i.minStock);
        return {
          total: all.length,
          lowStockCount: low.length,
          totalValue: Math.round(all.reduce((s: number, i: any) => s + i.unitCost * i.currentStock, 0) * 100) / 100,
          items: all.map((i: any) => ({ name: i.name, stock: i.currentStock, unit: i.unit, low: i.currentStock <= i.minStock })),
        };
      }

      case "inventory_register": {
        const p = InventoryRegisterSchema.parse(args);
        const existing = await ctx.insumosFindByName(p.name, ctx.tenantId);
        if (existing) return { error: true, message: `Insumo "${p.name}" já existe.` };

        const saved = await ctx.insumosCreate({
          tenantId: ctx.tenantId,
          code: `INS-${Date.now().toString(36).toUpperCase()}`,
          name: p.name,
          category: p.category || "Geral",
          unit: p.unit,
          currentStock: p.quantity,
          minStock: p.minStock ?? Math.max(1, Math.floor(p.quantity * 0.2)),
          unitCost: p.unitCost || 0,
          supplier: p.supplier || "",
          lastUpdated: new Date().toISOString().split("T")[0],
        });
        return { success: true, name: saved.name, stock: p.quantity, unit: p.unit, cost: p.unitCost };
      }

      case "inventory_add": {
        const p = InventoryAddSchema.parse(args);
        const item = await ctx.insumosFindByName(p.item_name, ctx.tenantId);
        if (!item) return { error: true, message: `Insumo "${p.item_name}" não encontrado.` };
        const qty = p.quantity;
        const newStock = item.currentStock + qty;
        await ctx.insumosUpdate(item.id, { ...item, currentStock: newStock, lastUpdated: new Date().toISOString().split("T")[0] });
        const isLow = newStock <= item.minStock;
        return { success: true, name: item.name, added: qty, newStock, unit: item.unit, isLow };
      }

      case "inventory_remove": {
        const p = InventoryRemoveSchema.parse(args);
        const item = await ctx.insumosFindByName(p.item_name, ctx.tenantId);
        if (!item) return { error: true, message: `Insumo "${p.item_name}" não encontrado.` };
        const qty = p.quantity;
        const newStock = Math.max(0, item.currentStock - qty);
        await ctx.insumosUpdate(item.id, { ...item, currentStock: newStock, lastUpdated: new Date().toISOString().split("T")[0] });
        const isEmpty = newStock <= 0;
        const isLow = !isEmpty && newStock <= item.minStock;
        return { success: true, name: item.name, removed: qty, newStock, unit: item.unit, isEmpty, isLow };
      }

      case "inventory_alert": {
        InventoryQuerySchema.parse(args); // empty schema validation
        const all = await ctx.insumosGetAll(ctx.tenantId);
        const empty = all.filter((i: any) => i.currentStock <= 0);
        const critical = all.filter((i: any) => i.currentStock > 0 && i.currentStock <= i.minStock * 0.5);
        const low = all.filter((i: any) => i.currentStock > i.minStock * 0.5 && i.currentStock <= i.minStock);
        return {
          ok: empty.length === 0 && critical.length === 0 && low.length === 0,
          empty: empty.map((i: any) => i.name),
          critical: critical.map((i: any) => ({ name: i.name, stock: i.currentStock, min: i.minStock })),
          low: low.map((i: any) => ({ name: i.name, stock: i.currentStock, min: i.minStock })),
        };
      }

      case "report_summary": {
        const p = ReportSummarySchema.parse(args);
        const insumos = await ctx.insumosGetAll(ctx.tenantId);
        const products = await ctx.productsGetAll(ctx.tenantId);
        const totalStockValue = insumos.reduce((s: number, i: any) => s + i.unitCost * i.currentStock, 0);
        const lowCount = insumos.filter((i: any) => i.currentStock <= i.minStock).length;
        const criticalCount = insumos.filter((i: any) => i.currentStock > 0 && i.currentStock <= i.minStock * 0.5).length;
        const emptyCount = insumos.filter((i: any) => i.currentStock <= 0).length;
        return {
          insumos: insumos.length, produtos: products.length,
          valorEstoque: Math.round(totalStockValue * 100) / 100,
          alertas: lowCount + criticalCount + emptyCount,
          criticos: criticalCount, zerados: emptyCount,
        };
      }

      case "product_create": {
        const p = ProductCreateSchema.parse(args);
        const saved = await ctx.productsCreate({
          tenantId: ctx.tenantId,
          name: p.name,
          category: p.category || "Geral",
          sku: `SKU-${Date.now().toString(36).toUpperCase()}`,
          stockQuantity: 0,
          oldPrice: p.price,
          saleDiscountPercent: 0,
          newPrice: p.price,
          itemsSold: 0,
          status: "In Stock",
        });
        return { success: true, name: saved.name, price: p.price };
      }

      default:
        return { error: true, message: `Ferramenta desconhecida: ${name}` };
    }
  }

  // ============================================================
  // PROACTIVE MONITORING
  // ============================================================

  private startProactiveMonitoring() {
    this.stopProactiveMonitoring();
    this.proactiveTimer = setInterval(() => this.proactiveCheck(), this.proactiveInterval);
  }

  private stopProactiveMonitoring() {
    if (this.proactiveTimer) { clearInterval(this.proactiveTimer); this.proactiveTimer = null; }
  }

  private async proactiveCheck() {
    const ctx = this.config.context;
    if (!ctx) return;

    try {
      const insumos = await ctx.insumosGetAll(ctx.tenantId);
      const empty = insumos.filter((i: any) => i.currentStock <= 0);
      const critical = insumos.filter((i: any) => i.currentStock > 0 && i.currentStock <= i.minStock * 0.5);

      if (empty.length > 0 || critical.length > 0) {
        const alert = empty.length > 0
          ? `${empty.length} insumos zerados: ${empty.map((i: any) => i.name).join(", ")}`
          : `${critical.length} insumos críticos: ${critical.map((i: any) => i.name).join(", ")}`;
        this.update({ proactiveAlert: alert });
        // Also speak the alert
        if (this.state.status === "connected" && this.session) {
          this.session.sendClientContent({
            turns: [{
              role: "user",
              parts: [{ text: `ALERTA PROATIVO: ${alert}. Avise o chefe sobre isso na próxima interação ou imediatamente se for urgente.` }],
            }],
            turnComplete: true,
          });
        }
      } else {
        this.update({ proactiveAlert: null });
      }
    } catch {}
  }

  // ============================================================
  // TEXT INPUT (fallback)
  // ============================================================

  async sendText(text: string) {
    if (this.state.status === "connected" && this.session) {
      this.update({ lastSpeech: text });
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      });
      return;
    }

    // Offline fallback
    const intent = offlineParse(text);
    if (intent.tool === "unknown" || intent.confidence < 0.5) {
      const msg = "Desculpe, não entendi. Tente: cadastrar insumo, adicionar estoque, resumo, ou alertas.";
      this.update({ lastResponse: msg });
      this.ttsSpeak(msg);
      return;
    }

    try {
      const ctx = this.config.context;
      if (!ctx) return;
      const result = await this.validateAndExecute(intent.tool, intent.args, ctx);
      const msg = typeof result === "string" ? result : JSON.stringify(result);
      this.update({ lastAction: intent.tool, lastResponse: msg });
      this.memory?.remember(`last_${intent.tool}`, { args: intent.args, result, time: Date.now() });
      this.ttsSpeak(msg);
    } catch (err: any) {
      const msg = `Erro: ${err.message}`;
      this.update({ lastResponse: msg });
      this.ttsSpeak(msg);
    }
  }

  private ttsSpeak(text: string) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  private buildMemoryPrompt(): string {
    if (!this.memory) return "";
    const recent = this.memory.getRecent(3);
    if (recent.length === 0) return "";

    let prompt = "\n\n## MEMÓRIA DE SESSÕES ANTERIORES\n";
    for (const entry of recent) {
      prompt += `- ${entry.key}: ${JSON.stringify(entry.value).slice(0, 120)}\n`;
    }
    prompt += "\nUse esse histórico para ser mais contextual e proativo. Se o chefe já falou de algo antes, faça referência.";
    return prompt;
  }
}

// ============================================================
// FACTORY — Universal drop-in
// ============================================================

export function createLiveAgent(config: LiveAgentConfig): LiveAgent {
  return new LiveAgent(config);
}
