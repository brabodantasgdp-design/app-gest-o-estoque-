import { Insumo, Product, Order, FichaTecnica, InvoiceScan } from '../types';
import { insumosService, productsService, ordersService, fichasService, invoicesService } from '../lib/database';

export interface CommandResult {
  action: string;
  response: string;
  success: boolean;
  data?: any;
  navigate?: string;
}

interface CommandContext {
  insumos: Insumo[];
  products: Product[];
  orders: Order[];
  fichas: FichaTecnica[];
  invoices: InvoiceScan[];
  tenant?: { name?: string };
}

interface CommandActions {
  navigate: (module: string) => void;
  addStock: (product: string, qty: number, unit: string) => Promise<void>;
  removeStock: (product: string, qty: number, unit: string) => Promise<void>;
  createProduct: (name: string, price: number) => Promise<void>;
  createOrder: (customer: string, product: string, qty: number) => Promise<void>;
  queryStock: (name: string) => { currentStock: number; unit: string } | null;
  close: () => void;
}

function parseQuantity(text: string): number {
  const words: Record<string, number> = {
    'meio': 0.5, 'metade': 0.5, 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2,
    'três': 3, 'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8,
    'nove': 9, 'dez': 10, 'vinte': 20, 'trinta': 30, 'quarenta': 40,
    'cinquenta': 50, 'cem': 100, 'mil': 1000,
  };
  
  for (const [word, num] of Object.entries(words)) {
    if (text.includes(word)) return num;
  }
  
  const numbers = text.match(/\d+/);
  return numbers ? parseInt(numbers[0]) : 0;
}

function parseUnit(text: string): string {
  const units: Record<string, string> = {
    'kg': 'kg', 'quilo': 'kg', 'quilos': 'kg', 'kilo': 'kg',
    'g': 'g', 'gramas': 'g', 'grama': 'g',
    'l': 'L', 'litro': 'L', 'litros': 'L', 'lt': 'L',
    'ml': 'mL', 'mililitros': 'mL', 'mililitro': 'mL',
    'un': 'un', 'unidade': 'un', 'unidades': 'un', 'peça': 'un', 'peças': 'un',
    'cx': 'cx', 'caixa': 'cx', 'caixas': 'cx',
    'pct': 'pct', 'pacote': 'pct', 'pacotes': 'pct',
    'sc': 'sc', 'saco': 'sc', 'sacos': 'sc',
  };
  
  for (const [key, unit] of Object.entries(units)) {
    if (text.includes(key)) return unit;
  }
  return 'un';
}

function parsePrice(text: string): number {
  const priceMatch = text.match(/(\d+[\.,]?\d*)/);
  if (priceMatch) {
    return parseFloat(priceMatch[0].replace(',', '.'));
  }
  return 0;
}

const NAVEGACAO: Record<string, string> = {
  'dashboard': 'dashboard', 'início': 'dashboard', 'início': 'dashboard', 'home': 'dashboard',
  'insumos': 'insumos', 'estoque': 'insumos', 'ingredientes': 'insumos', 'matéria': 'insumos',
  'produtos': 'produtos', 'cardápio': 'produtos', 'itens': 'produtos', 'vendas': 'produtos',
  'pedidos': 'orders', 'ordens': 'orders', 'comandas': 'orders',
  'fichas': 'fichas', 'ficha técnica': 'fichas', 'receitas': 'fichas', 'produção': 'fichas',
  'notas': 'invoices', 'nf': 'invoices', 'nota fiscal': 'invoices', 'ocr': 'invoices',
  'configurações': 'settings', 'config': 'settings', 'admin': 'settings',
  'usuários': 'users', 'usuário': 'users', 'equipe': 'users', 'colaboradores': 'users',
};

const SKILL_PATTERNS: Array<{
  patterns: RegExp[];
  handler: (match: RegExpMatchArray, ctx: CommandContext, actions: CommandActions) => CommandResult;
}> = [
  // ============ RELATÓRIOS ============
  {
    patterns: [
      /relat[oó]rio\s+de\s+vendas/i,
      /quanto\s+(?:vendeu|faturou|ganhou|vendas)/i,
      /vendas\s+do\s+dia/i,
      /faturamento/i,
    ],
    handler: (_, ctx) => {
      const total = ctx.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const pedidos = ctx.orders.length;
      const ticket = pedidos > 0 ? total / pedidos : 0;
      
      const porStatus = ctx.orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + (o.totalAmount || 0);
        return acc;
      }, {} as Record<string, number>);

      let response = `📊 Relatório de Vendas:\n`;
      response += `Total: R$ ${total.toFixed(2)}\n`;
      response += `Pedidos: ${pedidos}\n`;
      response += `Ticket médio: R$ ${ticket.toFixed(2)}\n`;
      
      if (Object.keys(porStatus).length > 0) {
        response += `\nPor status:\n`;
        for (const [status, valor] of Object.entries(porStatus)) {
          response += `• ${status}: R$ ${valor.toFixed(2)}\n`;
        }
      }
      
      if (total === 0) {
        response += `\nNenhum pedido registrado ainda.`;
      }

      return { action: 'report', response, success: true, navigate: 'orders' };
    }
  },

  // ============ ESTOQUE BAIXO ============
  {
    patterns: [
      /estoque\s+(?:baixo|crítico|acabando)/i,
      /produtos?\s+(?:acabando|em\s+falta|baixo)/i,
      /o\s+(?:que|q)\s+(?:está|ta|tem)\s+(?:acabando|faltando)/i,
      /alerta\s+de\s+estoque/i,
      /quase\s+acabando/i,
    ],
    handler: (_, ctx) => {
      const criticos = ctx.insumos.filter(i => i.currentStock <= i.minStock * 0.5);
      const baixos = ctx.insumos.filter(i => i.currentStock <= i.minStock && !criticos.includes(i));
      
      if (criticos.length === 0 && baixos.length === 0) {
        return { action: 'alert', response: '✅ Todos os estoques estão OK!', success: true };
      }

      let response = `⚠️ Alerta de Estoque:\n`;
      
      if (criticos.length > 0) {
        response += `\n🔴 CRÍTICO (${criticos.length}):\n`;
        criticos.forEach(i => {
          response += `• ${i.name}: ${i.currentStock}${i.unit} (mín: ${i.minStock})\n`;
        });
      }
      
      if (baixos.length > 0) {
        response += `\n🟡 BAIXO (${baixos.length}):\n`;
        baixos.forEach(i => {
          response += `• ${i.name}: ${i.currentStock}${i.unit} (mín: ${i.minStock})\n`;
        });
      }

      return { action: 'alert', response, success: true, navigate: 'insumos' };
    }
  },

  // ============ CUSTO DE PRODUÇÃO ============
  {
    patterns: [
      /custo\s+(?:de\s+)?(?:produção|produzir)/i,
      /quanto\s+(?:custa|gasta)\s+pra\s+produzir/i,
      /custo\s+total/i,
      /quanto\s+(?:gastei|investi)\s+(?:em|no)\s+(?:estoque|insumos)/i,
    ],
    handler: (_, ctx) => {
      const totalCusto = ctx.insumos.reduce((sum, i) => sum + (i.unitCost * i.currentStock), 0);
      const totalInsumos = ctx.insumos.length;
      
      const porCategoria = ctx.insumos.reduce((acc, i) => {
        const cat = i.category || 'Sem categoria';
        acc[cat] = (acc[cat] || 0) + (i.unitCost * i.currentStock);
        return acc;
      }, {} as Record<string, number>);

      let response = `💰 Custo de Estoque:\n`;
      response += `Total investido: R$ ${totalCusto.toFixed(2)}\n`;
      response += `Insumos cadastrados: ${totalInsumos}\n`;
      
      if (Object.keys(porCategoria).length > 0) {
        response += `\nPor categoria:\n`;
        for (const [cat, valor] of Object.entries(porCategoria).sort((a, b) => b[1] - a[1])) {
          response += `• ${cat}: R$ ${valor.toFixed(2)}\n`;
        }
      }

      return { action: 'report', response, success: true, navigate: 'insumos' };
    }
  },

  // ============ MARGEM DE LUCRO ============
  {
    patterns: [
      /margem\s+de\s+lucro/i,
      /lucro\s+por\s+produto/i,
      /quanto\s+(?:lucro|ganho)\s+por/i,
      /rentabilidade/i,
      /quais?\s+(?:são?|estão)\s+mais\s+(?:lucrativos?|rentáveis?)/i,
    ],
    handler: (_, ctx) => {
      const produtosLucro = ctx.products.map(p => {
        const margem = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0;
        const lucro = p.price - p.cost;
        return { ...p, margem, lucro };
      }).sort((a, b) => b.margem - a.margem);

      if (produtosLucro.length === 0) {
        return { action: 'report', response: 'Nenhum produto cadastrado.', success: true };
      }

      let response = `📈 Margem de Lucro:\n`;
      
      const top3 = produtosLucro.slice(0, 3);
      const bottom3 = produtosLucro.slice(-3).reverse();

      response += `\n🏆 TOP 3 Lucrativos:\n`;
      top3.forEach(p => {
        response += `• ${p.name}: ${p.margem.toFixed(1)}% (R$ ${p.lucro.toFixed(2)}/un)\n`;
      });

      response += `\n⚠️ MENOR Margem:\n`;
      bottom3.forEach(p => {
        response += `• ${p.name}: ${p.margem.toFixed(1)}% (R$ ${p.lucro.toFixed(2)}/un)\n`;
      });

      const margemMedia = produtosLucro.reduce((s, p) => s + p.margem, 0) / produtosLucro.length;
      response += `\nMargem média: ${margemMedia.toFixed(1)}%`;

      return { action: 'report', response, success: true, navigate: 'produtos' };
    }
  },

  // ============ TOP PRODUTOS ============
  {
    patterns: [
      /produtos?\s+(?:mais|melhores)\s+(?:vendidos?|vendidos?)/i,
      /mais\s+vendidos?/i,
      /ranking\s+de\s+vendas/i,
      /quais?\s+(?:são?|vendem)\s+mais/i,
    ],
    handler: (_, ctx) => {
      if (ctx.products.length === 0) {
        return { action: 'report', response: 'Nenhum produto cadastrado.', success: true };
      }

      const sorted = [...ctx.products].sort((a, b) => b.price - a.price).slice(0, 5);
      
      let response = `🏆 Ranking de Produtos:\n`;
      sorted.forEach((p, i) => {
        response += `${i + 1}º ${p.name} - R$ ${p.price.toFixed(2)}\n`;
      });

      return { action: 'report', response, success: true, navigate: 'produtos' };
    }
  },

  // ============ RESUMO GERAL ============
  {
    patterns: [
      /resumo/i,
      /visão\s+geral/i,
      /tudo\s+resumido/i,
      /me\s+resume/i,
      /como\s+(?:está|ta)\s+(?:o\s+)?(?:negócio|empresa|loja)/i,
    ],
    handler: (_, ctx) => {
      const totalEstoque = ctx.insumos.reduce((s, i) => s + i.currentStock, 0);
      const valorEstoque = ctx.insumos.reduce((s, i) => s + (i.unitCost * i.currentStock), 0);
      const totalPedidos = ctx.orders.length;
      const valorVendas = ctx.orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const estoqueBaixo = ctx.insumos.filter(i => i.currentStock <= i.minStock).length;
      const fichasCount = ctx.fichas.length;

      let response = `📋 Resumo Geral:\n`;
      response += `📦 Insumos: ${ctx.insumos.length} tipos, ${totalEstoque} unidades\n`;
      response += `💰 Valor em estoque: R$ ${valorEstoque.toFixed(2)}\n`;
      response += `🏷️ Produtos: ${ctx.products.length}\n`;
      response += `🛒 Pedidos: ${totalPedidos} (R$ ${valorVendas.toFixed(2)})\n`;
      response += `📝 Fichas técnicas: ${fichasCount}\n`;
      
      if (estoqueBaixo > 0) {
        response += `⚠️ Estoque baixo: ${estoqueBaixo} itens\n`;
      }
      
      if (ctx.invoices.length > 0) {
        response += `📄 Notas fiscal: ${ctx.invoices.length}\n`;
      }

      return { action: 'report', response, success: true };
    }
  },

  // ============ CONSULTAR INSUMO ESPECÍFICO ============
  {
    patterns: [
      /quanto\s+(?:tenho|tem|resta|fica)\s+de\s+(.+?)[\?\s]*$/i,
      /estoque\s+(?:do|da|de)\s+(.+?)[\?\s]*$/i,
      /(.+?)\s+(?:está|ta)\s+(?:com\s+)?(?:quanto|quanto)/i,
    ],
    handler: (match, ctx) => {
      const nome = match[1].trim().toLowerCase();
      const insumo = ctx.insumos.find(i => i.name.toLowerCase().includes(nome));
      
      if (!insumo) {
        const sugestoes = ctx.insumos
          .filter(i => {
            const palavras = nome.split(' ');
            return palavras.some(p => i.name.toLowerCase().includes(p));
          })
          .slice(0, 3)
          .map(i => i.name);
        
        let response = `❌ Não encontrei "${match[1].trim()}" no estoque.`;
        if (sugestoes.length > 0) {
          response += `\n\nVocê quis dizer:\n${sugestoes.map(s => `• ${s}`).join('\n')}`;
        }
        return { action: 'query', response, success: false };
      }

      const status = insumo.currentStock <= insumo.minStock * 0.5 ? '🔴 CRÍTICO' :
                     insumo.currentStock <= insumo.minStock ? '🟡 BAIXO' : '✅ OK';

      const response = `📦 ${insumo.name}:\n• Quantidade: ${insumo.currentStock} ${insumo.unit}\n• Mínimo: ${insumo.minStock} ${insumo.unit}\n• Status: ${status}\n• Custo unitário: R$ ${insumo.unitCost.toFixed(2)}\n• Última atualização: ${insumo.lastUpdated}`;

      return { action: 'query', response, success: true, data: insumo };
    }
  },

  // ============ CONSULTAR PREÇO ============
  {
    patterns: [
      /preço\s+(?:do?|da?)\s+(.+?)[\?\s]*$/i,
      /quanto\s+(?:custa|vale)\s+(.+?)[\?\s]*$/i,
      /(.+?)\s+(?:custa|vale)\s+quanto/i,
    ],
    handler: (match, ctx) => {
      const nome = match[1].trim().toLowerCase();
      const produto = ctx.products.find(p => p.name.toLowerCase().includes(nome));
      
      if (!produto) {
        return { action: 'query', response: `❌ Não encontrei o produto "${match[1].trim()}".`, success: false };
      }

      const lucro = produto.price - produto.cost;
      const margem = produto.price > 0 ? ((lucro / produto.price) * 100).toFixed(1) : '0';

      const response = `🏷️ ${produto.name}:\n• Preço: R$ ${produto.price.toFixed(2)}\n• Custo: R$ ${produto.cost.toFixed(2)}\n• Lucro: R$ ${lucro.toFixed(2)}\n• Margem: ${margem}%\n• Categoria: ${produto.category || 'Não definida'}`;

      return { action: 'query', response, success: true, data: produto };
    }
  },

  // ============ INGREDIENTES DO PRODUTO ============
  {
    patterns: [
      /(?:ingredientes?|composição|receita)\s+(?:do?|da?)\s+(.+?)[\?\s]*$/i,
      /(.+?)\s+(?:leva|tem)\s+(?:quais?|o\s+quê)/i,
      /de\s+quê\s+(?:é?\s+feito|feito)\s+(.+?)[\?\s]*$/i,
    ],
    handler: (match, ctx) => {
      const nome = match[1].trim().toLowerCase();
      const ficha = ctx.fichas.find(f => f.productName.toLowerCase().includes(nome));
      
      if (!ficha) {
        return { action: 'query', response: `❌ Não encontrei ficha técnica para "${match[1].trim()}".`, success: false };
      }

      let response = `📝 Receita de ${ficha.productName}:\n`;
      
      if (ficha.ingredients && ficha.ingredients.length > 0) {
        ficha.ingredients.forEach(ing => {
          response += `• ${ing.insumoName}: ${ing.quantity} ${ing.unit}\n`;
        });
      }
      
      if (ficha.costPerPortion) {
        response += `\nCusto por porção: R$ ${ficha.costPerPortion.toFixed(2)}`;
      }
      if (ficha.sellingPrice) {
        response += `\nPreço de venda: R$ ${ficha.sellingPrice.toFixed(2)}`;
      }

      return { action: 'query', response, success: true, data: ficha };
    }
  },

  // ============ ADICIONAR ESTOQUE (MÚLTIPLOS) ============
  {
    patterns: [
      /(?:adicione?|adição|somou?|entrou?|chegou?|receb[iu]+)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc|unidade|litro|quilo|grama)s?\s+(?:do?|da?|de)?\s*(.+?)[\.\s]*$/i,
      /(?:entrou?|chegou?|receb[iu]+)\s+(.+?)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc|unidade|litro|quilo|grama)s?/i,
      /(?:colocar|guardar|armazenar)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc|unidade|litro|quilo|grama)s?\s+(?:do?|da?|de)?\s*(.+?)[\.\s]*$/i,
      /(?:entrar|chegar)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc|unidade|litro|quilo|grama)s?\s+(?:do?|da?|de)?\s*(.+?)[\.\s]*$/i,
    ],
    handler: async (match, ctx, actions) => {
      const quantity = parseQuantity(match[1]);
      const unit = parseUnit(match[2] || match[3]);
      const itemName = (match[3] || match[4]).trim().toLowerCase();
      
      const insumo = ctx.insumos.find(i => i.name.toLowerCase().includes(itemName));
      
      if (!insumo) {
        return { action: 'stock', response: `❌ Não encontrei "${match[3] || match[4]}" no estoque.`, success: false };
      }
      
      await actions.addStock(insumo.name, quantity, unit);
      
      const newStock = insumo.currentStock + quantity;
      return {
        action: 'stock',
        response: `✅ ${quantity}${unit} de ${insumo.name} adicionado!\nEstoque: ${insumo.currentStock} → ${newStock} ${insumo.unit}`,
        success: true,
        data: { name: insumo.name, added: quantity, newStock },
      };
    }
  },

  // ============ REMOVER ESTOQUE (MÚLTIPLOS) ============
  {
    patterns: [
      /(?:remove?|remoção|tirou?|saiu?|gastou?|usou?|consumiu?|perdi)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc|unidade|litro|quilo|grama)s?\s+(?:do?|da?|de)?\s*(.+?)[\.\s]*$/i,
      /(?:saiu?|gastou?|usou?|consumiu?|perdi)\s+(.+?)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc|unidade|litro|quilo|grama)s?/i,
      /(?:tirar|diminuir|baixar)\s+(\d+)\s*(kg|g|l|ml|un|cx|pct|sc|unidade|litro|quilo|grama)s?\s+(?:do?|da?|de)?\s*(.+?)[\.\s]*$/i,
    ],
    handler: async (match, ctx, actions) => {
      const quantity = parseQuantity(match[1]);
      const unit = parseUnit(match[2] || match[3]);
      const itemName = (match[3] || match[4]).trim().toLowerCase();
      
      const insumo = ctx.insumos.find(i => i.name.toLowerCase().includes(itemName));
      
      if (!insumo) {
        return { action: 'stock', response: `❌ Não encontrei "${match[3] || match[4]}" no estoque.`, success: false };
      }
      
      await actions.removeStock(insumo.name, quantity, unit);
      
      const newStock = Math.max(0, insumo.currentStock - quantity);
      const warning = newStock <= insumo.minStock ? '\n⚠️ ATENÇÃO: Estoque abaixo do mínimo!' : '';
      
      return {
        action: 'stock',
        response: `✅ ${quantity}${unit} de ${insumo.name} removido!\nEstoque: ${insumo.currentStock} → ${newStock} ${insumo.unit}${warning}`,
        success: true,
        data: { name: insumo.name, removed: quantity, newStock },
      };
    }
  },

  // ============ CRIAR PRODUTO COM PREÇO ============
  {
    patterns: [
      /cri(?:ar?|e|e)\s+(?:o\s+)?produto\s+(.+?)\s+(?:preço|por|custa|a)\s+(?:r\$?\s*)?(\d+[\.,]?\d*)/i,
      /novo\s+produto\s+(.+?)\s+(\d+[\.,]?\d*)/i,
      /produto\s+novo\s+(.+?)\s+(\d+[\.,]?\d*)/i,
    ],
    handler: async (match, ctx, actions) => {
      const name = match[1].trim();
      const price = parsePrice(match[2]);
      
      await actions.createProduct(name, price);
      
      return {
        action: 'create',
        response: `✅ Produto "${name}" criado com preço R$ ${price.toFixed(2)}!`,
        success: true,
        data: { name, price },
      };
    }
  },

  // ============ CRIAR PEDIDO COMPLETO ============
  {
    patterns: [
      /pedido\s+(?:do?|pra?)\s+(.+?)\s+(.+?)\s+(?:x|por|quantidade)\s*(\d+)/i,
      /novo\s+pedido\s+(.+?)\s+(.+?)\s+(\d+)/i,
    ],
    handler: async (match, ctx, actions) => {
      const customer = match[1].trim();
      const productName = match[2].trim().toLowerCase();
      const qty = parseQuantity(match[3]);
      
      const product = ctx.products.find(p => p.name.toLowerCase().includes(productName));
      if (!product) {
        return { action: 'order', response: `❌ Produto "${match[2].trim()}" não encontrado.`, success: false };
      }
      
      await actions.createOrder(customer, product.name, qty);
      
      return {
        action: 'order',
        response: `✅ Pedido criado:\n• Cliente: ${customer}\n• Produto: ${product.name}\n• Qtd: ${qty}\n• Total: R$ ${(product.price * qty).toFixed(2)}`,
        success: true,
        data: { customer, product: product.name, quantity: qty, total: product.price * qty },
      };
    }
  },

  // ============ FECHAR APP ============
  {
    patterns: [/fechar?\s+(?:app|assistente|tudo)/i, /sair/i, /tchau/i, /até\s+mais/i],
    handler: (_, __, actions) => {
      actions.close();
      return { action: 'close', response: '👋 Até mais! Foi um prazer ajudar!', success: true };
    }
  },

  // ============ AJUDA ============
  {
    patterns: [/ajuda/i, /help/i, /como\s+(?:funciona|uso)/i, /quais?\s+(?:são?|comandos?)/i, /o\s+quê\s+você\s+sabe/i],
    handler: () => {
      const response = `🧠 Minhas Skills:

📦 ESTOQUE:
• "Quanto tenho de X?" - Consulta estoque
• "Estoque baixo" - Alerta de itens acabando
• "Adicionar 5kg de X" - Entrada de estoque
• "Remover 2un de Y" - Saída de estoque
• "Custo de estoque" - Valor total investido

🏷️ PRODUTOS:
• "Quanto custa X?" - Consulta preço
• "Criar produto X preço 50" - Novo produto
• "Margem de lucro" - Análise de rentabilidade

🛒 PEDIDOS:
• "Abrir pedidos" - Ver pedidos
• "Pedido para Maria X 2" - Criar pedido

📊 RELATÓRIOS:
• "Relatório de vendas" - Vendas do dia
• "Resumo" - Visão geral do negócio
• "Top produtos" - Mais vendidos

📝 FICHAS:
• "Receita de X" - Ingredientes

💬 CONVERSAS:
• "Criar insumo" - Fluxo guiado
• "Criar pedido" - Passo a passo

🎤 DIGA O QUE PRECISA!`;
      
      return { action: 'help', response, success: true };
    }
  },
];

export async function processVoiceCommand(
  text: string,
  context: CommandContext,
  actions: CommandActions
): Promise<CommandResult> {
  const normalizedText = text.trim().toLowerCase();
  
  // Try each skill pattern
  for (const skill of SKILL_PATTERNS) {
    for (const pattern of skill.patterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        try {
          return await skill.handler(match, context, actions);
        } catch (error) {
          console.error('Error in skill handler:', error);
          return { action: 'error', response: 'Erro ao processar comando.', success: false };
        }
      }
    }
  }
  
  // Navigation commands
  for (const [key, module] of Object.entries(NAVEGACAO)) {
    if (normalizedText.includes(key)) {
      actions.navigate(module);
      return { action: 'navigate', response: `✅ Abrindo ${key}...`, success: true, navigate: module };
    }
  }
  
  // Fallback
  return {
    action: 'unknown',
    response: `🤔 Não entendi "${text}". Diga "ajuda" para ver os comandos disponíveis.`,
    success: false,
  };
}
