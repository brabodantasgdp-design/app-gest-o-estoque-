/**
 * Vercel Serverless API — mínimo essencial.
 * Rotas que funcionam via fetch direto do cliente.
 */
import express from "express";

const app = express();
app.use(express.json({ limit: "25mb" }));

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// Gemini agent proxy (unica rota que precisa de servidor)
app.post("/api/ebdAi/agent", async (req, res) => {
  try {
    const { contents, systemInstruction, tools } = req.body;
    if (!contents) return res.status(400).json({ error: "contents required" });
    if (!GEMINI_KEY) return res.json({ text: "", functionCalls: [] });
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const response = await ai.models.generateContent({ model: "gemini-2.0-flash", contents, config: { systemInstruction, tools, temperature: 0.7, maxOutputTokens: 512 } });
    const parts = response.candidates?.[0]?.content?.parts || [];
    return res.json({ success: true, text: parts.filter(p => p.text).map(p => p.text).join(""), functionCalls: parts.filter(p => p.functionCall).map(p => p.functionCall) });
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

export default app;
