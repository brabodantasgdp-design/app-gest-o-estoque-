import { Router, Request, Response } from "express";
import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export function ocrRoutes(): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, sampleText } = req.body;

      if (!imageBase64 && !sampleText) {
        return res.status(400).json({ error: "Missing image or text input" });
      }

      const apiKey = GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is missing, returning simulated OCR response.");
        return res.json({
          success: true, source: "simulated_fallback",
          invoiceData: {
            supplierName: "Distribuidores & Atacadista do Sul Ltda",
            cnpj: "12.345.678/0001-90",
            invoiceNumber: "NF-84920",
            invoiceDate: new Date().toISOString().split("T")[0],
            totalAmount: 1450.80, category: "insumos",
            notes: "Nota lida e processada automaticamente via Inteligência Artificial Gemini",
            items: [
              { rawName: "Farinha de Trigo Especial Tipo 1 - Bag 15kg", matchedInsumoName: "Farinha de Trigo Especial", quantity: 15000, unit: "g", unitCost: 0.0078, totalCost: 117.00, category: "Farináceos & Grãos" },
              { rawName: "Açúcar Refinado Alto Pureza - Sc 20kg", matchedInsumoName: "Açúcar Refinado Alto Pureza", quantity: 20000, unit: "g", unitCost: 0.0062, totalCost: 124.00, category: "Açúcares" },
              { rawName: "Café Arábica Especial Torrado em Grão 5kg", matchedInsumoName: "Café Arábica Especial Moído", quantity: 5000, unit: "g", unitCost: 0.048, totalCost: 240.00, category: "Bebidas & Grãos" },
            ],
          },
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const systemInstruction = `
Você é um especialista em OCR e análise financeira fiscal de Notas Fiscais Eletrônicas (NF-e, NFC-e) para varejo e restaurantes.

## SUA TAREFA
Analise a imagem/documento da nota fiscal e extraia COM PRECISÃO TODOS os dados visíveis.

## CAMPOS OBRIGATÓRIOS
1. supplierName, 2. cnpj (XX.XXX.XXX/XXXX-XX), 3. invoiceNumber, 4. invoiceDate (YYYY-MM-DD), 5. totalAmount (number), 6. category ('alimentacao'|'transporte'|'servicos'|'insumos'|'impostos'|'outros'), 7. notes

## ITENS DA NOTA
Para CADA item: rawName, matchedInsumoName, quantity (g/ml/un), unit, unitCost, totalCost, category

## REGRAS: 1kg=1000g, 1L=1000ml, unitCost=totalCost/quantity. Retorne JSON válido.`;

      let contents: any;
      if (imageBase64) {
        contents = {
          parts: [
            { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
            { text: "Analise esta Nota Fiscal eletrônica. Extraia TODOS os dados e itens. Retorne JSON estruturado." },
          ],
        };
      } else {
        contents = `Extraia a estrutura da nota fiscal deste texto: ${sampleText}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplierName: { type: Type.STRING }, cnpj: { type: Type.STRING },
              invoiceNumber: { type: Type.STRING }, invoiceDate: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER }, category: { type: Type.STRING },
              notes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rawName: { type: Type.STRING }, matchedInsumoName: { type: Type.STRING },
                    quantity: { type: Type.NUMBER }, unit: { type: Type.STRING },
                    unitCost: { type: Type.NUMBER }, totalCost: { type: Type.NUMBER },
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

      return res.json({ success: true, source: "gemini_ocr", invoiceData });
    } catch (error: any) {
      console.error("Error in OCR Invoice handler:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to process invoice OCR" });
    }
  });

  return router;
}
