import React, { useEffect, useRef, useCallback } from "react";
import { createLiveAgent, type LiveAgent, type LiveAgentState, type SupabaseContext } from "../services/liveAgent";
import { insumosService, productsService } from "../lib/database";
import { Mic, Loader2, Volume2, Send, MessageSquare, X, Sparkles, Check, AlertTriangle, Zap } from "lucide-react";

interface Props {
  tenantId: string | null;
  onRefresh: () => void;
}

interface ChatMsg {
  role: "user" | "ebd";
  text: string;
  time: number;
}

export const LiveAgentIndicator: React.FC<Props> = ({ tenantId, onRefresh }) => {
  const agentRef = useRef<LiveAgent | null>(null);
  const startedRef = useRef(false);
  const [state, setState] = React.useState<LiveAgentState>({
    status: "idle", transcript: "", response: "", lastAction: "", error: null, proactiveAlert: null,
  });
  const [open, setOpen] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [showAlert, setShowAlert] = React.useState(false);
  const alertTimer = useRef<ReturnType<typeof setTimeout>>();
  const messagesEnd = useRef<HTMLDivElement | null>(null);

  const buildContext = useCallback((): SupabaseContext | null => {
    if (!tenantId) return null;
    return {
      tenantId,
      insumosCreate: (d: any) => insumosService.create(d),
      insumosFindByName: async (name: string, tid: string) => {
        const all = await insumosService.getByTenant(tid);
        return all.find((i: any) => i.name.toLowerCase().includes(name.toLowerCase())) || null;
      },
      insumosUpdate: (id: string, d: any) => insumosService.update(id, d),
      insumosGetAll: (tid: string) => insumosService.getByTenant(tid),
      productsGetAll: (tid: string) => productsService.getByTenant(tid),
      productsCreate: (d: any) => productsService.create(d),
    };
  }, [tenantId]);

  useEffect(() => {
    if (startedRef.current || !tenantId) return;
    startedRef.current = true;
    const ctx = buildContext();
    if (!ctx) return;
    const agent = createLiveAgent({ context: ctx, onState: setState, useAI: false });
    agentRef.current = agent;
    agent.start();
    return () => { agent.stop(); startedRef.current = false; };
  }, [tenantId]);

  useEffect(() => { if (!startedRef.current) return; const ctx = buildContext(); if (ctx && agentRef.current) agentRef.current.setContext(ctx); }, [tenantId]);

  useEffect(() => { if (state.lastAction) { const t = setTimeout(onRefresh, 600); return () => clearTimeout(t); } }, [state.lastAction]);

  useEffect(() => {
    if (state.proactiveAlert) { setShowAlert(true); if (alertTimer.current) clearTimeout(alertTimer.current); alertTimer.current = setTimeout(() => setShowAlert(false), 10000); }
  }, [state.proactiveAlert]);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text || !agentRef.current) return;
    setMessages((m) => [...m, { role: "user", text, time: Date.now() }]);
    setChatInput("");

    // Capturar resposta
    const origUpdate = agentRef.current.state;
    const checkResponse = () => {
      const s = agentRef.current?.state;
      if (s?.response) {
        setMessages((m) => [...m, { role: "ebd", text: s.response!, time: Date.now() }]);
        return true;
      }
      return false;
    };

    await agentRef.current.sendText(text);

    // Pequeno delay pra resposta chegar
    let attempts = 0;
    while (attempts < 50) {
      if (checkResponse()) break;
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
    if (!checkResponse()) {
      const s = agentRef.current.state;
      setMessages((m) => [...m, { role: "ebd", text: s.response || s.error || "Processando...", time: Date.now() }]);
    }
  };

  const toggleMic = async () => {
    const agent = agentRef.current;
    if (!agent) return;
    if (state.status === "listening") {
      agent.stopListening();
    } else {
      await agent.startListening();
    }
    // Quando o audio terminar, captura a resposta
    setTimeout(async () => {
      let attempts = 0;
      while (attempts < 80) {
        const s = agentRef.current?.state;
        if (s?.response) {
          setMessages((m) => [...m, { role: "ebd", text: s.response!, time: Date.now() }]);
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
    }, 1000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-1.5">
      {/* Proactive alert */}
      {showAlert && state.proactiveAlert && (
        <div className="bg-red-950/95 backdrop-blur-md border border-red-700/50 rounded-xl px-3 py-2 max-w-[280px] text-[11px] text-red-300 shadow-2xl">
          <span className="font-extrabold text-red-400 text-[10px] uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Alerta</span>
          <p className="mt-0.5 leading-tight">{state.proactiveAlert}</p>
        </div>
      )}

      {/* Mini Chat Window */}
      {open && (
        <div className="bg-[#0B0B0C] border border-zinc-800 rounded-2xl shadow-2xl w-[340px] h-[420px] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-zinc-900/80 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-black" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-white">EBD</span>
                <span className="text-[10px] text-zinc-500 ml-1.5 font-mono uppercase">assistente</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
            {messages.length === 0 && (
              <div className="text-center text-zinc-600 mt-16">
                <Zap className="w-8 h-8 mx-auto mb-2 text-amber-500/40" />
                <p className="text-[11px]">Assistente inteligente</p>
                <p className="text-[10px] mt-1">Cadastre, consulte, atualize — tudo por texto.</p>
                <div className="mt-3 space-y-1 text-[10px] text-zinc-500">
                  <p>"cadastrar farinha 500g"</p>
                  <p>"adicionar 5kg de açúcar"</p>
                  <p>"quanto tem de café"</p>
                  <p>"resumo"</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl ${
                  m.role === "user"
                    ? "bg-amber-500/15 text-amber-100 rounded-br-sm"
                    : "bg-zinc-900 text-zinc-300 rounded-bl-sm border border-zinc-800"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {state.status === "thinking" && (
              <div className="flex justify-start">
                <div className="bg-zinc-900 text-zinc-500 px-3 py-2 rounded-xl rounded-bl-sm border border-zinc-800 text-[10px] italic">pensando...</div>
              </div>
            )}
            {state.status === "listening" && (
              <div className="flex justify-start">
                <div className="bg-amber-500/10 text-amber-400 px-3 py-2 rounded-xl rounded-bl-sm border border-amber-500/20 text-[10px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> ouvindo...
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <div className="border-t border-zinc-800 p-2.5 flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleMic}
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
                state.status === "listening" ? "bg-amber-500/20 border border-amber-500/40" : "bg-zinc-800 border border-zinc-700/50 hover:border-amber-500/30"
              }`}
              title="Falar com microfone"
            >
              {state.status === "listening" ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" /> : <Mic className="w-3.5 h-3.5 text-zinc-400" />}
            </button>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder='Ex: "cadastrar farinha 500g"'
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/40 placeholder-zinc-600"
              disabled={state.status === "thinking"}
            />
            <button onClick={handleSend} disabled={state.status === "thinking" || !chatInput.trim()} className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center cursor-pointer hover:bg-amber-500/20 disabled:opacity-30 flex-shrink-0">
              <Send className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shadow-xl border transition-all ${
          open ? "bg-amber-500/20 border-amber-500/40" : "bg-zinc-900/80 border-zinc-700/40 hover:border-amber-500/30"
        }`}
        title="EBD Assistente"
      >
        {open
          ? <X className="w-4 h-4 text-amber-400" />
          : <Sparkles className="w-4 h-4 text-zinc-400" />
        }
      </button>
    </div>
  );
};
