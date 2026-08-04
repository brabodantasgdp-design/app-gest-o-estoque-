import { GoogleGenerativeAI } from '@google/generative-ai';
import { Insumo, Product, Order, FichaTecnica, InvoiceScan, Tenant } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface VoiceCommand {
  action: string;
  target?: string;
  params?: Record<string, any>;
  response?: string;
  confidence: number;
}

interface AppContext {
  insumos: Insumo[];
  products: Product[];
  orders: Order[];
  fichas: FichaTecnica[];
  invoices: InvoiceScan[];
  tenant?: Tenant;
}

const JARVIS_PROMPT = `
Você é o EBD AI, um assistente inteligente inspirado no JARVIS do Homem de Ferro.
Seu papel é controlar o sistema de gestão por voz de forma inteligente e natural.

## Contexto do Sistema
O sistema tem os seguintes módulos:
- **Dashboard**: Visão geral financeira
- **Insumos**: Matérias-primas e estoque
- **Fichas Técnicas**: Receitas e precificação
- **Produtos**: Produtos finais para venda
- **Pedidos**: Vendas e pedidos
- **OCR**: Leitura de notas fiscais
- **Relatórios**: Análises e lucros
- **Configurações**: Config do sistema

## Comandos Suportados

### NAVEGAÇÃO
- "Abrir [módulo]" / "Ir pra [módulo]" / "Mostrar [módulo]"
  → navigate: { module: "dashboard|insumos|fichas|products|orders|ocr|reports|settings" }

### CONSULTAS
- "Como estão as vendas?" / "Resumo do dia"
  → query: { type: "dashboard_summary" }
- "Quanto tenho de [produto]?" / "Estoque de [produto]"
  → query: { type: "stock", product: "nome" }
- "Qual o lucro?" / "Quanto ganhei?"
  → query: { type: "profit" }
- "Lista de [módulo]" / "Mostrar todos os [módulo]"
  → query: { type: "list", module: "insumos|products|orders" }

### AÇÕES EM INSUMOS
- "Adicionar [qtd] [un] de [nome]"
  → add_stock: { product: "nome", quantity: 100, unit: "g" }
- "Remover [qtd] [un] de [nome]"
  → remove_stock: { product: "nome", quantity: 100, unit: "g" }
- "Criar inso [nome], [qtd] [un], R$[preço]"
  → create_insumo: { name: "nome", quantity: 100, unit: "g", price: 10 }
- "Deletar insumo [nome]"
  → delete_insumo: { name: "nome" }

### AÇÕES EM PRODUTOS
- "Criar produto [nome], preço R$[valor]"
  → create_product: { name: "nome", price: 25 }
- "Mudar preço de [nome] pra R$[valor]"
  → update_product: { name: "nome", price: 25 }
- "Deletar produto [nome]"
  → delete_product: { name: "nome" }

### AÇÕES EM PEDIDOS
- "Criar pedido [cliente], [produto] x[qtd]"
  → create_order: { customer: "nome", product: "produto", quantity: 2 }
- "Fechar pedido [número]"
  → close_order: { order_id: "numero" }
- "Cancelar pedido [número]"
  → cancel_order: { order_id: "numero" }

### AÇÕES EM FICHAS TÉCNICAS
- "Criar ficha [nome]"
  → create_ficha: { name: "nome" }
- "Adicionar [insumo] na ficha [nome]"
  → add_ingredient: { ficha: "nome", insumo: "insumo", quantity: 100 }

### RELATÓRIOS
- "Gerar relatório de vendas"
  → report: { type: "sales" }
- "Relatório de custos"
  → report: { type: "costs" }
- "Lucro do mês"
  → report: { type: "monthly_profit" }

### INSIGHTS
- "O que posso melhorar?"
  → insight: { type: "suggestions" }
- "Qual produto mais vende?"
  → insight: { type: "best_selling" }
- "Tem algo errado?"
  → insight: { type: "alerts" }

### CONTROLE
- "Fechar" / "Sair"
  → close: {}
- "Ajuda" / "O que você faz?"
  → help: {}

## Respostas
Sempre responda de forma natural e objetiva.
Use o contexto dos dados para dar insights úteis.
Se não entender, peça para repetir.
Seja proativo - se detectar algo importante, avise.

## Formato de Resposta
Retorne APENAS um JSON válido:
{
  "action": "tipo_da_acao",
  "target": "alvo_se_aplicavel",
  "params": { "parametros": "valores" },
  "response": "resposta natural pra falar",
  "confidence": 0.0_a_1.0
}
`;

export const processVoiceCommand = async (
  transcript: string,
  context: AppContext
): Promise<VoiceCommand> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const contextData = `
## Estado Atual do Sistema

### Insumos (${context.insumos.length} cadastrados)
${context.insumos.slice(0, 20).map(i => `- ${i.name}: ${i.currentStock}${i.unit} (mín: ${i.minStock}${i.unit})`).join('\n')}

### Produtos (${context.products.length} cadastrados)
${context.products.slice(0, 20).map(p => `- ${p.name}: R$${p.price}`).join('\n')}

### Pedidos Abertos
${context.orders.length > 0 ? context.orders.slice(0, 10).map(o => `- Pedido #${o.id}: ${o.customerName} - R$${o.totalAmount}`).join('\n') : 'Nenhum pedido'}

### Fichas Técnicas (${context.fichas.length})
${context.fichas.slice(0, 10).map(f => `- ${f.name}: R$${f.totalCost}/porção`).join('\n')}

### Tenant Atual
${context.tenant ? `${context.tenant.name} (Plano: ${context.tenant.plan})` : 'Não definido'}

### Comando do Usuário
"${transcript}"
`;

    const result = await model.generateContent(JARVIS_PROMPT + contextData);
    const response = result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'unknown',
        target: parsed.target,
        params: parsed.params || {},
        response: parsed.response,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      };
    }
    
    return { 
      action: 'unknown', 
      response: 'Não entendi. Pode repetir?',
      confidence: 0 
    };
  } catch (error) {
    console.error('Error processing voice command:', error);
    return { 
      action: 'error', 
      response: 'Erro ao processar. Tente novamente.',
      confidence: 0 
    };
  }
};

export const executeVoiceCommand = async (
  command: VoiceCommand,
  context: AppContext,
  actions: {
    navigate: (module: string) => void;
    addStock: (product: string, quantity: number, unit: string) => Promise<void>;
    removeStock: (product: string, quantity: number, unit: string) => Promise<void>;
    createInsumo: (name: string, quantity: number, unit: string, price: number) => Promise<void>;
    deleteInsumo: (name: string) => Promise<void>;
    createProduct: (name: string, price: number) => Promise<void>;
    updateProduct: (name: string, price: number) => Promise<void>;
    deleteProduct: (name: string) => Promise<void>;
    createOrder: (customer: string, product: string, quantity: number) => Promise<void>;
    queryStock: (name: string) => { currentStock: number; unit: string } | null;
    getDashboardSummary: () => any;
    close: () => void;
  }
): Promise<string> => {
  const { action, target, params, response } = command;

  try {
    switch (action) {
      // NAVEGAÇÃO
      case 'navigate':
        if (target) {
          actions.navigate(target);
          return response || `Abrindo ${target}...`;
        }
        return 'Qual módulo deseja abrir?';

      // CONSULTAS
      case 'query':
        if (params?.type === 'stock') {
          const result = actions.queryStock(params.product || '');
          if (result) {
            return response || `Você tem ${result.currentStock}${result.unit} de ${params.product}`;
          }
          return `Não encontrei ${params.product} no estoque.`;
        }
        if (params?.type === 'dashboard_summary') {
          const summary = actions.getDashboardSummary();
          return response || `Resumo: ${summary.totalNotas} notas, total gasto R$${summary.totalGasto}`;
        }
        return response || 'Consultando...';

      // INSUMOS
      case 'add_stock':
        if (params?.product && params?.quantity && params?.unit) {
          await actions.addStock(params.product, params.quantity, params.unit);
          return response || `✓ Adicionado ${params.quantity}${params.unit} de ${params.product}`;
        }
        return 'Preciso do nome, quantidade e unidade.';

      case 'remove_stock':
        if (params?.product && params?.quantity && params?.unit) {
          await actions.removeStock(params.product, params.quantity, params.unit);
          return response || `✓ Removido ${params.quantity}${params.unit} de ${params.product}`;
        }
        return 'Preciso do nome, quantidade e unidade.';

      case 'create_insumo':
        if (params?.name && params?.quantity && params?.unit && params?.price) {
          await actions.createInsumo(params.name, params.quantity, params.unit, params.price);
          return response || `✓ Criado insumo: ${params.name}`;
        }
        return 'Preciso: nome, quantidade, unidade e preço.';

      case 'delete_insumo':
        if (params?.name) {
          await actions.deleteInsumo(params.name);
          return response || `✓ Insumo ${params.name} removido`;
        }
        return 'Qual insumo deseja excluir?';

      // PRODUTOS
      case 'create_product':
        if (params?.name && params?.price) {
          await actions.createProduct(params.name, params.price);
          return response || `✓ Criado produto: ${params.name} por R$${params.price}`;
        }
        return 'Preciso do nome e preço.';

      case 'update_product':
        if (params?.name && params?.price) {
          await actions.updateProduct(params.name, params.price);
          return response || `✓ Preço de ${params.name} atualizado para R$${params.price}`;
        }
        return 'Preciso do nome e novo preço.';

      case 'delete_product':
        if (params?.name) {
          await actions.deleteProduct(params.name);
          return response || `✓ Produto ${params.name} removido`;
        }
        return 'Qual produto deseja excluir?';

      // PEDIDOS
      case 'create_order':
        if (params?.customer && params?.product && params?.quantity) {
          await actions.createOrder(params.customer, params.product, params.quantity);
          return response || `✓ Pedido criado: ${params.customer} - ${params.product} x${params.quantity}`;
        }
        return 'Preciso: cliente, produto e quantidade.';

      // FECHAR
      case 'close':
        actions.close();
        return 'Até logo!';

      // HELP
      case 'help':
        return `Posso ajudar com:
• Navegar: "Abrir pedidos"
• Estoque: "Adicionar 100g de farinha"
• Produtos: "Criar pizza por R$25"
• Pedidos: "Criar pedido João, 2 pizzas"
• Consultas: "Quanto tenho de açúcar?"
• Relatórios: "Gerar relatório de vendas"
• Insights: "O que posso melhorar?"`;

      // INSIGHTS
      case 'insight':
        if (params?.type === 'suggestions') {
          const lowStock = context.insumos.filter(i => i.currentStock <= i.minStock);
          if (lowStock.length > 0) {
            return `Atenção: ${lowStock.map(i => i.name).join(', ')} estão com estoque baixo!`;
          }
          return 'Tudo parece estar em ordem! Que tal verificar os relatórios?';
        }
        return response || 'Analisando seus dados...';

      default:
        return response || 'Não entendi. Pode repetir?';
    }
  } catch (error) {
    console.error('Error executing command:', error);
    return `Erro ao executar: ${error}`;
  }
};
