import React, { useEffect, useRef, useCallback } from "react";
import { createLiveAgent, type LiveAgent, type LiveAgentState, type SupabaseContext } from "../services/liveAgent";
import { insumosService, productsService } from "../lib/database";
import { Mic, Loader2, Volume2, Send, MessageSquare } from "lucide-react";

interface Props {
  tenantId: string | null;
  onRefresh: () => void;
}

export const LiveAgentIndicator: React.FC<Props> = ({ tenantId, onRefresh }) => {
  const agentRef = useRef<LiveAgent | null>(null);
  const startedRef = useRef(false);
  const [state, setState] = React.useState<LiveAgentState>({
    status: "idle", transcript: "", response: "", lastAction: "", error: null, proactiveAlert: null,
  });
  const [showResponse, setShowResponse] = React.useState(false);
  const [showAlert, setShowAlert] = React.useState(false);
  const [showChat, setShowChat] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");
  const responseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  // Init once
  useEffect(() => {
    if (startedRef.current || !tenantId) return;
    startedRef.current = true;
    const ctx = buildContext();
    if (!ctx) return;
    const agent = createLiveAgent({ context: ctx, onState: setState });
    agentRef.current = agent;
    agent.start();
    return () => { agent.stop(); startedRef.current = false; };
  }, [tenantId]);

  useEffect(() => {
    if (!startedRef.current) return;
    const ctx = buildContext();
    if (ctx && agentRef.current) agentRef.current.setContext(ctx);
  }, [tenantId]);

  // Show response toast
  useEffect(() => {
    if (state.response) {
      setShowResponse(true);
      if (responseTimer.current) clearTimeout(responseTimer.current);
      responseTimer.current = setTimeout(() => setShowResponse(false), 8000);
    }
    if (state.lastAction) {
      const t = setTimeout(onRefresh, 600);
      return () => clearTimeout(t);
    }
  }, [state.response, state.lastAction]);

  // Show alert toast
  useEffect(() => {
    if (state.proactiveAlert) {
      setShowAlert(true);
      if (alertTimer.current) clearTimeout(alertTimer.current);
      alertTimer.current = setTimeout(() => setShowAlert(false), 10000);
    }
  }, [state.proactiveAlert]);

  const handleSend = () => {
    if (!chatInput.trim() || !agentRef.current) return;
    agentRef.current.sendText(chatInput.trim());
    setChatInput("");
  };

  const toggleChat = () => setShowChat((v) => !v);

  const toggleMic = () => {
    const agent = agentRef.current;
    if (!agent) return;
    if (state.status === "listening") {
      agent.stopListening();
    } else if (state.status === "idle" || state.status === "speaking") {
      agent.startListening();
    }
  };

  const isActive = state.status === "listening" || state.status === "thinking";
  const isSpeaking = state.status === "speaking";

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-1.5">
      {/* Proactive alert */}
      {showAlert && state.proactiveAlert && (
        <div className="bg-red-950/95 backdrop-blur-md border border-red-700/50 rounded-xl px-3 py-2 max-w-[280px] text-[11px] text-red-300 shadow-2xl animate-in slide-in-from-bottom-2">
          <span className="font-extrabold text-red-400 text-[10px] uppercase tracking-wider">Alerta</span>
          <p className="mt-0.5 leading-tight">{state.proactiveAlert}</p>
        </div>
      )}

      {/* Response toast */}
      {showResponse && state.response && (
        <div className="bg-zinc-900/95 backdrop-blur-md border border-emerald-800/30 rounded-xl px-3 py-2 max-w-[280px] text-[11px] text-zinc-300 shadow-2xl animate-in slide-in-from-bottom-2">
          <span className="font-extrabold text-emerald-400 text-[10px] uppercase tracking-wider">EBD</span>
          <p className="mt-0.5 leading-tight">{state.response}</p>
        </div>
      )}

      {/* Transcript when listening */}
      {state.status === "listening" && state.transcript && (
        <div className="bg-amber-950/80 backdrop-blur-md border border-amber-800/40 rounded-xl px-3 py-1.5 text-[11px] text-amber-200 shadow-xl max-w-[200px] truncate">
          {state.transcript}
        </div>
      )}

      {/* Main mic button */}
      <button
        onClick={toggleMic}
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center
          transition-all duration-300 cursor-pointer shadow-xl border
          ${isActive
            ? "bg-amber-500/20 border-amber-500/40 scale-110"
            : isSpeaking
              ? "bg-emerald-500/20 border-emerald-500/40"
              : state.status === "error"
                ? "bg-red-500/20 border-red-500/40"
                : "bg-zinc-900/80 border-zinc-700/40 hover:border-amber-500/30"
          }
        `}
        title={state.status === "listening" ? "Ouvindo... clique para parar" : "Clique e fale"}
      >
        {isActive && <span className="absolute inset-0 rounded-full animate-ping bg-amber-500/20" />}
        {isActive && <span className="absolute inset-0 rounded-full animate-pulse bg-amber-500/10" />}

        {state.status === "thinking" ? (
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
        ) : state.status === "listening" ? (
          <Mic className="w-5 h-5 text-amber-400" />
        ) : isSpeaking ? (
          <Volume2 className="w-5 h-5 text-emerald-400" />
        ) : (
          <Mic className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {/* Label */}
      <span className="text-[10px] text-zinc-600 font-mono pr-1 select-none">
        {state.status === "listening" ? "ouvindo..." :
         state.status === "thinking" ? "pensando..." :
         state.status === "speaking" ? "falando..." :
         state.status === "error" ? "erro" :
         "EBD"}
      </span>

      {/* Chat input */}
      {showChat && (
        <div className="flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/40 rounded-full px-2 py-1 shadow-xl">
          <input
            ref={inputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escreva um comando..."
            className="bg-transparent text-xs text-zinc-200 outline-none w-[180px] placeholder-zinc-600"
            disabled={state.status === "thinking"}
          />
          <button onClick={handleSend} disabled={state.status === "thinking"} className="text-amber-400 hover:text-amber-300 disabled:opacity-30">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Chat toggle button */}
      <button
        onClick={toggleChat}
        className="w-7 h-7 rounded-full bg-zinc-900/80 border border-zinc-700/40 flex items-center justify-center cursor-pointer hover:border-amber-500/30 transition-colors"
        title="Escrever comando"
      >
        <MessageSquare className="w-3 h-3 text-zinc-500" />
      </button>
    </div>
  );
};
