import { GoogleGenAI, Type } from '@google/genai';
import { ebdAi } from './jarvisCore';

// ============================================================
// GEMINI INTEGRATION SERVICE (Client-Side)
// ============================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface GeminiResponse {
  success: boolean;
  response: string;
  functionCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  source: 'gemini_ai' | 'local_ebdAi';
  model?: string;
  timestamp: string;
}

interface VoiceResponse {
  success: boolean;
  action: string;
  params?: Record<string, any>;
  message: string;
  source: 'gemini_voice' | 'local_voice';
  timestamp: string;
}

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

function getAI(): GoogleGenAI | null {
  if (!GEMINI_KEY) return null;
  return new GoogleGenAI({ apiKey: GEMINI_KEY });
}

class GeminiService {
  private static instance: GeminiService;
  private conversationHistory: ChatMessage[] = [];
  private companyId: string = 'default';
  private isGeminiAvailable: boolean | null = null;
  private storageKey = 'ebdAi_gemini_history';

  private constructor() {
    this.loadHistory();
    this.isGeminiAvailable = !!GEMINI_KEY;
  }

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  setCompanyId(id: string): void {
    this.companyId = id;
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.conversationHistory = stored ? JSON.parse(stored) : [];
    } catch {
      this.conversationHistory = [];
    }
  }

  private saveHistory(): void {
    try {
      const trimmed = this.conversationHistory.slice(-50);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch {}
  }

  clearHistory(): void {
    this.conversationHistory = [];
    localStorage.removeItem(this.storageKey);
  }

  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  // ============================================================
  // CHAT WITH GEMINI (direct from browser)
  // ============================================================

  async chat(message: string): Promise<GeminiResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    const ai = getAI();
    if (!ai) {
      return this.localChat(message);
    }

    try {
      const systemInstruction = `Você é a EBD AI, inteligência artificial do sistema de gestão varejista.

## PERSONALIDADE
- Tom: Direto, profissional, conciso, em português do Brasil
- Leal ao operador (Brabo Dantas)

## FERRAMENTAS DISPONÍVEIS
- query_stock: Consultar estoque
- create_product: Criar produto
- create_order: Criar pedido
- get_analytics: Relatórios

## FORMATO
- Ultra-concisa (máximo 3-4 linhas)
- Dados numéricos precisos
- Emojis: ✅ sucesso, ⚠️ alerta, ❌ erro

Empresa ID: ${this.companyId}`;

      const geminiTools = [
        {
          name: "query_stock",
          description: "Consulta o estoque de um insumo",
          parameters: {
            type: Type.OBJECT,
            properties: {
              item_name: { type: Type.STRING, description: "Nome do insumo" },
            },
            required: ["item_name"],
          },
        },
        {
          name: "create_product",
          description: "Cria um produto",
          parameters: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nome do produto" },
              price: { type: Type.NUMBER, description: "Preço de venda" },
            },
            required: ["name", "price"],
          },
        },
        {
          name: "create_order",
          description: "Cria um pedido",
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer: { type: Type.STRING, description: "Nome do cliente" },
              product: { type: Type.STRING, description: "Produto" },
              quantity: { type: Type.NUMBER, description: "Quantidade" },
            },
            required: ["customer", "product"],
          },
        },
      ];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: this.conversationHistory.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction,
          tools: geminiTools,
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const responseText = response.text || "Desculpe, não consegui processar.";
      const functionCalls = response.functionCalls;

      this.conversationHistory.push({
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
      });
      this.saveHistory();

      ebdAi.remember(message, responseText, 'success');
      ebdAi.addTurn('user', message);
      ebdAi.addTurn('ebdAi', responseText);

      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          await this.executeFunctionCall(fc.name, fc.args);
        }
      }

      return {
        success: true,
        response: responseText,
        functionCalls: functionCalls || [],
        source: 'gemini_ai',
        model: 'gemini-2.5-flash',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Gemini chat error:', error);
      return this.localChat(message);
    }
  }

  private localChat(message: string): GeminiResponse {
    const lower = message.toLowerCase();
    let response = '';

    if (lower.includes('olá') || lower.includes('oi') || lower.includes('bom dia')) {
      response = ebdAi.getContextualGreeting();
    } else if (lower.includes('estoque') || lower.includes('insumo')) {
      const summary = ebdAi.calculateFinancialSummary();
      response = `📊 Resumo do Estoque:\n• Total de itens: ${ebdAi.getState().insumos.length}\n• Valor total: R$ ${summary.totalStockValue.toFixed(2)}`;
    } else if (lower.includes('venda') || lower.includes('faturamento')) {
      const summary = ebdAi.calculateFinancialSummary();
      response = `💰 Resumo de Vendas:\n• Total de pedidos: ${ebdAi.getState().orders.length}\n• Faturamento: R$ ${summary.totalRevenue.toFixed(2)}`;
    } else if (lower.includes('ajuda') || lower.includes('help')) {
      response = `🧠 EBD AI - Comandos:\n📦 ESTOQUE: "Quanto tenho de X?"\n🏷️ PRODUTOS: "Quanto custa X?"\n🛒 PEDIDOS: "Criar pedido para Maria X 2"\n📊 RELATÓRIOS: "Resumo"`;
    } else {
      response = `Entendi: "${message}"\n\nSou a EBD AI. Posso ajudar com estoque, produtos, pedidos e relatórios.`;
    }

    this.conversationHistory.push({ role: 'assistant', content: response, timestamp: Date.now() });
    this.saveHistory();

    return { success: true, response, source: 'local_ebdAi', timestamp: new Date().toISOString() };
  }

  // ============================================================
  // VOICE COMMANDS (direct from browser)
  // ============================================================

  async processVoiceCommand(command: string, context?: Record<string, any>): Promise<VoiceResponse> {
    const ai = getAI();
    if (!ai) {
      return this.localVoiceCommand(command);
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: 'user', parts: [{ text: `Comando: "${command}"\nEmpresa: ${this.companyId}` }] }],
        config: {
          systemInstruction: `Você é a EBD AI processando comandos de voz.
Retorne JSON com: action (query_stock, add_stock, create_product, create_order, navigate, chat), params, response, success.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING },
              params: { type: Type.OBJECT },
              response: { type: Type.STRING },
              success: { type: Type.BOOLEAN },
            },
            required: ["action", "response", "success"],
          },
        },
      });

      const text = response.text || '{"action":"chat","response":"Não processado","success":false}';
      const result = JSON.parse(text);

      ebdAi.remember(command, result.response, result.success ? 'success' : 'error');

      return {
        success: result.success,
        action: result.action,
        params: result.params || {},
        message: result.response,
        source: 'gemini_voice',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.localVoiceCommand(command);
    }
  }

  private localVoiceCommand(command: string): VoiceResponse {
    const lower = command.toLowerCase();
    const ts = new Date().toISOString();

    if (lower.includes('quanto tenho') || lower.includes('estoque')) {
      return { success: true, action: 'query_stock', message: 'Consultando estoque...', source: 'local_voice', timestamp: ts };
    } else if (lower.includes('criar produto')) {
      return { success: true, action: 'create_product', message: 'Abrindo formulário...', source: 'local_voice', timestamp: ts };
    } else if (lower.includes('criar pedido')) {
      return { success: true, action: 'create_order', message: 'Abrindo formulário...', source: 'local_voice', timestamp: ts };
    } else if (lower.includes('resumo') || lower.includes('dashboard')) {
      return { success: true, action: 'navigate', message: 'Navegando para dashboard...', params: { module: 'dashboard' }, source: 'local_voice', timestamp: ts };
    }
    return { success: true, action: 'chat', message: `Processando: "${command}"`, source: 'local_voice', timestamp: ts };
  }

  // ============================================================
  // OCR INVOICE (direct from browser)
  // ============================================================

  async processOCR(base64Data: string, mimeType: string = 'image/jpeg'): Promise<any> {
    const ai = getAI();
    if (!ai) {
      return this.getMockOCR();
    }

    const systemInstruction = `
Você é um especialista em OCR de Notas Fiscais Eletrônicas (NF-e) para varejo.
Extraia COM PRECISÃO TODOS os dados da nota fiscal.

CAMPOS OBRIGATÓRIOS:
1. supplierName - Nome/Razão Social do Fornecedor
2. cnpj - CNPJ (formato: XX.XXX.XXX/XXXX-XX)
3. invoiceNumber - Número da NF
4. invoiceDate - Data (YYYY-MM-DD)
5. totalAmount - Valor total (number)
6. category: 'alimentacao', 'transporte', 'servicos', 'insumos', 'impostos', 'outros'
7. notes - Observações resumidas

ITENS DA NOTA (extrair TODOS):
Para CADA item: rawName, matchedInsumoName, quantity (convertido para g/ml/un), unit, unitCost, totalCost, category

REGRAS: 1kg=1000g, 1L=1000ml, unitCost = totalCost/quantity
Retorne JSON válido.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: "Analise esta Nota Fiscal. Extraia TODOS os dados e itens. Retorne JSON." },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplierName: { type: Type.STRING },
              cnpj: { type: Type.STRING },
              invoiceNumber: { type: Type.STRING },
              invoiceDate: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              notes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rawName: { type: Type.STRING },
                    matchedInsumoName: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    unitCost: { type: Type.NUMBER },
                    totalCost: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                  },
                  required: ["rawName", "matchedInsumoName", "quantity", "unit", "unitCost", "totalCost"],
                },
              },
            },
            required: ["supplierName", "invoiceNumber", "totalAmount", "items"],
          },
        },
      });

      const text = response.text || '{}';
      return JSON.parse(text);
    } catch (error) {
      console.error('OCR Gemini error:', error);
      return this.getMockOCR();
    }
  }

  private getMockOCR() {
    return {
      supplierName: "Distribuidora Exemplo",
      cnpj: "12.345.678/0001-90",
      invoiceNumber: `NF-${Math.floor(10000 + Math.random() * 90000)}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      totalAmount: 0,
      category: "insumos",
      notes: "OCR não disponível offline",
      items: [],
    };
  }

  // ============================================================
  // FUNCTION CALL EXECUTION
  // ============================================================

  private async executeFunctionCall(name: string, args: Record<string, any>): Promise<void> {
    ebdAi.setLastAction(`gemini_${name}`);
    ebdAi.trackCommand(`gemini_${name}`);
  }

  // ============================================================
  // STATUS
  // ============================================================

  isUsingGemini(): boolean {
    return this.isGeminiAvailable === true;
  }

  getStatus() {
    return {
      geminiAvailable: this.isGeminiAvailable,
      historyLength: this.conversationHistory.length,
      companyId: this.companyId,
    };
  }
}

export const geminiService = GeminiService.getInstance();
export type { ChatMessage, GeminiResponse, VoiceResponse };
