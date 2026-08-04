import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory Store Data mirroring Prisma models for live API responses
const MOCK_INVOICES = [
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
    items: []
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
    items: []
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
    items: []
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
    items: []
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse large json payloads (e.g. invoice photos)
  app.use(express.json({ limit: "25mb" }));

  // API Route: Authentication Login
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;

    if (email === "admin@retailpro.com.br" || email === "superadmin@retailpro.com") {
      return res.json({
        success: true,
        user: {
          id: "usr-superadmin",
          name: "Super Admin",
          email: email,
          role: "super_admin",
          tenantId: undefined,
          tenantName: "Painel Global SaaS",
        },
        token: "jwt_super_admin_secret_token_123"
      });
    }

    if (email === "alexandre@padariagourmet.com.br") {
      return res.json({
        success: true,
        user: {
          id: "usr-tenant-1",
          name: "Alexandre Silva",
          email: email,
          role: "store_owner",
          tenantId: "tenant-1",
          tenantName: "Padaria & Confeitaria Artesanal Gourmet",
        },
        token: "jwt_tenant_1_token_456"
      });
    }

    if (email === "mariana@cafecentral.com") {
      return res.json({
        success: true,
        user: {
          id: "usr-tenant-2",
          name: "Mariana Costa",
          email: email,
          role: "store_owner",
          tenantId: "tenant-2",
          tenantName: "Bistrô & Café Central",
        },
        token: "jwt_tenant_2_token_789"
      });
    }

    // Default owner fallback
    return res.json({
      success: true,
      user: {
        id: "usr-demo",
        name: email ? email.split("@")[0] : "Lojista Pro",
        email: email || "dono@loja.com.br",
        role: "store_owner",
        tenantId: "tenant-1",
        tenantName: "Padaria & Confeitaria Artesanal Gourmet",
      },
      token: "jwt_demo_token_000"
    });
  });

  // API Route: GET /api/invoices (with filters for date, supplier, amount, status, category, tenantId)
  app.get("/api/invoices", (req, res) => {
    const { tenantId, fornecedor, categoria, status, data, valorMin, valorMax } = req.query;

    let results = [...MOCK_INVOICES];

    // Multi-tenant scope
    if (tenantId && tenantId !== "all") {
      results = results.filter((inv) => inv.tenantId === tenantId);
    }

    if (fornecedor) {
      const q = String(fornecedor).toLowerCase();
      results = results.filter((inv) => inv.supplierName.toLowerCase().includes(q) || inv.cnpj.includes(q));
    }

    if (categoria && categoria !== "todas") {
      results = results.filter((inv) => inv.category === categoria);
    }

    if (status && status !== "todos") {
      const isProcessed = status === "processed" || status === "processadas";
      results = results.filter((inv) => inv.processed === isProcessed);
    }

    if (data) {
      results = results.filter((inv) => inv.invoiceDate.includes(String(data)));
    }

    if (valorMin) {
      results = results.filter((inv) => inv.totalAmount >= Number(valorMin));
    }

    if (valorMax) {
      results = results.filter((inv) => inv.totalAmount <= Number(valorMax));
    }

    return res.json({
      success: true,
      count: results.length,
      invoices: results
    });
  });

  // API Route: GET /api/dashboard (total notas mês, total gasto mês, top fornecedores, gastos por categoria)
  app.get("/api/dashboard", (req, res) => {
    const { tenantId = "tenant-1" } = req.query;

    let items = MOCK_INVOICES;
    if (tenantId && tenantId !== "all") {
      items = items.filter((i) => i.tenantId === tenantId);
    }

    const totalNotasMes = items.length;
    const totalGastoMes = items.reduce((acc, i) => acc + i.totalAmount, 0);

    // Top suppliers calculation
    const supplierMap: Record<string, { count: number; total: number }> = {};
    items.forEach((inv) => {
      if (!supplierMap[inv.supplierName]) {
        supplierMap[inv.supplierName] = { count: 0, total: 0 };
      }
      supplierMap[inv.supplierName].count += 1;
      supplierMap[inv.supplierName].total += inv.totalAmount;
    });

    const topFornecedores = Object.entries(supplierMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Expenses by Category
    const categoryMap: Record<string, number> = {
      alimentacao: 0,
      transporte: 0,
      servicos: 0,
      insumos: 0,
      impostos: 0,
      outros: 0,
    };

    items.forEach((inv) => {
      const cat = inv.category || 'outros';
      categoryMap[cat] = (categoryMap[cat] || 0) + inv.totalAmount;
    });

    const gastosPorCategoria = Object.entries(categoryMap).map(([category, total]) => ({
      category,
      total,
      percentage: totalGastoMes > 0 ? ((total / totalGastoMes) * 100).toFixed(1) : "0"
    }));

    return res.json({
      success: true,
      tenantId,
      metrics: {
        totalNotasMes,
        totalGastoMes,
        topFornecedores,
        gastosPorCategoria
      }
    });
  });

  // API Route: GET /api/invoices/export (generates CSV file download)
  app.get("/api/invoices/export", (req, res) => {
    const { tenantId = "tenant-1" } = req.query;

    let items = MOCK_INVOICES;
    if (tenantId && tenantId !== "all") {
      items = items.filter((i) => i.tenantId === tenantId);
    }

    let csvContent = "ID,Numero_NF,Fornecedor,CNPJ,Data,Categoria,Valor_Total,Status,Observacoes\n";

    items.forEach((inv) => {
      const statusText = inv.processed ? "Processada" : "Pendente";
      const cleanNotes = (inv.notes || "").replace(/"/g, '""');
      csvContent += `"${inv.id}","${inv.invoiceNumber}","${inv.supplierName}","${inv.cnpj}","${inv.invoiceDate}","${inv.category}",${inv.totalAmount},"${statusText}","${cleanNotes}"\n`;
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=relatorio_notas_fiscais_${tenantId}.csv`);
    return res.send(csvContent);
  });

  // API Route: OCR Invoice Scanning with Gemini
  app.post("/api/ocr-invoice", async (req, res) => {
    try {
      const { imageBase64, mimeType, sampleText } = req.body;

      if (!imageBase64 && !sampleText) {
        return res.status(400).json({ error: "Missing image or text input" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is missing, returning high-accuracy simulated OCR response.");
        return res.json({
          success: true,
          source: "simulated_fallback",
          invoiceData: {
            supplierName: "Distribuidores & Atacadista do Sul Ltda",
            cnpj: "12.345.678/0001-90",
            invoiceNumber: "NF-84920",
            invoiceDate: new Date().toISOString().split("T")[0],
            totalAmount: 1450.80,
            category: "insumos",
            notes: "Nota lida e processada automaticamente via Inteligência Artificial Gemini",
            items: [
              {
                rawName: "Farinha de Trigo Especial Tipo 1 - Bag 15kg",
                matchedInsumoName: "Farinha de Trigo Especial",
                quantity: 15000,
                unit: "g",
                unitCost: 0.0078,
                totalCost: 117.00,
                category: "Farináceos & Grãos"
              },
              {
                rawName: "Açúcar Refinado Alto Pureza - Sc 20kg",
                matchedInsumoName: "Açúcar Refinado Alto Pureza",
                quantity: 20000,
                unit: "g",
                unitCost: 0.0062,
                totalCost: 124.00,
                category: "Açúcares"
              },
              {
                rawName: "Café Arábica Especial Torrado em Grão 5kg",
                matchedInsumoName: "Café Arábica Especial Moído",
                quantity: 5000,
                unit: "g",
                unitCost: 0.048,
                totalCost: 240.00,
                category: "Bebidas & Grãos"
              }
            ]
          }
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `
Você é um especialista em OCR e análise financeira fiscal de Notas Fiscais Eletrônicas (NF-e, NFC-e) para varejo e restaurantes.
Sua tarefa é analisar a imagem/documento da nota fiscal e extrair com precisão:
1. Nome do Fornecedor / Razão Social
2. CNPJ
3. Número da Nota Fiscal
4. Data de emissão (YYYY-MM-DD)
5. Valor total bruto da nota (number)
6. Categoria geral da nota (uma das seguintes exatas: 'alimentacao', 'transporte', 'servicos', 'insumos', 'impostos', 'outros')
7. Observações livres resumidas (notes)
8. Lista detalhada de insumos / itens comprados com quantidades convertidas em g, ml ou un.
`;

      let contents: any;
      if (imageBase64) {
        contents = {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType || "image/jpeg",
              },
            },
            {
              text: "Faça a leitura OCR desta Nota Fiscal de compra e retorne os itens, valores e categoria estruturados.",
            },
          ],
        };
      } else {
        contents = `Extraia a estrutura da nota fiscal deste texto: ${sampleText}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplierName: { type: Type.STRING },
              cnpj: { type: Type.STRING },
              invoiceNumber: { type: Type.STRING },
              invoiceDate: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              notes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rawName: { type: Type.STRING },
                    matchedInsumoName: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    unitCost: { type: Type.NUMBER },
                    totalCost: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                  },
                  required: ["rawName", "matchedInsumoName", "quantity", "unit", "unitCost", "totalCost"],
                },
              },
            },
            required: ["supplierName", "invoiceNumber", "totalAmount", "items"],
          },
        },
      });

      const text = response.text || "{}";
      const invoiceData = JSON.parse(text);

      return res.json({
        success: true,
        source: "gemini_ocr",
        invoiceData,
      });
    } catch (error: any) {
      console.error("Error in OCR Invoice handler:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to process invoice OCR",
      });
    }
  });

  // Vite Middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[RetailPro] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
