// ============================================
// CONVERSATIONAL STATE MACHINE
// ============================================

export interface ConversationState {
  step: string;
  data: Record<string, any>;
}

export interface ConversationResponse {
  message: string;
  state: ConversationState | null; // null = finished
  action?: () => Promise<void>;
}

export function startConversation(type: string): ConversationResponse {
  switch (type) {
    case 'create_insumo':
      return {
        message: 'Vamos criar um insumo! Qual o nome?',
        state: { step: 'ask_name', data: {} },
      };
    case 'create_product':
      return {
        message: 'Vamos criar um produto! Qual o nome?',
        state: { step: 'ask_name', data: {} },
      };
    case 'create_order':
      return {
        message: 'Vamos criar um pedido! Qual o nome do cliente?',
        state: { step: 'ask_customer', data: {} },
      };
    default:
      return {
        message: 'O que você quer fazer?',
        state: null,
      };
  }
}

export function processConversationStep(
  state: ConversationState,
  input: string
): ConversationResponse {
  const lower = input.toLowerCase().trim();

  // ============================================
  // CRIAR INSUMO
  // ============================================
  if (state.step === 'ask_name') {
    return {
      message: `Beleza, ${input}! Qual a quantidade?`,
      state: { step: 'ask_quantity', data: { ...state.data, name: input } },
    };
  }

  if (state.step === 'ask_quantity') {
    const qtyMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(g|gramas|kg|quilos|ml|litros|l|un|unidades)?/);
    if (qtyMatch) {
      let qty = parseFloat(qtyMatch[1].replace(',', '.'));
      let unit = 'g';
      
      if (qtyMatch[2]) {
        const u = qtyMatch[2];
        if (u.includes('kg') || u.includes('quilo')) { qty *= 1000; unit = 'g'; }
        else if (u.includes('l') || u.includes('litro')) { qty *= 1000; unit = 'ml'; }
        else if (u.includes('ml')) unit = 'ml';
        else if (u.includes('un')) unit = 'un';
      }
      
      return {
        message: `${qty}${unit}. Qual o custo total? (ou "pular")`,
        state: { step: 'ask_cost', data: { ...state.data, quantity: qty, unit } },
      };
    }
    return {
      message: 'Não entendi a quantidade. Ex: "5 quilos", "500g", "10 unidades"',
      state,
    };
  }

  if (state.step === 'ask_cost') {
    if (lower === 'pular' || lower === 'sem custo' || lower === '0') {
      return {
        message: `✓ Criado: ${state.data.name} (${state.data.quantity}${state.data.unit})`,
        state: null,
        action: async () => {
          // Will be handled by caller
        },
      };
    }
    
    const costMatch = lower.match(/r\$\s*(\d+(?:[.,]\d+)?)/);
    if (costMatch || !isNaN(parseFloat(input.replace(',', '.')))) {
      const cost = costMatch ? parseFloat(costMatch[1].replace(',', '.')) : parseFloat(input.replace(',', '.'));
      return {
        message: `✓ Criado: ${state.data.name} - ${state.data.quantity}${state.data.unit} - R$${cost}`,
        state: null,
        action: async () => {
          // Will be handled by caller
        },
      };
    }
    
    return {
      message: 'Qual o custo? Ex: "R$50", "40 reais" ou "pular"',
      state,
    };
  }

  // ============================================
  // CRIAR PRODUTO
  // ============================================
  if (state.step === 'ask_name' && state.data.type === 'product') {
    return {
      message: `Produto ${input}! Qual o preço de venda?`,
      state: { step: 'ask_price', data: { ...state.data, name: input } },
    };
  }

  if (state.step === 'ask_price') {
    const priceMatch = lower.match(/r\$\s*(\d+(?:[.,]\d+)?)/);
    if (priceMatch || !isNaN(parseFloat(input.replace(',', '.')))) {
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : parseFloat(input.replace(',', '.'));
      return {
        message: `✓ Criado: ${state.data.name} por R$${price}`,
        state: null,
        action: async () => {},
      };
    }
    return {
      message: 'Qual o preço? Ex: "R$25", "30 reais"',
      state,
    };
  }

  // ============================================
  // CRIAR PEDIDO
  // ============================================
  if (state.step === 'ask_customer') {
    return {
      message: `Pedido para ${input}! Qual o produto?`,
      state: { step: 'ask_product', data: { ...state.data, customer: input } },
    };
  }

  if (state.step === 'ask_product') {
    return {
      message: `${input}! Quantas unidades?`,
      state: { step: 'ask_quantity', data: { ...state.data, product: input } },
    };
  }

  if (state.step === 'ask_quantity' && state.data.customer) {
    const qtyMatch = lower.match(/(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    
    return {
      message: `✓ Pedido: ${state.data.customer} - ${state.data.product} x${qty}`,
      state: null,
      action: async () => {},
    };
  }

  return {
    message: 'Não entendi. Pode repetir?',
    state,
  };
}

// Detect intent from free text
export function detectIntent(text: string): string | null {
  const lower = text.toLowerCase();
  
  if (lower.includes('criar insumo') || lower.includes('novo insumo') || lower.includes('cadastrar insumo') || lower.includes('adicionar insumo')) {
    return 'create_insumo';
  }
  if (lower.includes('criar produto') || lower.includes('novo produto') || lower.includes('cadastrar produto')) {
    return 'create_product';
  }
  if (lower.includes('criar pedido') || lower.includes('novo pedido') || lower.includes('abrir pedido')) {
    return 'create_order';
  }
  
  return null;
}
