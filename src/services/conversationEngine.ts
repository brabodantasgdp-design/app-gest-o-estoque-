export interface ConversationState {
  intent: string;
  step: number;
  data: Record<string, any>;
  awaitingInput: string;
}

interface ConversationResponse {
  state: ConversationState | null;
  message: string;
}

const INTENTS = {
  'criar insumo': { steps: ['name', 'quantity', 'unit', 'cost'] },
  'criar produto': { steps: ['name', 'price'] },
  'criar pedido': { steps: ['customer', 'product', 'quantity'] },
  'adicionar estoque': { steps: ['item', 'quantity'] },
  'remover estoque': { steps: ['item', 'quantity'] },
  'consultar': { steps: ['item'] },
  'relatório': { steps: ['type'] },
};

export function detectIntent(text: string): string | null {
  const lower = text.toLowerCase();
  
  if (/\b(criar?|cadastrar?|adicionar?|novo?)\s+(insumo|ingrediente|matéria)/i.test(lower)) return 'criar insumo';
  if (/\b(criar?|cadastrar?|novo?)\s+(produto|item|cardápio)/i.test(lower)) return 'criar produto';
  if (/\b(criar?|fazer?|novo?)\s+(pedido|comanda|ordem)/i.test(lower)) return 'criar pedido';
  if (/\b(adicionar?|adicionar?|entrar?|chegou?|receber?)\s+(estoque|estoque)/i.test(lower)) return 'adicionar estoque';
  if (/\b(remover?|tirar?|sair?|gastar?|usar?)\s+(estoque|estoque)/i.test(lower)) return 'remover estoque';
  if (/\b(consultar?|verificar?|checar?|quanto\s+tenho)/i.test(lower)) return 'consultar';
  if (/\b(relatório?|resumo?|vendas?|faturamento?)/i.test(lower)) return 'relatório';
  
  return null;
}

export function startConversation(intent: string): ConversationResponse {
  const state: ConversationState = { intent, step: 0, data: {}, awaitingInput: '' };
  
  return processConversationStep(state, '');
}

export function processConversationStep(state: ConversationState, input: string): ConversationResponse {
  const intentConfig = INTENTS[state.intent as keyof typeof INTENTS];
  if (!intentConfig) {
    return { state: null, message: 'Desculpe, não entendi o que você quer fazer.' };
  }

  // Process current step
  if (state.step > 0 && input.trim()) {
    state.data[intentConfig.steps[state.step - 1]] = input.trim();
  }

  const currentStep = intentConfig.steps[state.step];
  
  // Check if conversation is complete
  if (!currentStep) {
    return { state: null, message: generateCompletionMessage(state) };
  }

  // Ask for next input
  const prompts: Record<string, string> = {
    name: '📝 Qual o nome?',
    quantity: '📊 Qual a quantidade? (ex: 5 kg, 500g, 10 un)',
    unit: '📏 Qual a unidade? (kg, g, L, un, cx)',
    cost: '💰 Qual o custo total? (ex: R$ 50)',
    price: '🏷️ Qual o preço de venda?',
    customer: '👤 Qual o nome do cliente?',
    product: '📦 Qual o produto?',
    item: '📦 Qual item?',
    type: '📊 Qual tipo? (vendas, estoque, lucro)',
  };

  state.step++;
  
  const progress = `[${state.step}/${intentConfig.steps.length}]`;
  const prompt = prompts[currentStep] || 'Qual a informação?';
  
  let message = '';
  if (state.step === 1) {
    message = `Vamos começar! ${prompt}`;
  } else {
    message = `${progress} ${prompt}`;
    
    // Show what we have so far
    const summary = Object.entries(state.data)
      .map(([key, value]) => `• ${key}: ${value}`)
      .join('\n');
    if (summary) {
      message += `\n\nO que tenho até agora:\n${summary}`;
    }
  }

  return { state, message };
}

function generateCompletionMessage(state: ConversationState): string {
  const d = state.data;
  
  switch (state.intent) {
    case 'criar insumo':
      return `✅ Criando insumo:\n• Nome: ${d.name}\n• Quantidade: ${d.quantity} ${d.unit || 'un'}\n• Custo: R$ ${d.cost || '0'}\n\nPronto! O item foi criado no sistema.`;
    
    case 'criar produto':
      return `✅ Criando produto:\n• Nome: ${d.name}\n• Preço: R$ ${d.price}\n\nProduto adicionado ao cardápio!`;
    
    case 'criar pedido':
      return `✅ Criando pedido:\n• Cliente: ${d.customer}\n• Produto: ${d.product}\n• Quantidade: ${d.quantity || 1}\n\nPedido registrado!`;
    
    case 'adicionar estoque':
      return `✅ Adicionando ao estoque:\n• Item: ${d.item}\n• Quantidade: ${d.quantity}\n\nEstoque atualizado!`;
    
    case 'remover estoque':
      return `✅ Removendo do estoque:\n• Item: ${d.item}\n• Quantidade: ${d.quantity}\n\nEstoque atualizado!`;
    
    case 'consultar':
      return `🔍 Vou verificar "${d.item}" no sistema.`;
    
    case 'relatório':
      return `📊 Gerando relatório de ${d.type || 'vendas'}...`;
    
    default:
      return '✅ Processo concluído!';
  }
}
