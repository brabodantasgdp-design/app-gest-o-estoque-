/**
 * WhatsApp Server — Baileys (100% gratuito)
 * 
 * Roda localmente ou em VPS. Escaneie o QR code uma vez.
 * Conecta direto ao WhatsApp, sem API paga.
 * 
 * Uso: node whatsapp-server.js
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import qrcode from "qrcode-terminal";
import { Boom } from "@hapi/boom";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const TENANT_ID = process.env.DEFAULT_TENANT_ID || "tenant-1";
const BUFFER_SECONDS = parseInt(process.env.BUFFER_SECONDS || "6");

const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const buffers = {};

// ============================================================
// COMMAND PARSER (mesmo do web app)
// ============================================================

async function processCommand(text) {
  if (!supabase) return "Supabase offline.";
  const lower = text.toLowerCase().trim();

  const regMatch = lower.match(/(?:cadastrar?|cria|novo)\s+(?:insumo|item|ingrediente)?\s*(.+?)(?:\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l))?(?:\s+(?:pre[cç]o|custo|a|por)\s*r?\$?\s*(\d+[\.,]?\d*))?/);
  if (regMatch) {
    const name = regMatch[1]?.trim();
    if (!name || name.length < 2) return null;
    const rawQty = regMatch[2]; const rawUnit = regMatch[3] || "g"; const rawPrice = regMatch[4];
    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const unit = rawUnit === "kg" ? "g" : rawUnit === "l" ? "ml" : rawUnit;
    const { data: exist } = await supabase.from("insumos").select("*").eq("tenant_id", TENANT_ID).ilike("name", `%${name}%`).single();
    if (exist) return `Insumo "${exist.name}" ja existe. Codigo: ${exist.code}`;
    const qty = rawQty ? parseFloat(rawQty.replace(",", ".")) * factor : 0;
    const code = "INS-" + Date.now().toString(36).toUpperCase();
    const { error } = await supabase.from("insumos").insert({ tenant_id: TENANT_ID, code, name, category: "Geral", unit, current_stock: qty, min_stock: Math.max(1, Math.floor(qty * 0.2)), unit_cost: rawPrice ? parseFloat(rawPrice.replace(",", ".")) : 0, supplier: "", last_updated: new Date().toISOString().split("T")[0] });
    return error ? "Erro ao cadastrar." : `${name} cadastrado. ${qty}${unit} em estoque.`;
  }

  const addMatch = lower.match(/(?:adicione?|adicionar|entrou|chegou|recebi|coloca|bota)\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l)?\s+(?:do|da|de)?\s*(.+)/);
  if (addMatch) {
    const rawQty = parseFloat(addMatch[1].replace(",", ".")); const rawUnit = addMatch[2] || "g"; const name = addMatch[3]?.trim();
    if (!name) return null;
    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const { data: item } = await supabase.from("insumos").select("*").eq("tenant_id", TENANT_ID).ilike("name", `%${name}%`).single();
    if (!item) return `Nao encontrei "${name}".`;
    const ns = item.current_stock + rawQty * factor;
    await supabase.from("insumos").update({ current_stock: ns, last_updated: new Date().toISOString().split("T")[0] }).eq("id", item.id);
    return `+${rawQty * factor} de ${item.name}. Total: ${ns}${item.unit}.`;
  }

  const remMatch = lower.match(/(?:gastou?|gastei|usou?|usei|remove?|remover|tirar|baixar|consumiu|perdi)\s+(\d+[\.,]?\d*)\s*(g|ml|un|kg|l)?\s+(?:do|da|de)?\s*(.+)/);
  if (remMatch) {
    const rawQty = parseFloat(remMatch[1].replace(",", ".")); const rawUnit = remMatch[2] || "g"; const name = remMatch[3]?.trim();
    if (!name) return null;
    const factor = rawUnit === "kg" ? 1000 : rawUnit === "l" ? 1000 : 1;
    const { data: item } = await supabase.from("insumos").select("*").eq("tenant_id", TENANT_ID).ilike("name", `%${name}%`).single();
    if (!item) return `Nao encontrei "${name}".`;
    const ns = Math.max(0, item.current_stock - rawQty * factor);
    await supabase.from("insumos").update({ current_stock: ns, last_updated: new Date().toISOString().split("T")[0] }).eq("id", item.id);
    return ns <= 0 ? `${item.name} zerou!` : `-${rawQty * factor} de ${item.name}. Restam ${ns}${item.unit}.`;
  }

  const qMatch = lower.match(/(?:quanto|qual|estoque|consultar?)\s+(?:tem|tenho|est[aá])?\s*(?:de|do|da)?\s*(.+)/);
  if (qMatch) {
    const name = qMatch[1]?.trim();
    if (!name) return null;
    const { data: item } = await supabase.from("insumos").select("*").eq("tenant_id", TENANT_ID).ilike("name", `%${name}%`).single();
    return item ? `${item.name}: ${item.current_stock}${item.unit} (min: ${item.min_stock})` : `Nao encontrei "${name}".`;
  }

  if (/(?:resumo|relat[oó]rio|como\s+(?:est[aá]|t[aá])|dashboard)/i.test(lower)) {
    const { data: ins } = await supabase.from("insumos").select("*").eq("tenant_id", TENANT_ID);
    const { data: prod } = await supabase.from("products").select("*").eq("tenant_id", TENANT_ID);
    const alerts = ins ? ins.filter(i => i.current_stock <= i.min_stock).length : 0;
    return `${ins ? ins.length : 0} insumos, ${prod ? prod.length : 0} produtos. ${alerts} alertas.`;
  }

  if (/(?:alerta|estoque\s+baixo|cr[ií]tico|zerado|acabou|problema)/i.test(lower)) {
    const { data: ins } = await supabase.from("insumos").select("*").eq("tenant_id", TENANT_ID);
    const empty = ins ? ins.filter(i => i.current_stock <= 0) : [];
    const critical = ins ? ins.filter(i => i.current_stock > 0 && i.current_stock <= i.min_stock * 0.5) : [];
    const low = ins ? ins.filter(i => i.current_stock > i.min_stock * 0.5 && i.current_stock <= i.min_stock) : [];
    if (empty.length === 0 && critical.length === 0 && low.length === 0) return "Tudo ok, sem alertas.";
    return `${empty.length} zerados, ${critical.length} criticos, ${low.length} baixos.`;
  }

  return null;
}

function splitReply(text) {
  const chunks = [];
  for (const para of text.split(/\n\n+/)) {
    const t = para.trim();
    if (!t) continue;
    if (t.length <= 800) { chunks.push(t); continue; }
    const sentences = t.split(/(?<=\.)\s+/);
    let current = "";
    for (const s of sentences) {
      if ((current + s).length > 800 && current) { chunks.push(current.trim()); current = s; }
      else current += s;
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks.length > 0 ? chunks : [text];
}

// ============================================================
// BAWLS CONNECTION
// ============================================================

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed. Reconnecting:", shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === "open") {
      console.log("[WhatsApp] Conectado!");
    }
  });

  async function flushAndReply(number, texts) {
    const combined = texts.join("\n");
    console.log(`[wp] flush ${number}: ${combined.slice(0, 80)}`);

    // Try Gemini first, fallback to local parser
    let reply = "";
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (GEMINI_KEY) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
        const res = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ role: "user", parts: [{ text: combined }] }],
          config: {
            systemInstruction: "Voce e a EBD, assistente de estoque. Responda no WhatsApp. Seja breve, natural, maximo 2-3 frases. Portugues do Brasil.",
            maxOutputTokens: 300,
          },
        });
        reply = res.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
      } catch (e) { console.log("[wp] Gemini off, usando parser local"); }
    }

    if (!reply) reply = (await processCommand(combined)) || "Comandos: cadastrar, adicionar, gastar, consultar, resumo, alertas.";

    // Send presence + chunks
    await sock.sendPresenceUpdate("composing", number + "@s.whatsapp.net");
    const chunks = splitReply(reply);
    for (const chunk of chunks) {
      await new Promise(r => setTimeout(r, 800));
      await sock.sendMessage(number + "@s.whatsapp.net", { text: chunk });
    }
    await sock.sendPresenceUpdate("paused", number + "@s.whatsapp.net");
  }

  function bufferAdd(number, text) {
    if (!buffers[number]) buffers[number] = { texts: [], timer: null };
    const b = buffers[number];
    b.texts.push(text);
    if (b.timer) clearTimeout(b.timer);
    b.timer = setTimeout(() => {
      const texts = [...b.texts];
      delete buffers[number];
      flushAndReply(number, texts);
    }, BUFFER_SECONDS * 1000);
  }

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg?.message || msg.key?.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const number = msg.key.remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
    if (!text || !number) return;

    console.log(`[wp] ${number}: ${text.slice(0, 80)}`);
    await sock.readMessages([msg.key]);
    bufferAdd(number, text);
  });
}

connectToWhatsApp().catch(console.error);
