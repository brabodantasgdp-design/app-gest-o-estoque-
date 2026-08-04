import { Tenant, Insumo, FichaTecnica, Product, Order, InvoiceScan } from '../types';

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'Padaria & Confeitaria Artesanal Gourmet',
    ownerName: 'Alexandre Silva',
    email: 'alexandre@padariagourmet.com.br',
    password: 'padaria123',
    cnpjStore: '12.345.678/0001-90',
    plan: 'Enterprise',
    status: 'Ativo',
    accessDaysRemaining: 320,
    expirationDate: '2027-06-19',
    maxMonthlyScans: 1000,
    scansUsedThisMonth: 142,
    createdAt: '2025-01-15',
  },
  {
    id: 'tenant-2',
    name: 'Bistrô & Café Central',
    ownerName: 'Mariana Costa',
    email: 'mariana@cafecentral.com',
    password: 'cafe123456',
    cnpjStore: '98.765.432/0001-11',
    plan: 'Pro',
    status: 'Ativo',
    accessDaysRemaining: 45,
    expirationDate: '2026-09-17',
    maxMonthlyScans: 300,
    scansUsedThisMonth: 88,
    createdAt: '2025-04-10',
  },
  {
    id: 'tenant-3',
    name: 'Empório & Conveniência Bella Vista',
    ownerName: 'Carlos Eduardo',
    email: 'carlos@bellavistaemporio.com',
    password: 'emporio123',
    cnpjStore: '45.112.334/0001-55',
    plan: 'Gratuito',
    status: 'Trial',
    accessDaysRemaining: 7,
    expirationDate: '2026-08-10',
    maxMonthlyScans: 30,
    scansUsedThisMonth: 28,
    createdAt: '2026-07-27',
  }
];

export const INITIAL_INSUMOS: Insumo[] = [
  {
    id: 'ins-1',
    tenantId: 'tenant-1',
    code: 'INS-101',
    name: 'Farinha de Trigo Especial',
    category: 'Farináceos & Grãos',
    unit: 'g',
    currentStock: 45000, // 45kg
    minStock: 10000, // 10kg
    unitCost: 0.0078, // R$ 7,80/kg
    supplier: 'Distribuidores & Atacadista do Sul',
    lastUpdated: '2026-08-01',
  },
  {
    id: 'ins-2',
    tenantId: 'tenant-1',
    code: 'INS-102',
    name: 'Açúcar Refinado Alto Pureza',
    category: 'Açúcares',
    unit: 'g',
    currentStock: 28000, // 28kg
    minStock: 8000,
    unitCost: 0.0062, // R$ 6,20/kg
    supplier: 'Usina União Alimentos',
    lastUpdated: '2026-08-02',
  },
  {
    id: 'ins-3',
    tenantId: 'tenant-1',
    code: 'INS-103',
    name: 'Café Arábica Especial Moído',
    category: 'Bebidas & Grãos',
    unit: 'g',
    currentStock: 12500, // 12.5kg
    minStock: 3000,
    unitCost: 0.048, // R$ 48,00/kg
    supplier: 'Fazenda Moka Gourmet',
    lastUpdated: '2026-08-03',
  },
  {
    id: 'ins-4',
    tenantId: 'tenant-1',
    code: 'INS-104',
    name: 'Leite Integral Culinário',
    category: 'Laticínios',
    unit: 'ml',
    currentStock: 35000, // 35L
    minStock: 10000,
    unitCost: 0.0055, // R$ 5,50/L
    supplier: 'Laticínios Vale Verde',
    lastUpdated: '2026-08-02',
  },
  {
    id: 'ins-5',
    tenantId: 'tenant-1',
    code: 'INS-105',
    name: 'Cacau em Pó 100% Holandês',
    category: 'Chocolates & Cacau',
    unit: 'g',
    currentStock: 6000, // 6kg
    minStock: 2000,
    unitCost: 0.065, // R$ 65,00/kg
    supplier: 'Chocotec Impor',
    lastUpdated: '2026-07-28',
  },
  {
    id: 'ins-6',
    tenantId: 'tenant-1',
    code: 'INS-106',
    name: 'Manteiga Culinária Sem Sal',
    category: 'Laticínios',
    unit: 'g',
    currentStock: 4200, // 4.2kg
    minStock: 1500,
    unitCost: 0.038, // R$ 38,00/kg
    supplier: 'Laticínios Vale Verde',
    lastUpdated: '2026-08-01',
  },
  {
    id: 'ins-7',
    tenantId: 'tenant-1',
    code: 'INS-107',
    name: 'Embalagem Kraft Premium EBD ElBravoDantas',
    category: 'Embalagens',
    unit: 'un',
    currentStock: 850,
    minStock: 200,
    unitCost: 1.25, // R$ 1,25 por unidade
    supplier: 'PaperBox Indústria',
    lastUpdated: '2026-07-30',
  },
  {
    id: 'ins-8',
    tenantId: 'tenant-1',
    code: 'INS-108',
    name: 'Óleo de Soja Purificado',
    category: 'Óleos & Gorduras',
    unit: 'ml',
    currentStock: 18000, // 18L
    minStock: 5000,
    unitCost: 0.0092,
    supplier: 'Atacadão Distribuidora',
    lastUpdated: '2026-07-29',
  },
  {
    id: 'ins-201',
    tenantId: 'tenant-2',
    code: 'INS-201',
    name: 'Grão Espresso Barista Blend',
    category: 'Bebidas',
    unit: 'g',
    currentStock: 8000,
    minStock: 2000,
    unitCost: 0.052,
    supplier: 'Moka Barista Supplier',
    lastUpdated: '2026-08-03',
  }
];

export const INITIAL_FICHAS: FichaTecnica[] = [
  {
    id: 'ft-1',
    tenantId: 'tenant-1',
    code: 'FT-201',
    productName: 'Café Espresso Gourmet 200ml',
    category: 'Bebidas Quentes',
    yieldQuantity: 1,
    ingredients: [
      { insumoId: 'ins-3', insumoName: 'Café Arábica Especial Moído', quantity: 18, unit: 'g', calculatedCost: 0.864 },
      { insumoId: 'ins-7', insumoName: 'Embalagem Kraft Premium EBD ElBravoDantas', quantity: 1, unit: 'un', calculatedCost: 1.25 },
    ],
    rawInsumoCost: 2.114,
    wasteMarginPercent: 5,
    operationalOverheadPercent: 15,
    taxPercent: 8,
    totalProductionCost: 2.706,
    targetProfitMarginPercent: 65,
    calculatedPrice: 7.73,
    finalPrice: 7.90,
    netProfitPerUnit: 5.194,
    profitMarginRate: 65.7,
  },
  {
    id: 'ft-2',
    tenantId: 'tenant-1',
    code: 'FT-202',
    productName: 'Bolo Supremo de Cacau 500g',
    category: 'Confeitaria',
    yieldQuantity: 1,
    ingredients: [
      { insumoId: 'ins-1', insumoName: 'Farinha de Trigo Especial', quantity: 250, unit: 'g', calculatedCost: 1.95 },
      { insumoId: 'ins-2', insumoName: 'Açúcar Refinado Alto Pureza', quantity: 180, unit: 'g', calculatedCost: 1.116 },
      { insumoId: 'ins-5', insumoName: 'Cacau em Pó 100% Holandês', quantity: 80, unit: 'g', calculatedCost: 5.20 },
      { insumoId: 'ins-6', insumoName: 'Manteiga Culinária Sem Sal', quantity: 100, unit: 'g', calculatedCost: 3.80 },
      { insumoId: 'ins-4', insumoName: 'Leite Integral Culinário', quantity: 150, unit: 'ml', calculatedCost: 0.825 },
      { insumoId: 'ins-7', insumoName: 'Embalagem Kraft Premium EBD ElBravoDantas', quantity: 1, unit: 'un', calculatedCost: 1.25 },
    ],
    rawInsumoCost: 14.241,
    wasteMarginPercent: 6,
    operationalOverheadPercent: 18,
    taxPercent: 8,
    totalProductionCost: 18.798,
    targetProfitMarginPercent: 60,
    calculatedPrice: 46.99,
    finalPrice: 48.90,
    netProfitPerUnit: 30.102,
    profitMarginRate: 61.5,
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p-1',
    tenantId: 'tenant-1',
    name: 'Classic Oversized Tee',
    category: 'T-Shirts',
    sku: 'TSH-001',
    stockQuantity: 156,
    oldPrice: 39.99,
    saleDiscountPercent: 15,
    newPrice: 33.99,
    itemsSold: 320,
    status: 'In Stock',
  },
  {
    id: 'p-2',
    tenantId: 'tenant-1',
    name: 'Premium Hoodie',
    category: 'Hoodies',
    sku: 'HD-002',
    stockQuantity: 98,
    oldPrice: 79.99,
    saleDiscountPercent: 20,
    newPrice: 63.99,
    itemsSold: 210,
    status: 'In Stock',
  },
  {
    id: 'p-3',
    tenantId: 'tenant-1',
    name: 'Slim Fit Jeans',
    category: 'Jeans',
    sku: 'JN-003',
    stockQuantity: 214,
    oldPrice: 59.99,
    saleDiscountPercent: 10,
    newPrice: 53.99,
    itemsSold: 178,
    status: 'In Stock',
  },
  {
    id: 'p-4',
    tenantId: 'tenant-1',
    name: 'Bomber Jacket',
    category: 'Jackets',
    sku: 'JKT-004',
    stockQuantity: 67,
    oldPrice: 119.99,
    saleDiscountPercent: 25,
    newPrice: 89.99,
    itemsSold: 96,
    status: 'In Stock',
  },
  {
    id: 'p-5',
    tenantId: 'tenant-1',
    name: 'Sneakers Pro',
    category: 'Shoes',
    sku: 'SH-005',
    stockQuantity: 132,
    oldPrice: 89.99,
    saleDiscountPercent: 12,
    newPrice: 79.19,
    itemsSold: 142,
    status: 'In Stock',
  },
  {
    id: 'p-6',
    tenantId: 'tenant-1',
    name: 'Café Espresso Gourmet',
    category: 'Bebidas Quentes',
    sku: 'BEB-006',
    stockQuantity: 450,
    oldPrice: 9.90,
    saleDiscountPercent: 10,
    newPrice: 7.90,
    itemsSold: 890,
    status: 'In Stock',
    fichaTecnicaId: 'ft-1',
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1',
    tenantId: 'tenant-1',
    orderNumber: '#ORD-7956',
    customerName: 'Rohan Verma',
    customerEmail: 'rohan.v@example.com',
    items: [
      { productName: 'Classic Oversized Tee', quantity: 2, unitPrice: 33.99 },
      { productName: 'Sneakers Pro', quantity: 1, unitPrice: 79.19 },
    ],
    totalAmount: 149.99,
    status: 'Delivered',
    date: '2026-08-03',
    timeAgo: '2h ago',
  },
  {
    id: 'ord-2',
    tenantId: 'tenant-1',
    orderNumber: '#ORD-7955',
    customerName: 'Ananya Singh',
    customerEmail: 'ananya.s@example.com',
    items: [
      { productName: 'Premium Hoodie', quantity: 1, unitPrice: 63.99 },
      { productName: 'Café Espresso Gourmet', quantity: 3, unitPrice: 7.90 },
    ],
    totalAmount: 89.50,
    status: 'Processing',
    date: '2026-08-03',
    timeAgo: '4h ago',
  },
  {
    id: 'ord-3',
    tenantId: 'tenant-1',
    orderNumber: '#ORD-7954',
    customerName: 'Karan Mehta',
    customerEmail: 'karan.m@example.com',
    items: [
      { productName: 'Bomber Jacket', quantity: 1, unitPrice: 89.99 },
      { productName: 'Slim Fit Jeans', quantity: 2, unitPrice: 53.99 },
    ],
    totalAmount: 199.00,
    status: 'Shipped',
    date: '2026-08-03',
    timeAgo: '6h ago',
  },
];

export const SAMPLE_INVOICES: InvoiceScan[] = [
  {
    id: 'inv-101',
    tenantId: 'tenant-1',
    supplierName: 'Distribuidores & Atacadista do Sul Ltda',
    cnpj: '12.345.678/0001-90',
    invoiceNumber: 'NF-84920',
    invoiceDate: '2026-08-03',
    totalAmount: 1450.80,
    category: 'insumos',
    notes: 'Nota fiscal referente à reposição quinzenal de farinhas e grãos gourmet.',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
    processed: true,
    processedAt: '14:20',
    items: [
      {
        rawName: 'Farinha de Trigo Especial Tipo 1 - Bag 15kg',
        matchedInsumoName: 'Farinha de Trigo Especial',
        quantity: 15000,
        unit: 'g',
        unitCost: 0.0078,
        totalCost: 117.00,
        category: 'Farináceos & Grãos'
      },
      {
        rawName: 'Açúcar Refinado Alto Pureza - Sc 20kg',
        matchedInsumoName: 'Açúcar Refinado Alto Pureza',
        quantity: 20000,
        unit: 'g',
        unitCost: 0.0062,
        totalCost: 124.00,
        category: 'Açúcares'
      },
      {
        rawName: 'Café Arábica Especial Torrado em Grão 5kg',
        matchedInsumoName: 'Café Arábica Especial Moído',
        quantity: 5000,
        unit: 'g',
        unitCost: 0.048,
        totalCost: 240.00,
        category: 'Bebidas & Grãos'
      }
    ]
  },
  {
    id: 'inv-102',
    tenantId: 'tenant-1',
    supplierName: 'Laticínios Vale Verde S.A.',
    cnpj: '98.765.432/0001-22',
    invoiceNumber: 'NF-91024',
    invoiceDate: '2026-08-02',
    totalAmount: 890.50,
    category: 'alimentacao',
    notes: 'Compra de manteiga culinária sem sal e leite integral fresco.',
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
    processed: true,
    processedAt: '10:15',
    items: [
      {
        rawName: 'Manteiga Culinária Sem Sal Galão 5kg',
        matchedInsumoName: 'Manteiga Culinária Sem Sal',
        quantity: 5000,
        unit: 'g',
        unitCost: 0.038,
        totalCost: 190.00,
        category: 'Laticínios'
      },
      {
        rawName: 'Leite Integral Culinário Caixa 50L',
        matchedInsumoName: 'Leite Integral Culinário',
        quantity: 50000,
        unit: 'ml',
        unitCost: 0.0055,
        totalCost: 275.00,
        category: 'Laticínios'
      }
    ]
  },
  {
    id: 'inv-103',
    tenantId: 'tenant-1',
    supplierName: 'Express Logística & Transporte Cargas',
    cnpj: '45.889.112/0001-33',
    invoiceNumber: 'NF-33219',
    invoiceDate: '2026-08-01',
    totalAmount: 320.00,
    category: 'transporte',
    notes: 'Frete e entrega rápida de embalagens kraft importadas.',
    processed: true,
    processedAt: '16:45',
    items: [
      {
        rawName: 'Serviço de Entrega Expressa Padaria Regional',
        matchedInsumoName: 'Serviço de Frete e Entrega',
        quantity: 1,
        unit: 'un',
        unitCost: 320.00,
        totalCost: 320.00,
        category: 'Frete'
      }
    ]
  },
  {
    id: 'inv-104',
    tenantId: 'tenant-1',
    supplierName: 'TechAssist Manutenção Industrial',
    cnpj: '33.111.222/0001-88',
    invoiceNumber: 'NF-77412',
    invoiceDate: '2026-07-28',
    totalAmount: 1250.00,
    category: 'servicos',
    notes: 'Manutenção preventiva dos fornos industriais de panificação.',
    processed: false,
    items: [
      {
        rawName: 'Manutenção Preventiva Forno Turbo',
        matchedInsumoName: 'Serviços de Terceiros',
        quantity: 1,
        unit: 'un',
        unitCost: 1250.00,
        totalCost: 1250.00,
        category: 'Manutenção'
      }
    ]
  },
  {
    id: 'inv-105',
    tenantId: 'tenant-1',
    supplierName: 'Receita Estadual / Simples Nacional',
    cnpj: '00.000.000/0001-00',
    invoiceNumber: 'DAS-202607',
    invoiceDate: '2026-07-25',
    totalAmount: 2180.40,
    category: 'impostos',
    notes: 'Guia DAS recolhimento mensal de impostos municipais e federais.',
    processed: true,
    processedAt: '09:00',
    items: [
      {
        rawName: 'Imposto Simples Nacional Unificado',
        matchedInsumoName: 'DAS Simples Nacional',
        quantity: 1,
        unit: 'un',
        unitCost: 2180.40,
        totalCost: 2180.40,
        category: 'Tributos'
      }
    ]
  },
  {
    id: 'inv-201',
    tenantId: 'tenant-2',
    supplierName: 'Moka Barista Supplier Brasil',
    cnpj: '77.888.999/0001-44',
    invoiceNumber: 'NF-11029',
    invoiceDate: '2026-08-03',
    totalAmount: 640.00,
    category: 'insumos',
    notes: 'Café especial para o Bistrô Central.',
    processed: false,
    items: [
      {
        rawName: 'Grão Espresso Barista Blend 10kg',
        matchedInsumoName: 'Grão Espresso Barista Blend',
        quantity: 10000,
        unit: 'g',
        unitCost: 0.052,
        totalCost: 520.00,
        category: 'Bebidas'
      }
    ]
  }
];
