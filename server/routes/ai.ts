import { Router, Request, Response } from "express";
import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const geminiTools = [
  {
    name: "query_stock",
    description: "Consulta o estoque de um insumo específico",
    parameters: {
      type: Type.OBJECT,
      properties: { item_name: { type: Type.STRING, description: "Nome do insumo" } },
      required: ["item_name"],
    },
  },
  {
    name: "add_stock",
    description: "Adiciona quantidade ao estoque de um insumo",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_name: { type: Type.STRING, description: "Nome do insumo" },
        quantity: { type: Type.NUMBER, description: "Quantidade a adicionar" },
        unit: { type: Type.STRING, description: "Unidade (kg, g, L, un)" },
      },
      required: ["item_name", "quantity"],
    },
  },
  {
    name: "create_product",
    description: "Cria um novo produto no sistema",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Nome do produto" },
        price: { type: Type.NUMBER, description: "Preço de venda" },
        cost: { type: Type.NUMBER, description: "Custo do produto" },
      },
      required: ["name", "price"],
    },
  },
  {
    name: "create_order",
    description: "Cria um novo pedido",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customer: { type: Type.STRING, description: "Nome do cliente" },
        product: { type: Type.STRING, description: "Produto solicitado" },
        quantity: { type: Type.NUMBER, description: "Quantidade" },
      },
      required: ["customer", "product"],
    },
  },
  {
    name: "get_analytics",
    description: "Obtém análises e relatórios do negócio",
    parameters: {
      type: Type.OBJECT,
      properties: { type: { type: Type.STRING, description: "Tipo: stock, sales, profit, summary" } },
    },
  },
];

function getSystemContext(companyId?: string) {
  return `Você é a EBD AI, a inteligência artificial de alta performance do sistema RetailPro/EBD.

## PERSONALIDADE
- Tom: Direto, profissional, sofisticado, conciso
- Sempre em português do Brasil
- Sem rodeios, assertiva, precisa
- Leal ao operador (Brabo Dantas)

## PROTOCOLO DE RACIOCÍNIO
Antes de responder, siga estas etapas:
1. ANÁLISE: Entenda exatamente o que o operador está pedindo
2. VERIFICAÇÃO: Use ferramentas para verificar dados reais no sistema
3. CÁLCULO: Calcule margens, custos, estoque considerando dados reais
4. EXECUÇÃO: Se aplicável, execute a ação solicitada
5. CONFIRMAÇÃO: Confirme o que foi feito com dados precisos

## DADOS DA EMPRESA
Empresa ID: ${companyId || 'default'}

## FORMA DE RESPOSTA
- Ultra-concisa (máximo 3-4 linhas quando possível)
- Dados numéricos precisos
- Emojis para status (✅ sucesso, ⚠️ alerta, ❌ erro)
- Se executou uma ação, confirme o resultado`;
}

function localChatResponse(message: string) {
  const lower = message.toLowerCase();
  let response = '';
  let reasoning = '';

  if (lower.includes('estoque') || lower.includes('insumo')) {
    reasoning = `ANÁLISE: Operador quer consultar estoque.`;
    response = `📊 Consulta de Estoque:\n\nPara ver o estoque completo, acesse o módulo de Insumos.\n\nComandos:\n• "Quanto tenho de [nome]"\n• "Estoque baixo"\n• "Custo de estoque"`;
  } else if (lower.includes('venda') || lower.includes('faturamento')) {
    reasoning = `ANÁLISE: Operador quer relatório de vendas.`;
    response = `💰 Relatório de Vendas:\n\nAcesse o módulo de Pedidos.\n\nComandos:\n• "Resumo"\n• "Relatório de vendas"\n• "Ticket médio"`;
  } else if (lower.includes('criar') || lower.includes('novo')) {
    reasoning = `ANÁLISE: Operador quer criar algo.`;
    if (lower.includes('produto')) {
      response = `🏷️ Criar Produto:\n\nDigite:\n• "Criar produto [nome] por R$[preço]"`;
    } else if (lower.includes('pedido')) {
      response = `🛒 Criar Pedido:\n\nDigite:\n• "Pedido para [cliente] [produto] [qtd]"`;
    } else {
      response = `📝 Criar Item:\n\nO que deseja criar? Produto, Pedido ou Insumo?`;
    }
  } else if (lower.includes('ajuda') || lower.includes('help') || lower.includes('comando')) {
    reasoning = `ANÁLISE: Operador pediu ajuda.`;
    response = `🧠 EBD AI - Comandos:\n\n📦 ESTOQUE: consultar, adicionar, remover\n🏷️ PRODUTOS: preços, criar, análise\n🛒 PEDIDOS: criar, gerenciar\n📊 RELATÓRIOS: resumo, vendas, top\n\n💡 Use linguagem natural!`;
  } else {
    reasoning = `ANÁLISE: Comando genérico.`;
    response = `Entendi: "${message}"\n\nSou a EBD AI. Posso ajudar com:\n📦 Estoque | 🏷️ Produtos | 🛒 Pedidos | 📊 Relatórios\n\nDigite "ajuda" para ver todos os comandos.`;
  }

  return { response, reasoning };
}

export function aiRoutes(): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    try {
      const { messages, companyId } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      const apiKey = GEMINI_API_KEY;

      if (!apiKey) {
        console.warn("GEMINI_API_KEY missing, using local EBD AI processing");
        const lastMessage = messages[messages.length - 1]?.content || '';
        const { response, reasoning } = localChatResponse(lastMessage);

        return res.json({
          success: true, response, reasoning,
          source: 'local_ebdAi', timestamp: new Date().toISOString(),
        });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction: getSystemContext(companyId),
          tools: geminiTools as any,
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const responseText = response.text || "Desculpe, não consegui processar sua solicitação.";
      const functionCalls = response.functionCalls;

      return res.json({
        success: true, response: responseText,
        functionCalls: functionCalls || [],
        source: 'gemini_ai', model: 'gemini-1.5-flash',
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error("EBD AI API Error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to process EBD AI request",
        response: "Desculpe, ocorreu um erro ao processar sua solicitação.",
      });
    }
  });

  router.post("/voice", async (req: Request, res: Response) => {
    try {
      const { command, companyId, context } = req.body;

      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }

      const apiKey = GEMINI_API_KEY;

      const fullContext = `Comando de voz recebido: "${command}"
Empresa ID: ${companyId || 'default'}
Contexto do sistema: ${JSON.stringify(context || {})}`;

      if (!apiKey) {
        const lower = command.toLowerCase();
        let result = { success: false, action: '', message: '', data: null as any };

        if (lower.includes('quanto tenho') || lower.includes('estoque de')) {
          const itemMatch = lower.match(/(?:de|do|da)\s+(.+?)[\?\s]*$/);
          const itemName = itemMatch ? itemMatch[1].trim() : '';
          result = { success: true, action: 'query_stock', message: `Consultando estoque de ${itemName || 'itens'}...`, data: { itemName } };
        } else if (lower.includes('criar produto')) {
          result = { success: true, action: 'create_product', message: 'Abrindo formulário de criação de produto...', data: null };
        } else if (lower.includes('criar pedido')) {
          result = { success: true, action: 'create_order', message: 'Abrindo formulário de novo pedido...', data: null };
        } else if (lower.includes('resumo') || lower.includes('dashboard')) {
          result = { success: true, action: 'navigate', message: 'Navegando para o dashboard...', data: { module: 'dashboard' } };
        } else {
          result = { success: true, action: 'chat', message: `Processando comando: "${command}"`, data: null };
        }

        return res.json(result);
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: fullContext }] }],
        config: {
          systemInstruction: `Você é a EBD AI processando comandos de voz.
Analise o comando e retorne JSON com:
- action: ação (query_stock, add_stock, create_product, create_order, navigate, chat)
- params: parâmetros da ação
- response: resposta amigável em português
- success: se o comando é válido`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING }, params: { type: Type.OBJECT },
              response: { type: Type.STRING }, success: { type: Type.BOOLEAN },
            },
            required: ["action", "response", "success"],
          },
        },
      });

      const text = response.text || '{"action":"chat","response":"Não consegui processar","success":false}';
      const result = JSON.parse(text);

      return res.json({
        success: result.success, action: result.action,
        params: result.params || {}, message: result.response,
        source: 'gemini_voice', timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error("EBD AI Voice Error:", error);
      return res.status(500).json({ success: false, action: 'error', message: error.message || "Failed to process voice command" });
    }
  });

  // Proxy endpoint for client-side voice agent (bypass CORS)
  router.post("/agent", async (req: Request, res: Response) => {
    try {
      const { contents, systemInstruction, tools, config: clientConfig } = req.body;

      if (!contents || !Array.isArray(contents)) {
        return res.status(400).json({ error: "contents array is required" });
      }

      const apiKey = GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents,
        config: {
          systemInstruction: systemInstruction || undefined,
          tools: tools || undefined,
          temperature: clientConfig?.temperature ?? 0.7,
          maxOutputTokens: clientConfig?.maxOutputTokens ?? 512,
        },
      });

      const candidates = response.candidates || [];
      const parts = candidates[0]?.content?.parts || [];
      const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join("");
      const functionCalls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

      return res.json({ success: true, text, functionCalls });
    } catch (error: any) {
      console.error("Agent proxy error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
