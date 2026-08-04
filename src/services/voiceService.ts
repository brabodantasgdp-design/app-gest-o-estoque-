import { Insumo, Product, Order, FichaTecnica, InvoiceScan, Tenant } from '../types';
import { insumosService, productsService, ordersService } from '../lib/database';

interface AppContext {
  insumos: Insumo[];
  products: Product[];
  orders: Order[];
  fichas: FichaTecnica[];
  invoices: InvoiceScan[];
  tenant?: Tenant;
}

interface CommandResult {
  action: string;
  response: string;
  navigate?: string;
  success: boolean;
}

// Fast local command parser (no AI needed for common commands)
function parseCommand(text: string): { action: string; params: Record<string, any> } | null {
  const lower = text.toLowerCase().trim();
  
  // NAVIGATION
  if (lower.includes('abrir') || lower.includes('ir pra') || lower.includes('mostrar') || lower.includes('mostra')) {
    if (lower.includes('dashboard') || lower.includes('painel')) return { action: 'navigate', params: { module: 'dashboard' } };
    if (lower.includes('insumo') || lower.includes('estoque') || lower.includes('matéria')) return { action: 'navigate', params: { module: 'insumos' } };
    if (lower.includes('ficha') || lower.includes('receita') || lower.includes('precificação')) return { action: 'navigate', params: { module: 'fichas' } };
    if (lower.includes('produto') || lower.includes('cardápio')) return { action: 'navigate', params: { module: 'products' } };
    if (lower.includes('pedido') || lower.includes('venda') || lower.includes('comanda')) return { action: 'navigate', params: { module: 'orders' } };
    if (lower.includes('nota') || lower.includes('fiscal') || lower.includes('nf')) return { action: 'navigate', params: { module: 'invoices' } };
    if (lower.includes('relatório') || lower.includes('lucro') || lower.includes('análise')) return { action: 'navigate', params: { module: 'reports' } };
    if (lower.includes('config') || lower.includes('configuração')) return { action: 'navigate', params: { module: 'settings' } };
    if (lower.includes('ocr') || lower.includes('leitor') || lower.includes('câmera')) return { action: 'navigate', params: { module: 'ocr' } };
  }
  
  // STOCK QUERIES
  if (lower.includes('quanto') || lower.includes('estoque') || lower.includes('tem de') || lower.includes('tenho')) {
    const productMatch = lower.match(/(?:de |do |da )(.+)/);
    if (productMatch) {
      return { action: 'query_stock', params: { product: productMatch[1].trim() } };
    }
  }
  
  // ADD STOCK
  if (lower.includes('adicionar') || lower.includes('colocar') || lower.includes('bipar') || lower.includes('entrar') || lower.includes('comprei') || lower.includes('chegou')) {
    const qtyMatch = lower.match(/(\d+)\s*(?:g|gramas|kg|quilos|ml|litros|l|un|unidades|peças?)/);
    const unitMatch = lower.match(/(\d+)\s*(g|gramas|kg|quilos|ml|litros|l|un|unidades|peças?)/);
    const productMatch = lower.match(/(?:de |do |da )(.+)/);
    
    if (qtyMatch && productMatch) {
      let qty = parseInt(qtyMatch[1]);
      let unit = 'g';
      
      if (unitMatch) {
        const u = unitMatch[2].toLowerCase();
        if (u.includes('kg') || u.includes('quilo')) { qty *= 1000; unit = 'g'; }
        else if (u.includes('l') || u.includes('litro')) { qty *= 1000; unit = 'ml'; }
        else if (u.includes('ml')) unit = 'ml';
        else if (u.includes('un') || u.includes('peça')) unit = 'un';
        else unit = 'g';
      }
      
      return { action: 'add_stock', params: { product: productMatch[1].trim(), quantity: qty, unit } };
    }
  }
  
  // REMOVE STOCK
  if (lower.includes('remover') || lower.includes('usar') || lower.includes('utilizar') || lower.includes('retirar') || lower.includes('saiu')) {
    const qtyMatch = lower.match(/(\d+)\s*(?:g|gramas|kg|quilos|ml|litros|l|un|unidades|peças?)/);
    const unitMatch = lower.match(/(\d+)\s*(g|gramas|kg|quilos|ml|litros|l|un|unidades|peças?)/);
    const productMatch = lower.match(/(?:de |do |da )(.+)/);
    
    if (qtyMatch && productMatch) {
      let qty = parseInt(qtyMatch[1]);
      let unit = 'g';
      
      if (unitMatch) {
        const u = unitMatch[2].toLowerCase();
        if (u.includes('kg') || u.includes('quilo')) { qty *= 1000; unit = 'g'; }
        else if (u.includes('l') || u.includes('litro')) { qty *= 1000; unit = 'ml'; }
        else if (u.includes('ml')) unit = 'ml';
        else if (u.includes('un') || u.includes('peça')) unit = 'un';
        else unit = 'g';
      }
      
      return { action: 'remove_stock', params: { product: productMatch[1].trim(), quantity: qty, unit } };
    }
  }
  
  // CREATE PRODUCT
  if (lower.includes('criar produto') || lower.includes('novo produto') || lower.includes('cadastrar produto')) {
    const priceMatch = lower.match(/r\$\s*(\d+(?:[.,]\d+)?)/);
    const nameMatch = lower.match(/(?:produto|criar|novo|cadastrar)\s+(.+?)(?:\s+por\s+|\s+preço\s+|\s+custa\s+|\s+R\$)/);
    
    if (nameMatch && priceMatch) {
      return { action: 'create_product', params: { name: nameMatch[1].trim(), price: parseFloat(priceMatch[1].replace(',', '.')) } };
    }
  }
  
  // CREATE ORDER
  if (lower.includes('criar pedido') || lower.includes('novo pedido') || lower.includes('abrir pedido')) {
    const qtyMatch = lower.match(/x\s*(\d+)/);
    const productMatch = lower.match(/(?:pedido|criar|novo|abrir)\s+(.+?)(?:\s+x\d|\s+para)/);
    const customerMatch = lower.match(/(?:para|cliente)\s+(.+)/);
    
    if (productMatch) {
      return { 
        action: 'create_order', 
        params: { 
          product: productMatch[1].trim(), 
          quantity: qtyMatch ? parseInt(qtyMatch[1]) : 1,
          customer: customerMatch ? customerMatch[1].trim() : 'Cliente'
        } 
      };
    }
  }
  
  // HELP
  if (lower.includes('ajuda') || lower.includes('o que você faz') || lower.includes('comandos') || lower.includes('help')) {
    return { action: 'help', params: {} };
  }
  
  // CLOSE
  if (lower.includes('fechar') || lower.includes('sair') || lower.includes('exit')) {
    return { action: 'close', params: {} };
  }
  
  return null;
}

export async function processVoiceCommand(
  transcript: string,
  context: AppContext,
  actions: {
    navigate: (module: string) => void;
    addStock: (product: string, quantity: number, unit: string) => Promise<void>;
    removeStock: (product: string, quantity: number, unit: string) => Promise<void>;
    createProduct: (name: string, price: number) => Promise<void>;
    createOrder: (customer: string, product: string, quantity: number) => Promise<void>;
    queryStock: (name: string) => { currentStock: number; unit: string } | null;
    close: () => void;
  }
): Promise<CommandResult> {
  
  // Try fast local parsing first
  const parsed = parseCommand(transcript);
  
  if (parsed) {
    try {
      switch (parsed.action) {
        case 'navigate':
          actions.navigate(parsed.params.module);
          return { action: 'navigate', response: `Abrindo ${parsed.params.module}...`, navigate: parsed.params.module, success: true };
        
        case 'query_stock': {
          const result = actions.queryStock(parsed.params.product);
          if (result) {
            const unitStr = result.unit === 'g' && result.currentStock >= 1000 
              ? `${(result.currentStock / 1000).toFixed(1)}kg`
              : `${result.currentStock}${result.unit}`;
            return { action: 'query_stock', response: `${parsed.params.product}: ${unitStr}`, success: true };
          }
          return { action: 'query_stock', response: `Não encontrei ${parsed.params.product} no estoque.`, success: false };
        }
        
        case 'add_stock':
          await actions.addStock(parsed.params.product, parsed.params.quantity, parsed.params.unit);
          return { action: 'add_stock', response: `✓ Adicionado ${parsed.params.quantity}${parsed.params.unit} de ${parsed.params.product}`, success: true };
        
        case 'remove_stock':
          await actions.removeStock(parsed.params.product, parsed.params.quantity, parsed.params.unit);
          return { action: 'remove_stock', response: `✓ Removido ${parsed.params.quantity}${parsed.params.unit} de ${parsed.params.product}`, success: true };
        
        case 'create_product':
          await actions.createProduct(parsed.params.name, parsed.params.price);
          return { action: 'create_product', response: `✓ Criado produto ${parsed.params.name} por R$${parsed.params.price}`, success: true };
        
        case 'create_order':
          await actions.createOrder(parsed.params.customer, parsed.params.product, parsed.params.quantity);
          return { action: 'create_order', response: `✓ Pedido criado: ${parsed.params.customer} - ${parsed.params.product} x${parsed.params.quantity}`, success: true };
        
        case 'help':
          return { 
            action: 'help', 
            response: `Posso fazer:
• Abrir módulos: "Abrir pedidos"
• Consultar estoque: "Quanto tenho de açúcar?"
• Adicionar: "Adicionar 100g de farinha"
• Remover: "Usar 50ml de leite"
• Criar produto: "Criar produto pizza R$25"
• Criar pedido: "Criar pedido João, 2 pizzas"`,
            success: true 
          };
        
        case 'close':
          actions.close();
          return { action: 'close', response: 'Até logo!', success: true };
        
        default:
          return { action: 'unknown', response: 'Não entendi. Pode repetir?', success: false };
      }
    } catch (error) {
      return { action: parsed.action, response: `Erro: ${error}`, success: false };
    }
  }
  
  // If local parsing fails, try AI (simplified)
  return { action: 'unknown', response: 'Não entendi. Tente: "Abrir pedidos" ou "Quanto tenho de açúcar?"', success: false };
}
