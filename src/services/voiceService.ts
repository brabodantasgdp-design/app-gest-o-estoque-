import { GoogleGenerativeAI } from '@google/generative-ai';
import { Insumo, Product, Order, OrderItem } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface VoiceCommand {
  action: 'add_stock' | 'remove_stock' | 'create_insumo' | 'query_stock' | 'create_product' | 'create_order' | 'unknown';
  product_name?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  confidence: number;
}

const INSTRUCTIONS = `
Você é um assistente de voz para um sistema de gestão de estoque e vendas.
Analise o comando do usuário e retorne um JSON com a ação a ser executada.

Comandos suportados:
1. ADICIONAR ESTOQUE: "adicionar [quantidade] [unidade] de [produto]"
   - Ex: "adicionar 100 gramas de farinha" → add_stock
   - Ex: "colocar 5 litros de leite" → add_stock
   - Ex: "bipar 10 copos descartáveis" → add_stock

2. REMOVER ESTOQUE: "remover [quantidade] [unidade] de [produto]"
   - Ex: "usar 200g de açúcar" → remove_stock
   - Ex: "retirar 5 unidades de copo" → remove_stock

3. CRIAR INSUMO: "criar insumo [nome], [quantidade] [unidade], R$[preço]"
   - Ex: "criar insumo leite condensado, 395 gramas, R$6.50" → create_insumo

4. CONSULTAR ESTOQUE: "quanto tenho de [produto]"
   - Ex: "quanto açúcar tenho?" → query_stock
   - Ex: "estoque de farinha" → query_stock

5. CRIAR PRODUTO: "criar produto [nome], preço R$[valor]"
   - Ex: "criar produto pão de queijo, preço R$5" → create_product

6. CRIAR PEDIDO: "criar pedido [cliente], [produto] [quantidade]"
   - Ex: "pedido para João, 2 pizzas" → create_order

Retorne APENAS o JSON no formato:
{
  "action": "add_stock|remove_stock|create_insumo|query_stock|create_product|create_order|unknown",
  "product_name": "nome do produto (em minúsculo)",
  "quantity": número (se aplicável),
  "unit": "unidade (g, ml, un, kg, L)",
  "price": preço (se aplicável),
  "confidence": 0.0 a 1.0
}

Regras de unidade:
- gramas → g
- quilogramas → kg
- mililitros → ml
- litros → L
- unidades → un
- peça → un
- copo → un
- caixa → un

Se não entender o comando, retorne action: "unknown" com confidence 0.
Se tiver dúvida entre ações, escolha a mais provável.
`;

export const processVoiceCommand = async (
  transcript: string,
  insumos: Insumo[],
  products: Product[],
  orders: Order[]
): Promise<VoiceCommand> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const context = `
Insumos cadastrados: ${insumos.map(i => i.name).join(', ')}
Produtos cadastrados: ${products.map(p => p.name).join(', ')}
Pedidos abertos: ${orders.length}

Comando do usuário: "${transcript}"
`;

    const result = await model.generateContent(INSTRUCTIONS + context);
    const response = result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'unknown',
        product_name: parsed.product_name?.toLowerCase(),
        quantity: parsed.quantity,
        unit: parsed.unit,
        price: parsed.price,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      };
    }
    
    return { action: 'unknown', confidence: 0 };
  } catch (error) {
    console.error('Error processing voice command:', error);
    return { action: 'unknown', confidence: 0 };
  }
};

export const executeVoiceCommand = async (
  command: VoiceCommand,
  insumos: Insumo[],
  onAddStock: (insumoName: string, quantity: number, unit: string) => Promise<void>,
  onRemoveStock: (insumoName: string, quantity: number, unit: string) => Promise<void>,
  onCreateInsumo: (name: string, quantity: number, unit: string, price: number) => Promise<void>,
  onQueryStock: (insumoName: string) => { currentStock: number; unit: string } | null,
  onCreateProduct?: (name: string, price: number) => Promise<void>
): Promise<string> => {
  switch (command.action) {
    case 'add_stock': {
      if (!command.product_name || !command.quantity || !command.unit) {
        return 'Não entendi a quantidade ou produto.';
      }
      await onAddStock(command.product_name, command.quantity, command.unit);
      return `✓ Adicionado ${command.quantity}${command.unit} de ${command.product_name}`;
    }
    
    case 'remove_stock': {
      if (!command.product_name || !command.quantity || !command.unit) {
        return 'Não entendi a quantidade ou produto.';
      }
      await onRemoveStock(command.product_name, command.quantity, command.unit);
      return `✓ Removido ${command.quantity}${command.unit} de ${command.product_name}`;
    }
    
    case 'create_insumo': {
      if (!command.product_name || !command.quantity || !command.unit || !command.price) {
        return 'Faltam dados para criar o insumo. Diga: criar inso, quantidade, unidade e preço.';
      }
      await onCreateInsumo(command.product_name, command.quantity, command.unit, command.price);
      return `✓ Criado: ${command.product_name} (${command.quantity}${command.unit} - R$${command.price})`;
    }
    
    case 'query_stock': {
      if (!command.product_name) {
        return 'Qual produto quer consultar?';
      }
      const result = onQueryStock(command.product_name);
      if (result) {
        return `Você tem ${result.currentStock}${result.unit} de ${command.product_name}`;
      }
      return `Não encontrei ${command.product_name} no estoque.`;
    }
    
    case 'create_product': {
      if (!command.product_name || !command.price) {
        return 'Faltam dados. Diga: criar produto [nome], preço [valor]';
      }
      if (onCreateProduct) {
        await onCreateProduct(command.product_name, command.price);
        return `✓ Criado produto: ${command.product_name} - R$${command.price}`;
      }
      return 'Criação de produto não disponível.';
    }
    
    case 'unknown':
    default:
      return 'Não entendi. Tente: "adicionar 100 gramas de farinha"';
  }
};
