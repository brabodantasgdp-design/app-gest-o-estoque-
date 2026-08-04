import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

function getAI(): GoogleGenAI | null {
  if (!GEMINI_KEY) return null;
  return new GoogleGenAI({ apiKey: GEMINI_KEY });
}

function getMockOCR() {
  return {
    supplierName: "Distribuidora Exemplo",
    cnpj: "12.345.678/0001-90",
    invoiceNumber: `NF-${Math.floor(10000 + Math.random() * 90000)}`,
    invoiceDate: new Date().toISOString().split("T")[0],
    totalAmount: 0,
    category: "insumos",
    notes: "OCR não disponível offline",
    items: [],
  };
}

export async function processOCR(base64Data: string, mimeType: string = 'image/jpeg'): Promise<any> {
  const ai = getAI();
  if (!ai) {
    return getMockOCR();
  }

  const systemInstruction = `
Você é um especialista em OCR de Notas Fiscais Eletrônicas (NF-e) para varejo.
Extraia COM PRECISÃO TODOS os dados da nota fiscal.

CAMPOS OBRIGATÓRIOS:
1. supplierName - Nome/Razão Social do Fornecedor
2. cnpj - CNPJ (formato: XX.XXX.XXX/XXXX-XX)
3. invoiceNumber - Número da NF
4. invoiceDate - Data (YYYY-MM-DD)
5. totalAmount - Valor total (number)
6. category: 'alimentacao', 'transporte', 'servicos', 'insumos', 'impostos', 'outros'
7. notes - Observações resumidas

ITENS DA NOTA (extrair TODOS):
Para CADA item: rawName, matchedInsumoName, quantity (convertido para g/ml/un), unit, unitCost, totalCost, category

REGRAS: 1kg=1000g, 1L=1000ml, unitCost = totalCost/quantity
Retorne JSON válido.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Analise esta Nota Fiscal. Extraia TODOS os dados e itens. Retorne JSON." },
        ],
      },
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

    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.error('OCR Gemini error:', error);
    return getMockOCR();
  }
}
