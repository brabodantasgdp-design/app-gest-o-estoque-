// ============================================================
// EBD AI - Core Engine
// Handles chat, API communication, function calling
// ============================================================

import { EbdAiConfig, ChatMessage, ChatResponse, FunctionCall } from './index';

export class EbdAiCore {
  private config: EbdAiConfig;

  constructor(config: EbdAiConfig) {
    this.config = config;
  }

  async chat(message: string, history: ChatMessage[]): Promise<ChatResponse> {
    try {
      const response = await fetch(this.config.apiUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          companyId: this.config.companyId,
          language: this.config.language,
          personality: this.config.personality,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: data.success,
        response: data.response,
        reasoning: data.reasoning,
        functionCalls: data.functionCalls || [],
        source: data.source || 'local',
      };

    } catch (error) {
      console.error('EBD AI Core Error:', error);
      
      // Fallback to local processing
      return this.localChat(message);
    }
  }

  private localChat(message: string): ChatResponse {
    const lower = message.toLowerCase();
    let response = '';

    // Basic intent matching
    if (lower.includes('olá') || lower.includes('oi') || lower.includes('bom dia')) {
      response = this.getGreeting();
    } else if (lower.includes('ajuda') || lower.includes('help')) {
      response = this.getHelp();
    } else if (lower.includes('estoque') || lower.includes('insumo')) {
      response = '📦 Acesse o módulo de Insumos para ver o estoque completo.';
    } else if (lower.includes('venda') || lower.includes('faturamento')) {
      response = '💰 Acesse o módulo de Pedidos para ver as vendas.';
    } else if (lower.includes('produto')) {
      response = '🏷️ Acesse o módulo de Produtos para gerenciar.';
    } else {
      response = `Entendi: "${message}"\n\nPosso ajudar com estoque, produtos, pedidos e relatórios. O que deseja?`;
    }

    return {
      success: true,
      response,
      source: 'local',
    };
  }

  private getGreeting(): string {
    const hour = new Date().getHours();
    const greetings = {
      pt: {
        morning: 'Bom dia',
        afternoon: 'Boa tarde',
        evening: 'Boa noite',
      },
      en: {
        morning: 'Good morning',
        afternoon: 'Good afternoon',
        evening: 'Good evening',
      },
      es: {
        morning: 'Buenos días',
        afternoon: 'Buenas tardes',
        evening: 'Buenas noches',
      },
    };

    const lang = this.config.language?.split('-')[0] || 'pt';
    const langGreetings = greetings[lang as keyof typeof greetings] || greetings.pt;
    
    let timeGreeting = '';
    if (hour < 12) timeGreeting = langGreetings.morning;
    else if (hour < 18) timeGreeting = langGreetings.afternoon;
    else timeGreeting = langGreetings.evening;

    return `${timeGreeting}! 👋 Sou a EBD AI. Como posso ajudar?`;
  }

  private getHelp(): string {
    const lang = this.config.language?.split('-')[0] || 'pt';
    
    const helpTexts: Record<string, string> = {
      pt: `🧠 EBD AI - Comandos:

📦 ESTOQUE: "Quanto tenho de X?", "Estoque baixo"
🏷️ PRODUTOS: "Quanto custa X?", "Criar produto"
🛒 PEDIDOS: "Criar pedido para Maria X 2"
📊 RELATÓRIOS: "Resumo", "Relatório de vendas"
⏰ AGENDAMENTOS: "Me avise quando estoque chegar em X"
🔮 PREVISÕES: "Quando vai acabar o estoque?"
⚙️ WORKFLOWS: "Quando vender X, baixar Y"

💡 Use linguagem natural!`,
      
      en: `🧠 EBD AI - Commands:

📦 STOCK: "How much X do I have?", "Low stock"
🏷️ PRODUCTS: "How much is X?", "Create product"
🛒 ORDERS: "Create order for Maria X 2"
📊 REPORTS: "Summary", "Sales report"
⏰ ALERTS: "Notify when stock reaches X"
🔮 PREDICTIONS: "When will stock run out?"
⚙️ WORKFLOWS: "When sell X, deduct Y"

💡 Use natural language!`,
      
      es: `🧠 EBD AI - Comandos:

📦 ESTADO: "Cuánto tengo de X?", "Stock bajo"
🏷️ PRODUCTOS: "Cuánto cuesta X?", "Crear producto"
🛒 PEDIDOS: "Crear pedido para María X 2"
📊 INFORMES: "Resumen", "Informe de ventas"
⏰ ALERTAS: "Avisar cuando stock llegue a X"
🔮 PREDICCIONES: "Cuándo se acabará el stock?"
⚙️ FLUJOS: "Cuando vender X, descontar Y"

💡 ¡Use lenguaje natural!`,
    };

    return helpTexts[lang] || helpTexts.pt;
  }
}
