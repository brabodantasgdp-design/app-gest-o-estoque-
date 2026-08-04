import { jarvis } from './jarvisCore';

// ============================================================
// GEMINI INTEGRATION SERVICE
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
  source: 'gemini_ai' | 'local_jarvis';
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

class GeminiService {
  private static instance: GeminiService;
  private conversationHistory: ChatMessage[] = [];
  private companyId: string = 'default';
  private isGeminiAvailable: boolean | null = null;
  private storageKey = 'jarvis_gemini_history';

  private constructor() {
    this.loadHistory();
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
  // CHAT WITH GEMINI
  // ============================================================

  async chat(message: string): Promise<GeminiResponse> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    try {
      const response = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.conversationHistory.map(m => ({
            role: m.role,
            content: m.content,
          })),
          companyId: this.companyId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      });

      this.saveHistory();
      
      // Track in JARVIS memory
      jarvis.remember(message, data.response, data.success ? 'success' : 'error');
      jarvis.addTurn('user', message);
      jarvis.addTurn('jarvis', data.response);

      // Check if Gemini is available
      this.isGeminiAvailable = data.source === 'gemini_ai';

      // Execute function calls if any
      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const fc of data.functionCalls) {
          await this.executeFunctionCall(fc.name, fc.args);
        }
      }

      return data;

    } catch (error) {
      console.error('Gemini chat error:', error);
      
      // Fallback to local processing
      return this.localChat(message);
    }
  }

  private localChat(message: string): GeminiResponse {
    const lower = message.toLowerCase();
    let response = '';

    // Smart local responses
    if (lower.includes('olá') || lower.includes('oi') || lower.includes('bom dia') || lower.includes('boa tarde') || lower.includes('boa noite')) {
      response = jarvis.getContextualGreeting();
    } else if (lower.includes('estoque') || lower.includes('insumo')) {
      const summary = jarvis.calculateFinancialSummary();
      response = `📊 Resumo do Estoque:\n• Total de itens: ${jarvis.getState().insumos.length}\n• Valor total: R$ ${summary.totalStockValue.toFixed(2)}\n\nPara detalhes, acesse o módulo de Insumos.`;
    } else if (lower.includes('venda') || lower.includes('faturamento')) {
      const summary = jarvis.calculateFinancialSummary();
      response = `💰 Resumo de Vendas:\n• Total de pedidos: ${jarvis.getState().orders.length}\n• Faturamento: R$ ${summary.totalRevenue.toFixed(2)}\n• Ticket médio: R$ ${summary.totalRevenue / Math.max(1, jarvis.getState().orders.length)}.toFixed(2)`;
    } else if (lower.includes('lucro') || lower.includes('margem')) {
      const summary = jarvis.calculateFinancialSummary();
      response = `📈 Análise de Lucro:\n• Margem média: ${summary.averageMargin.toFixed(1)}%\n• Top produto: ${summary.topProducts[0]?.name || 'N/A'}`;
    } else if (lower.includes('ajuda') || lower.includes('help')) {
      response = `🧠 JARVIS - Comandos:

📦 ESTOQUE: "Quanto tenho de X?", "Estoque baixo"
🏷️ PRODUTOS: "Quanto custa X?", "Criar produto"
🛒 PEDIDOS: "Criar pedido para Maria X 2"
📊 RELATÓRIOS: "Resumo", "Relatório de vendas"
💡 DICAS: Fale naturalmente`;
    } else {
      response = `Entendi: "${message}"\n\nSou a JARVIS do RetailPro. Posso ajudar com estoque, produtos, pedidos e relatórios. O que deseja?`;
    }

    const result: GeminiResponse = {
      success: true,
      response,
      source: 'local_jarvis',
      timestamp: new Date().toISOString(),
    };

    // Add to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });
    this.saveHistory();

    return result;
  }

  // ============================================================
  // VOICE COMMANDS
  // ============================================================

  async processVoiceCommand(command: string, context?: Record<string, any>): Promise<VoiceResponse> {
    try {
      const response = await fetch('/api/jarvis/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          companyId: this.companyId,
          context,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: VoiceResponse = await response.json();
      
      // Track in JARVIS memory
      jarvis.remember(command, data.message, data.success ? 'success' : 'error');
      jarvis.addTurn('user', command);
      jarvis.addTurn('jarvis', data.message);

      return data;

    } catch (error) {
      console.error('Voice command error:', error);
      
      // Fallback to local processing
      return this.localVoiceCommand(command);
    }
  }

  private localVoiceCommand(command: string): VoiceResponse {
    const lower = command.toLowerCase();
    
    let result: VoiceResponse = {
      success: false,
      action: 'error',
      message: 'Não consegui processar o comando.',
      source: 'local_voice',
      timestamp: new Date().toISOString(),
    };

    if (lower.includes('quanto tenho') || lower.includes('estoque de')) {
      const itemMatch = lower.match(/(?:de|do|da)\s+(.+?)[\?\s]*$/);
      const itemName = itemMatch ? itemMatch[1].trim() : '';
      result = { 
        success: true, 
        action: 'query_stock', 
        message: `Consultando estoque de ${itemName || 'itens'}...`,
        source: 'local_voice',
        timestamp: new Date().toISOString(),
      };
    } else if (lower.includes('criar produto')) {
      result = { success: true, action: 'create_product', message: 'Abrindo formulário de criação de produto...', source: 'local_voice', timestamp: new Date().toISOString() };
    } else if (lower.includes('criar pedido')) {
      result = { success: true, action: 'create_order', message: 'Abrindo formulário de novo pedido...', source: 'local_voice', timestamp: new Date().toISOString() };
    } else if (lower.includes('resumo') || lower.includes('dashboard')) {
      result = { success: true, action: 'navigate', message: 'Navegando para o dashboard...', params: { module: 'dashboard' }, source: 'local_voice', timestamp: new Date().toISOString() };
    } else if (lower.includes('ajuda')) {
      result = { success: true, action: 'help', message: 'Mostrando ajuda...', source: 'local_voice', timestamp: new Date().toISOString() };
    }

    return result;
  }

  // ============================================================
  // FUNCTION CALL EXECUTION
  // ============================================================

  private async executeFunctionCall(name: string, args: Record<string, any>): Promise<void> {
    // This would integrate with the actual services
    console.log('Executing function call:', name, args);
    
    jarvis.setLastAction(`gemini_${name}`);
    jarvis.trackCommand(`gemini_${name}`);
  }

  // ============================================================
  // STATUS
  // ============================================================

  isUsingGemini(): boolean {
    return this.isGeminiAvailable === true;
  }

  getStatus(): {
    geminiAvailable: boolean | null;
    historyLength: number;
    companyId: string;
  } {
    return {
      geminiAvailable: this.isGeminiAvailable,
      historyLength: this.conversationHistory.length,
      companyId: this.companyId,
    };
  }
}

export const geminiService = GeminiService.getInstance();
export type { ChatMessage, GeminiResponse, VoiceResponse };
