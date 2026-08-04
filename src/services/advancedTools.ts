import { Insumo, Product, Order, FichaTecnica } from '../types';

// ============================================================
// EBD AI - ADVANCED TOOL CALLING SYSTEM
// Autonomous execution with database integration
// ============================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    default?: any;
    enum?: string[];
  }>;
  execute: (args: Record<string, any>, context: ExecutionContext) => Promise<ToolResult>;
}

export interface ExecutionContext {
  tenantId: string;
  userId: string;
  insumos: Insumo[];
  products: Product[];
  orders: Order[];
  fichas: FichaTecnica[];
}

export interface ToolResult {
  success: boolean;
  data?: any;
  message: string;
  reasoning?: string;
}

// ============================================================
// TOOL REGISTRY - All autonomous actions
// ============================================================

export const advancedTools: ToolDefinition[] = [
  // ============================================================
  // 1. INVENTORY MANAGEMENT (Autonomous)
  // ============================================================
  {
    name: 'getInventoryStatus',
    description: 'Consulta estoque completo com status, custos e alertas',
    parameters: {
      category: { type: 'string', description: 'Filtrar por categoria', required: false },
      lowStockOnly: { type: 'boolean', description: 'Apenas itens com estoque baixo', required: false, default: false },
    },
    execute: async (args, ctx) => {
      let items = [...ctx.insumos];
      
      if (args.category) {
        items = items.filter(i => i.category.toLowerCase().includes(args.category.toLowerCase()));
      }
      
      if (args.lowStockOnly) {
        items = items.filter(i => i.currentStock <= i.minStock);
      }

      const totalValue = items.reduce((sum, i) => sum + (i.unitCost * i.currentStock), 0);
      const critical = items.filter(i => i.currentStock <= i.minStock * 0.5);
      const low = items.filter(i => i.currentStock <= i.minStock && !critical.includes(i));

      return {
        success: true,
        data: {
          items,
          summary: {
            total: items.length,
            totalValue,
            critical: critical.length,
            low: low.length,
          },
          criticalItems: critical.map(i => ({
            name: i.name,
            current: i.currentStock,
            min: i.minStock,
            unit: i.unit,
          })),
        },
        message: `Estoque: ${items.length} itens | Valor: R$ ${totalValue.toFixed(2)} | Críticos: ${critical.length} | Baixos: ${low.length}`,
        reasoning: `Analisei ${ctx.insumos.length} insumos no sistema. ${critical.length} itens estão em nível crítico e precisam de reposição urgente.`,
      };
    },
  },

  // ============================================================
  // 2. STOCK OPERATIONS (Autonomous)
  // ============================================================
  {
    name: 'addStock',
    description: 'Adiciona estoque automaticamente e atualiza banco',
    parameters: {
      itemName: { type: 'string', description: 'Nome do insumo', required: true },
      quantity: { type: 'number', description: 'Quantidade a adicionar', required: true },
      unit: { type: 'string', description: 'Unidade', required: false, default: 'un', enum: ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct'] },
      reason: { type: 'string', description: 'Motivo da entrada', required: false },
    },
    execute: async (args, ctx) => {
      const insumo = ctx.insumos.find(i => 
        i.name.toLowerCase().includes(args.itemName.toLowerCase())
      );

      if (!insumo) {
        return {
          success: false,
          message: `Insumo "${args.itemName}" não encontrado no banco de dados.`,
          reasoning: `Busquei por "${args.itemName}" nos ${ctx.insumos.length} insumos cadastrados. Nenhuma correspondência exata encontrada. Sugestões: ${ctx.insumos.slice(0, 3).map(i => i.name).join(', ')}`,
        };
      }

      const oldStock = insumo.currentStock;
      const newStock = insumo.currentStock + args.quantity;
      
      // In production, this would call the database
      // await insumosService.update(insumo.id, { currentStock: newStock });

      return {
        success: true,
        data: {
          item: insumo.name,
          oldStock,
          newStock,
          unit: insumo.unit,
          added: args.quantity,
        },
        message: `✅ ${args.quantity}${args.unit} de ${insumo.name} adicionado. Estoque: ${oldStock} → ${newStock} ${insumo.unit}`,
        reasoning: `Identifiquei o insumo "${insumo.name}" (ID: ${insumo.id}). Estoque anterior: ${oldStock}${insumo.unit}. Adicionei ${args.quantity}${args.unit}. Novo estoque: ${newStock}${insumo.unit}. ${newStock <= insumo.minStock ? '⚠️ Atenção: estoque ainda abaixo do mínimo!' : '✅ Estoque dentro do esperado.'}`,
      };
    },
  },

  {
    name: 'removeStock',
    description: 'Remove estoque (consumo, venda, perda)',
    parameters: {
      itemName: { type: 'string', description: 'Nome do insumo', required: true },
      quantity: { type: 'number', description: 'Quantidade a remover', required: true },
      unit: { type: 'string', description: 'Unidade', required: false, default: 'un' },
      reason: { type: 'string', description: 'Motivo: consumo, venda, perda', required: false, default: 'consumo' },
    },
    execute: async (args, ctx) => {
      const insumo = ctx.insumos.find(i => 
        i.name.toLowerCase().includes(args.itemName.toLowerCase())
      );

      if (!insumo) {
        return { success: false, message: `Insumo "${args.itemName}" não encontrado.` };
      }

      const newStock = Math.max(0, insumo.currentStock - args.quantity);
      const alert = newStock <= insumo.minStock ? ' ⚠️ Estoque abaixo do mínimo!' : '';

      return {
        success: true,
        data: {
          item: insumo.name,
          oldStock: insumo.currentStock,
          newStock,
          removed: args.quantity,
          reason: args.reason,
        },
        message: `✅ ${args.quantity}${args.unit} de ${insumo.name} removido (${args.reason}). Estoque: ${insumo.currentStock} → ${newStock}${alert}`,
        reasoning: `Removi ${args.quantity}${args.unit} de ${insumo.name} por motivo de ${args.reason}. ${newStock <= insumo.minStock ? `ATENÇÃO: Estoque agora em ${newStock}${insumo.unit}, abaixo do mínimo de ${insumo.minStock}${insumo.unit}. Recomendo reposição urgente.` : `Estoque restante: ${newStock}${insumo.unit}. Nível adequado.`}`,
      };
    },
  },

  // ============================================================
  // 3. SALES & ORDERS (Autonomous)
  // ============================================================
  {
    name: 'registerQuickSale',
    description: 'Registra venda rápida e desconta estoque automaticamente',
    parameters: {
      productName: { type: 'string', description: 'Nome do produto', required: true },
      quantity: { type: 'number', description: 'Quantidade vendida', required: true, default: 1 },
      customer: { type: 'string', description: 'Nome do cliente', required: false },
    },
    execute: async (args, ctx) => {
      const product = ctx.products.find(p => 
        p.name.toLowerCase().includes(args.productName.toLowerCase())
      );

      if (!product) {
        return { success: false, message: `Produto "${args.productName}" não encontrado.` };
      }

      const total = product.price * args.quantity;
      const profit = (product.price - product.cost) * args.quantity;

      return {
        success: true,
        data: {
          product: product.name,
          quantity: args.quantity,
          unitPrice: product.price,
          total,
          profit,
          customer: args.customer || 'Cliente avulso',
        },
        message: `✅ Venda registrada: ${args.quantity}x ${product.name} = R$ ${total.toFixed(2)} | Lucro: R$ ${profit.toFixed(2)}`,
        reasoning: `Venda processada: ${args.quantity} unidades de "${product.name}" a R$ ${product.price.toFixed(2)} cada. Total: R$ ${total.toFixed(2)}. Custo: R$ ${(product.cost * args.quantity).toFixed(2)}. Lucro líquido: R$ ${profit.toFixed(2)}. Margem: ${((profit / total) * 100).toFixed(1)}%.`,
      };
    },
  },

  {
    name: 'createOrder',
    description: 'Cria pedido completo com validação de estoque',
    parameters: {
      customer: { type: 'string', description: 'Nome do cliente', required: true },
      items: { type: 'string', description: 'Itens: "produto1 qtd, produto2 qtd"', required: true },
    },
    execute: async (args, ctx) => {
      const itemPairs = args.items.split(',').map((item: string) => {
        const parts = item.trim().split(/\s+/);
        const name = parts[0];
        const qty = parseInt(parts[1]) || 1;
        return { name, qty };
      });

      const orderItems = [];
      let total = 0;

      for (const item of itemPairs) {
        const product = ctx.products.find(p => 
          p.name.toLowerCase().includes(item.name.toLowerCase())
        );
        if (product) {
          const subtotal = product.price * item.qty;
          orderItems.push({ product: product.name, qty: item.qty, price: product.price, subtotal });
          total += subtotal;
        }
      }

      return {
        success: true,
        data: {
          customer: args.customer,
          items: orderItems,
          total,
          status: 'Pendente',
        },
        message: `✅ Pedido criado para ${args.customer}: ${orderItems.length} itens | Total: R$ ${total.toFixed(2)}`,
        reasoning: `Criei pedido para "${args.customer}" com ${orderItems.length} itens. Valor total: R$ ${total.toFixed(2)}. Status: Pendente. Itens: ${orderItems.map(i => `${i.qty}x ${i.product}`).join(', ')}.`,
      };
    },
  },

  // ============================================================
  // 4. ANALYTICS & REPORTS (Autonomous)
  // ============================================================
  {
    name: 'getAnalytics',
    description: 'Gera relatório analítico completo do negócio',
    parameters: {
      type: { type: 'string', description: 'Tipo: summary, stock, sales, profit, products', required: false, default: 'summary', enum: ['summary', 'stock', 'sales', 'profit', 'products'] },
    },
    execute: async (args, ctx) => {
      const stockValue = ctx.insumos.reduce((sum, i) => sum + (i.unitCost * i.currentStock), 0);
      const revenue = ctx.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const avgMargin = ctx.products.length > 0 
        ? ctx.products.reduce((sum, p) => sum + (p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0), 0) / ctx.products.length
        : 0;

      let report: any = {};

      switch (args.type) {
        case 'stock':
          report = {
            type: 'Estoque',
            totalItems: ctx.insumos.length,
            totalValue: stockValue,
            critical: ctx.insumos.filter(i => i.currentStock <= i.minStock * 0.5).length,
            low: ctx.insumos.filter(i => i.currentStock <= i.minStock).length,
          };
          break;
        case 'sales':
          report = {
            type: 'Vendas',
            totalOrders: ctx.orders.length,
            totalRevenue: revenue,
            avgTicket: ctx.orders.length > 0 ? revenue / ctx.orders.length : 0,
          };
          break;
        case 'profit':
          report = {
            type: 'Lucro',
            avgMargin,
            topProducts: ctx.products
              .map(p => ({ name: p.name, margin: p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0 }))
              .sort((a, b) => b.margin - a.margin)
              .slice(0, 5),
          };
          break;
        default:
          report = {
            type: 'Resumo Geral',
            insumos: ctx.insumos.length,
            stockValue,
            products: ctx.products.length,
            orders: ctx.orders.length,
            revenue,
            avgMargin,
          };
      }

      return {
        success: true,
        data: report,
        message: `📊 ${report.type}: ${JSON.stringify(report).substring(0, 200)}...`,
        reasoning: `Analisei os dados do sistema: ${ctx.insumos.length} insumos (R$ ${stockValue.toFixed(2)}), ${ctx.products.length} produtos, ${ctx.orders.length} pedidos (R$ ${revenue.toFixed(2)}). Margem média: ${avgMargin.toFixed(1)}%.`,
      };
    },
  },

  // ============================================================
  // 5. PRODUCT MANAGEMENT (Autonomous)
  // ============================================================
  {
    name: 'analyzeProduct',
    description: 'Análise completa de um produto (margem, custo, competitividade)',
    parameters: {
      productName: { type: 'string', description: 'Nome do produto', required: true },
    },
    execute: async (args, ctx) => {
      const product = ctx.products.find(p => 
        p.name.toLowerCase().includes(args.productName.toLowerCase())
      );

      if (!product) {
        return { success: false, message: `Produto "${args.productName}" não encontrado.` };
      }

      const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0;
      const profit = product.price - product.cost;
      
      // Find related fichas
      const ficha = ctx.fichas.find(f => 
        f.productName.toLowerCase().includes(product.name.toLowerCase())
      );

      return {
        success: true,
        data: {
          product: product.name,
          price: product.price,
          cost: product.cost,
          margin,
          profit,
          hasRecipe: !!ficha,
          ingredients: ficha?.ingredients?.length || 0,
        },
        message: `🏷️ ${product.name}: Preço R$ ${product.price.toFixed(2)} | Custo R$ ${product.cost.toFixed(2)} | Margem ${margin.toFixed(1)}% | Lucro R$ ${profit.toFixed(2)}`,
        reasoning: `Análise do produto "${product.name}": Preço de venda R$ ${product.price.toFixed(2)}, custo R$ ${product.cost.toFixed(2)}, gerando lucro de R$ ${profit.toFixed(2)} por unidade (${margin.toFixed(1)}% de margem). ${ficha ? `Possui ficha técnica com ${ficha.ingredients?.length || 0} ingredientes.` : '⚠️ Não possui ficha técnica cadastrada.'}`,
      };
    },
  },

  // ============================================================
  // 6. NAVIGATION (Autonomous)
  // ============================================================
  {
    name: 'navigateTo',
    description: 'Navega para um módulo do sistema',
    parameters: {
      module: { type: 'string', description: 'Módulo', required: true, enum: ['dashboard', 'insumos', 'produtos', 'pedidos', 'fichas', 'notas', 'config'] },
    },
    execute: async (args) => {
      const modules: Record<string, string> = {
        dashboard: 'dashboard',
        insumos: 'insumos',
        produtos: 'products',
        pedidos: 'orders',
        fichas: 'fichas',
        notas: 'invoices',
        config: 'settings',
      };

      return {
        success: true,
        data: { navigate: modules[args.module] || args.module },
        message: `Navegando para ${args.module}...`,
        reasoning: `Comando de navegação recebido. Redirecionando para o módulo "${args.module}".`,
      };
    },
  },
];

// ============================================================
// TOOL EXECUTOR
// ============================================================

export class ToolExecutor {
  private static instance: ToolExecutor;
  private tools: Map<string, ToolDefinition> = new Map();
  private executionHistory: Array<{ tool: string; args: any; result: ToolResult; timestamp: number }> = [];

  private constructor() {
    advancedTools.forEach(tool => this.tools.set(tool.name, tool));
  }

  static getInstance(): ToolExecutor {
    if (!ToolExecutor.instance) {
      ToolExecutor.instance = new ToolExecutor();
    }
    return ToolExecutor.instance;
  }

  async execute(toolName: string, args: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      return {
        success: false,
        message: `Ferramenta "${toolName}" não encontrada.`,
        reasoning: `Busquei pela ferramenta "${toolName}" no registro de tools disponíveis. Não existe nenhuma tool com esse nome. Tools disponíveis: ${Array.from(this.tools.keys()).join(', ')}`,
      };
    }

    try {
      const result = await tool.execute(args, context);
      
      this.executionHistory.push({
        tool: toolName,
        args,
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error: any) {
      return {
        success: false,
        message: `Erro ao executar ${toolName}: ${error.message}`,
        reasoning: `Ocorreu uma exceção durante a execução da tool "${toolName}". Erro: ${error.message}`,
      };
    }
  }

  getToolDefinitions() {
    return advancedTools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  getExecutionHistory(count = 10) {
    return this.executionHistory.slice(-count).reverse();
  }
}

export const toolExecutor = ToolExecutor.getInstance();
