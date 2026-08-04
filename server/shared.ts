export interface MockInvoice {
  id: string;
  tenantId: string;
  supplierName: string;
  cnpj: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  category: string;
  notes: string;
  imageUrl?: string;
  processed: boolean;
  processedAt?: string;
  items: Array<{
    rawName: string;
    matchedInsumoName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    category: string;
  }>;
}

export const MOCK_INVOICES: MockInvoice[] = [
  {
    id: 'inv-101', tenantId: 'tenant-1',
    supplierName: 'Distribuidores & Atacadista do Sul Ltda',
    cnpj: '12.345.678/0001-90', invoiceNumber: 'NF-84920',
    invoiceDate: '2026-08-03', totalAmount: 1450.80, category: 'insumos',
    notes: 'Nota fiscal referente à reposição quinzenal de farinhas e grãos gourmet.',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
    processed: true, processedAt: '14:20',
    items: [
      { rawName: 'Farinha de Trigo Especial Tipo 1 - Bag 15kg', matchedInsumoName: 'Farinha de Trigo Especial', quantity: 15000, unit: 'g', unitCost: 0.0078, totalCost: 117.00, category: 'Farináceos & Grãos' },
      { rawName: 'Açúcar Refinado Alto Pureza - Sc 20kg', matchedInsumoName: 'Açúcar Refinado Alto Pureza', quantity: 20000, unit: 'g', unitCost: 0.0062, totalCost: 124.00, category: 'Açúcares' },
      { rawName: 'Café Arábica Especial Torrado em Grão 5kg', matchedInsumoName: 'Café Arábica Especial Moído', quantity: 5000, unit: 'g', unitCost: 0.048, totalCost: 240.00, category: 'Bebidas & Grãos' },
    ],
  },
  {
    id: 'inv-102', tenantId: 'tenant-1',
    supplierName: 'Laticínios Vale Verde S.A.',
    cnpj: '98.765.432/0001-22', invoiceNumber: 'NF-91024',
    invoiceDate: '2026-08-02', totalAmount: 890.50, category: 'alimentacao',
    notes: 'Compra de manteiga culinária sem sal e leite integral fresco.',
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
    processed: true, processedAt: '10:15',
    items: [
      { rawName: 'Manteiga Culinária Sem Sal Galão 5kg', matchedInsumoName: 'Manteiga Culinária Sem Sal', quantity: 5000, unit: 'g', unitCost: 0.038, totalCost: 190.00, category: 'Laticínios' },
    ],
  },
  {
    id: 'inv-103', tenantId: 'tenant-1',
    supplierName: 'Express Logística & Transporte Cargas',
    cnpj: '45.889.112/0001-33', invoiceNumber: 'NF-33219',
    invoiceDate: '2026-08-01', totalAmount: 320.00, category: 'transporte',
    notes: 'Frete e entrega rápida de embalagens kraft importadas.',
    processed: true, processedAt: '16:45', items: [],
  },
  {
    id: 'inv-104', tenantId: 'tenant-1',
    supplierName: 'TechAssist Manutenção Industrial',
    cnpj: '33.111.222/0001-88', invoiceNumber: 'NF-77412',
    invoiceDate: '2026-07-28', totalAmount: 1250.00, category: 'servicos',
    notes: 'Manutenção preventiva dos fornos industriais de panificação.',
    processed: false, items: [],
  },
  {
    id: 'inv-105', tenantId: 'tenant-1',
    supplierName: 'Receita Estadual / Simples Nacional',
    cnpj: '00.000.000/0001-00', invoiceNumber: 'DAS-202607',
    invoiceDate: '2026-07-25', totalAmount: 2180.40, category: 'impostos',
    notes: 'Guia DAS recolhimento mensal de impostos municipais e federais.',
    processed: true, processedAt: '09:00', items: [],
  },
  {
    id: 'inv-201', tenantId: 'tenant-2',
    supplierName: 'Moka Barista Supplier Brasil',
    cnpj: '77.888.999/0001-44', invoiceNumber: 'NF-11029',
    invoiceDate: '2026-08-03', totalAmount: 640.00, category: 'insumos',
    notes: 'Café especial para o Bistrô Central.',
    processed: false, items: [],
  },
];
