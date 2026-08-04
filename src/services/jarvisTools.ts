import { jarvis } from './jarvisCore';
import { jarvisVoice } from './jarvisVoice';
import { insumosService, productsService, ordersService } from '../lib/database';
import { Insumo, Product, Order } from '../types';

// ============================================================
// JARVIS TOOL CALLING SYSTEM
// ============================================================

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  timestamp: number;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    default?: any;
  }>;
  handler: (args: Record<string, any>, tenantId: string) => Promise<ToolResult>;
}

// ============================================================
// TOOL REGISTRY
// ============================================================

const tools: Record<string, ToolDefinition> = {
  // ============================================================
  // STOCK MANAGEMENT
  // ============================================================
  add_stock: {
    name: 'add_stock',
    description: 'Adicionar item ao estoque',
    parameters: {
      item_name: { type: 'string', description: 'Nome do insumo', required: true },
      quantity: { type: 'number', description: 'Quantidade a adicionar', required: true },
      unit: { type: 'string', description: 'Unidade (kg, g, L, un, cx)', required: false, default: 'un' },
    },
    handler: async (args, tenantId) => {
      const insumos = await insumosService.getAll(tenantId);
      const insumo = insumos.find(i => 
        i.name.toLowerCase().includes(args.item_name.toLowerCase())
      );
      
      if (!insumo) {
        return { success: false, error: 'not_found', message: `Insumo "${args.item_name}" não encontrado` };
      }

      const newStock = insumo.currentStock + args.quantity;
      await insumosService.update(insumo.id, {
        ...insumo,
        currentStock: newStock,
        lastUpdated: new Date().toISOString().split('T')[0],
      });

      jarvis.remember(
        `Adicionar ${args.quantity}${args.unit || 'un'} de ${insumo.name}`,
        `Estoque atualizado: ${insumo.currentStock} → ${newStock} ${insumo.unit}`,
        'success'
      );

      return {
        success: true,
        data: { name: insumo.name, oldStock: insumo.currentStock, newStock },
        message: `${args.quantity}${args.unit || 'un'} de ${insumo.name} adicionado. Estoque: ${newStock} ${insumo.unit}`,
      };
    },
  },

  remove_stock: {
    name: 'remove_stock',
    description: 'Remover item do estoque',
    parameters: {
      item_name: { type: 'string', description: 'Nome do insumo', required: true },
      quantity: { type: 'number', description: 'Quantidade a remover', required: true },
      unit: { type: 'string', description: 'Unidade', required: false, default: 'un' },
    },
    handler: async (args, tenantId) => {
      const insumos = await insumosService.getAll(tenantId);
      const insumo = insumos.find(i => 
        i.name.toLowerCase().includes(args.item_name.toLowerCase())
      );
      
      if (!insumo) {
        return { success: false, error: 'not_found', message: `Insumo "${args.item_name}" não encontrado` };
      }

      const newStock = Math.max(0, insumo.currentStock - args.quantity);
      await insumosService.update(insumo.id, {
        ...insumo,
        currentStock: newStock,
        lastUpdated: new Date().toISOString().split('T')[0],
      });

      const warning = newStock <= insumo.minStock ? ' ⚠️ Estoque abaixo do mínimo!' : '';

      jarvis.remember(
        `Remover ${args.quantity}${args.unit || 'un'} de ${insumo.name}`,
        `Estoque atualizado: ${insumo.currentStock} → ${newStock} ${insumo.unit}${warning}`,
        'success'
      );

      return {
        success: true,
        data: { name: insumo.name, oldStock: insumo.currentStock, newStock, warning },
        message: `${args.quantity}${args.unit || 'un'} de ${insumo.name} removido. Estoque: ${newStock} ${insumo.unit}${warning}`,
      };
    },
  },

  query_stock: {
    name: 'query_stock',
    description: 'Consultar estoque de um item',
    parameters: {
      item_name: { type: 'string', description: 'Nome do insumo', required: true },
    },
    handler: async (args, tenantId) => {
      const insumos = await insumosService.getAll(tenantId);
      const insumo = insumos.find(i => 
        i.name.toLowerCase().includes(args.item_name.toLowerCase())
      );
      
      if (!insumo) {
        return { success: false, error: 'not_found', message: `Insumo "${args.item_name}" não encontrado` };
      }

      const status = insumo.currentStock <= insumo.minStock * 0.5 ? 'CRÍTICO' :
                     insumo.currentStock <= insumo.minStock ? 'BAIXO' : 'OK';

      jarvis.setEntity('last_queried_item', insumo.name);

      return {
        success: true,
        data: insumo,
        message: `${insumo.name}: ${insumo.currentStock} ${insumo.unit} (Status: ${status})`,
      };
    },
  },

  // ============================================================
  // PRODUCT MANAGEMENT
  // ============================================================
  create_product: {
    name: 'create_product',
    description: 'Criar novo produto',
    parameters: {
      name: { type: 'string', description: 'Nome do produto', required: true },
      price: { type: 'number', description: 'Preço de venda', required: true },
      cost: { type: 'number', description: 'Custo do produto', required: false, default: 0 },
      category: { type: 'string', description: 'Categoria', required: false, default: 'Geral' },
    },
    handler: async (args, tenantId) => {
      const product = await productsService.create({
        tenantId,
        name: args.name,
        price: args.price,
        cost: args.cost || 0,
        margin: args.price > 0 ? ((args.price - (args.cost || 0)) / args.price) * 100 : 0,
        category: args.category || 'Geral',
        description: 'Criado via JARVIS',
        active: true,
        createdAt: new Date().toISOString(),
      } as any);

      jarvis.remember(
        `Criar produto ${args.name} por R$${args.price}`,
        `Produto criado com sucesso`,
        'success'
      );

      return {
        success: true,
        data: product,
        message: `Produto "${args.name}" criado por R$ ${args.price.toFixed(2)}`,
      };
    },
  },

  query_price: {
    name: 'query_price',
    description: 'Consultar preço de um produto',
    parameters: {
      product_name: { type: 'string', description: 'Nome do produto', required: true },
    },
    handler: async (args, tenantId) => {
      const products = await productsService.getAll(tenantId);
      const product = products.find(p => 
        p.name.toLowerCase().includes(args.product_name.toLowerCase())
      );
      
      if (!product) {
        return { success: false, error: 'not_found', message: `Produto "${args.product_name}" não encontrado` };
      }

      const lucro = product.price - product.cost;
      const margem = product.price > 0 ? ((lucro / product.price) * 100).toFixed(1) : '0';

      jarvis.setEntity('last_queried_product', product.name);

      return {
        success: true,
        data: product,
        message: `${product.name}: R$ ${product.price.toFixed(2)} (Lucro: R$ ${lucro.toFixed(2)}, Margem: ${margem}%)`,
      };
    },
  },

  // ============================================================
  // ORDER MANAGEMENT
  // ============================================================
  create_order: {
    name: 'create_order',
    description: 'Criar novo pedido',
    parameters: {
      customer: { type: 'string', description: 'Nome do cliente', required: true },
      product: { type: 'string', description: 'Nome do produto', required: true },
      quantity: { type: 'number', description: 'Quantidade', required: false, default: 1 },
    },
    handler: async (args, tenantId) => {
      const products = await productsService.getAll(tenantId);
      const product = products.find(p => 
        p.name.toLowerCase().includes(args.product.toLowerCase())
      );
      
      if (!product) {
        return { success: false, error: 'not_found', message: `Produto "${args.product}" não encontrado` };
      }

      const quantity = args.quantity || 1;
      const total = product.price * quantity;

      const order = await ordersService.create({
        tenantId,
        customerName: args.customer,
        items: [{
          productName: product.name,
          quantity,
          unitPrice: product.price,
          subtotal: total,
        }],
        totalAmount: total,
        status: 'Pendente',
        createdAt: new Date().toISOString(),
      } as any);

      jarvis.remember(
        `Pedido para ${args.customer}: ${quantity}x ${product.name}`,
        `Pedido criado: R$ ${total.toFixed(2)}`,
        'success'
      );

      return {
        success: true,
        data: order,
        message: `Pedido para ${args.customer}: ${quantity}x ${product.name} = R$ ${total.toFixed(2)}`,
      };
    },
  },

  // ============================================================
  // ANALYTICS
  // ============================================================
  get_analytics: {
    name: 'get_analytics',
    description: 'Obter análises do negócio',
    parameters: {
      type: { type: 'string', description: 'Tipo: stock, sales, profit, summary', required: false, default: 'summary' },
    },
    handler: async (args, tenantId) => {
      const insumos = await insumosService.getAll(tenantId);
      const products = await productsService.getAll(tenantId);
      const orders = await ordersService.getAll(tenantId);
      
      jarvis.updateState({ insumos, products, orders });
      const summary = jarvis.calculateFinancialSummary();
      const alerts = jarvis.analyzeStockAlerts();
      
      const criticalAlerts = alerts.filter(a => a.level === 'critical');
      const lowAlerts = alerts.filter(a => a.level === 'low');

      let message = '';
      
      switch (args.type) {
        case 'stock':
          message = `Estoque: ${insumos.length} itens. Valor total: R$ ${summary.totalStockValue.toFixed(2)}. ${criticalAlerts.length} itens críticos, ${lowAlerts.length} baixos.`;
          break;
        case 'sales':
          message = `Vendas: ${orders.length} pedidos. Total: R$ ${summary.totalRevenue.toFixed(2)}.`;
          break;
        case 'profit':
          message = `Lucro: Margem média ${summary.averageMargin.toFixed(1)}%. Top produto: ${summary.topProducts[0]?.name || 'N/A'}.`;
          break;
        default:
          message = `Resumo: ${insumos.length} insumos (R$ ${summary.totalStockValue.toFixed(2)}), ${products.length} produtos, ${orders.length} pedidos (R$ ${summary.totalRevenue.toFixed(2)}).`;
      }

      return {
        success: true,
        data: { summary, alerts: criticalAlerts.concat(lowAlerts) },
        message,
      };
    },
  },

  // ============================================================
  // NAVIGATION
  // ============================================================
  navigate: {
    name: 'navigate',
    description: 'Navegar para um módulo',
    parameters: {
      module: { type: 'string', description: 'Módulo: dashboard, insumos, products, orders, fichas, invoices', required: true },
    },
    handler: async (args) => {
      const modules: Record<string, string> = {
        dashboard: 'dashboard',
        insumos: 'insumos',
        estoque: 'insumos',
        products: 'products',
        produtos: 'products',
        orders: 'orders',
        pedidos: 'orders',
        fichas: 'fichas',
        invoices: 'invoices',
        notas: 'invoices',
      };

      const target = modules[args.module.toLowerCase()] || args.module;
      jarvis.setLastModule(target);

      return {
        success: true,
        message: `Navegando para ${args.module}`,
        data: { navigate: target },
      };
    },
  },

  // ============================================================
  // SYSTEM
  // ============================================================
  get_help: {
    name: 'get_help',
    description: 'Obter ajuda',
    parameters: {},
    handler: async () => {
      const helpText = `🧠 JARVIS - Comandos disponíveis:

📦 ESTOQUE:
• "Quanto tenho de X?" - Consultar estoque
• "Adicionar 5kg de X" - Entrada de estoque
• "Remover 2un de Y" - Saída de estoque
• "Estoque baixo" - Alertas

🏷️ PRODUTOS:
• "Quanto custa X?" - Consultar preço
• "Criar produto X por 50" - Novo produto
• "Margem de lucro" - Análise

🛒 PEDIDOS:
• "Criar pedido para Maria X 2" - Novo pedido
• "Abrir pedidos" - Ver pedidos

📊 RELATÓRIOS:
• "Resumo" - Visão geral
• "Relatório de vendas" - Vendas
• "Top produtos" - Ranking

💡 DICAS:
• Fale naturalmente
• Use "criar insumo" para fluxo guiado
• Digite "ajuda" a qualquer momento`;

      return {
        success: true,
        message: helpText,
      };
    },
  },

  clear_memory: {
    name: 'clear_memory',
    description: 'Limpar memória do JARVIS',
    parameters: {},
    handler: async () => {
      jarvis.resetContext();
      return {
        success: true,
        message: 'Memória limpa. Começando uma nova sessão.',
      };
    },
  },
};

// ============================================================
// TOOL CALLING ENGINE
// ============================================================

class JarvisToolCalling {
  private static instance: JarvisToolCalling;
  private callHistory: ToolCall[] = [];
  private storageKey = 'jarvis_tool_history';

  private constructor() {
    this.loadHistory();
  }

  static getInstance(): JarvisToolCalling {
    if (!JarvisToolCalling.instance) {
      JarvisToolCalling.instance = new JarvisToolCalling();
    }
    return JarvisToolCalling.instance;
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.callHistory = stored ? JSON.parse(stored) : [];
    } catch {
      this.callHistory = [];
    }
  }

  private saveHistory(): void {
    try {
      const trimmed = this.callHistory.slice(-100);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch {}
  }

  getAvailableTools(): Array<{ name: string; description: string }> {
    return Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
    }));
  }

  async executeTool(
    toolName: string,
    args: Record<string, any>,
    tenantId: string
  ): Promise<ToolResult> {
    const tool = tools[toolName];
    
    if (!tool) {
      return {
        success: false,
        error: 'tool_not_found',
        message: `Ferramenta "${toolName}" não encontrada`,
      };
    }

    // Validate required parameters
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      if (paramDef.required && !(paramName in args)) {
        if (paramDef.default !== undefined) {
          args[paramName] = paramDef.default;
        } else {
          return {
            success: false,
            error: 'missing_parameter',
            message: `Parâmetro "${paramName}" é obrigatório`,
          };
        }
      }
    }

    const call: ToolCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: toolName,
      args,
      timestamp: Date.now(),
    };

    this.callHistory.push(call);
    this.saveHistory();

    try {
      const result = await tool.handler(args, tenantId);
      
      jarvis.setLastAction(toolName);
      jarvis.trackCommand(toolName);
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: 'execution_error',
        message: `Erro ao executar ${toolName}: ${error}`,
      };
    }
  }

  async processNaturalLanguage(
    input: string,
    tenantId: string
  ): Promise<ToolResult> {
    const lower = input.toLowerCase().trim();
    
    // Pattern matching for tool calls
    const patterns: Array<{ regex: RegExp; tool: string; extract: (m: RegExpMatchArray) => Record<string, any> }> = [
      // Stock queries
      { regex: /quanto\s+(?:tenho|tem|resta)\s+(?:de\s+)?(.+?)[\?\s]*$/i, tool: 'query_stock', extract: (m) => ({ item_name: m[1].trim() }) },
      { regex: /estoque\s+(?:do|da|de)\s+(.+?)[\?\s]*$/i, tool: 'query_stock', extract: (m) => ({ item_name: m[1].trim() }) },
      
      // Add stock
      { regex: /(?:adicionar?|adicionar?|entrar?|chegou?)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc)?s?\s+(?:do?|da?|de)?\s*(.+?)[\.\s]*$/i, tool: 'add_stock', extract: (m) => ({ item_name: m[3].trim(), quantity: parseInt(m[1]), unit: m[2] || 'un' }) },
      
      // Remove stock
      { regex: /(?:remover?|tirar?|saiu?|gastou?)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc)?s?\s+(?:do?|da?|de)?\s*(.+?)[\.\s]*$/i, tool: 'remove_stock', extract: (m) => ({ item_name: m[3].trim(), quantity: parseInt(m[1]), unit: m[2] || 'un' }) },
      
      // Price queries
      { regex: /(?:quanto|preço)\s+(?:custa|vale|do|da)\s+(.+?)[\?\s]*$/i, tool: 'query_price', extract: (m) => ({ product_name: m[1].trim() }) },
      
      // Create product
      { regex: /cri(?:ar?|e)\s+produto\s+(.+?)\s+(?:por|preço|custa)\s+(?:r\$?\s*)?(\d+[\.,]?\d*)/i, tool: 'create_product', extract: (m) => ({ name: m[1].trim(), price: parseFloat(m[2].replace(',', '.')) }) },
      
      // Create order
      { regex: /pedido\s+(?:para|do|pra)\s+(.+?)\s+(.+?)\s+(?:x|por|quantidade)\s*(\d+)/i, tool: 'create_order', extract: (m) => ({ customer: m[1].trim(), product: m[2].trim(), quantity: parseInt(m[3]) }) },
      
      // Analytics
      { regex: /resumo|visão\s+geral/i, tool: 'get_analytics', extract: () => ({ type: 'summary' }) },
      { regex: /relat[oó]rio\s+(?:de\s+)?vendas/i, tool: 'get_analytics', extract: () => ({ type: 'sales' }) },
      { regex: /estoque\s+(?:baixo|crítico)/i, tool: 'get_analytics', extract: () => ({ type: 'stock' }) },
      { regex: /margem\s+de\s+lucro/i, tool: 'get_analytics', extract: () => ({ type: 'profit' }) },
      
      // Navigation
      { regex: /(?:abrir?|ir\s+para?|mostrar?)\s+(dashboard|insumos|estoque|produtos|products|pedidos|orders|fichas|notas|invoices)/i, tool: 'navigate', extract: (m) => ({ module: m[1].toLowerCase() }) },
      
      // Help
      { regex: /ajuda|help|comandos|o\s+quê\s+você\s+sabe/i, tool: 'get_help', extract: () => ({}) },
      
      // Clear memory
      { regex: /limpar\s+(?:memória|contexto|tudo)/i, tool: 'clear_memory', extract: () => ({}) },
    ];

    for (const pattern of patterns) {
      const match = lower.match(pattern.regex);
      if (match) {
        const args = pattern.extract(match);
        return this.executeTool(pattern.tool, args, tenantId);
      }
    }

    return {
      success: false,
      error: 'no_match',
      message: `Não entendi "${input}". Diga "ajuda" para ver os comandos.`,
    };
  }

  getCallHistory(count = 10): ToolCall[] {
    return this.callHistory.slice(-count).reverse();
  }
}

export const jarvisTools = JarvisToolCalling.getInstance();
export type { ToolCall, ToolResult, ToolDefinition };
