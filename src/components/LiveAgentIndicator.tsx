import React, { useEffect, useRef, useCallback } from "react";
import { createLiveAgent, type LiveAgent, type LiveAgentState, type SupabaseContext } from "../services/liveAgent";
import { insumosService, productsService } from "../lib/database";

interface Props {
  tenantId: string | null;
  onRefresh: () => void;
}

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const STATUS_LABELS: Record<string, string> = {
  disconnected: "off",
  connecting: "conectando...",
  connected: "EBD",
  error: "erro",
};

const STATUS_COLORS: Record<string, { dot: string; bg: string; border: string }> = {
  disconnected: { dot: "bg-zinc-500", bg: "bg-zinc-900/80", border: "border-zinc-800/50" },
  connecting: { dot: "bg-amber-500 animate-pulse", bg: "bg-amber-950/80", border: "border-amber-800/40" },
  connected: { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]", bg: "bg-zinc-900/80", border: "border-zinc-800/30" },
  error: { dot: "bg-red-500 animate-pulse", bg: "bg-red-950/80", border: "border-red-800/40" },
};

export const LiveAgentIndicator: React.FC<Props> = ({ tenantId, onRefresh }) => {
  const agentRef = useRef<LiveAgent | null>(null);
  const startedRef = useRef(false);
  const [state, setState] = React.useState<LiveAgentState>({
    status: "disconnected", listening: false, lastSpeech: "", lastAction: "",
    lastResponse: "", error: null, proactiveAlert: null, memoryCount: 0,
  });
  const [showAlert, setShowAlert] = React.useState(false);
  const [showSpeech, setShowSpeech] = React.useState(false);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // Initialize agent once
  useEffect(() => {
    if (startedRef.current) return;
    if (!tenantId || !GEMINI_KEY) return;

    startedRef.current = true;
    const ctx = buildContext();
    if (!ctx) return;

    const agent = createLiveAgent({ apiKey: GEMINI_KEY, context: ctx, onState: setState });
    agentRef.current = agent;
    agent.start();

    return () => {
      agent.stop();
      startedRef.current = false;
    };
  }, [tenantId, GEMINI_KEY]);

  // Update context when tenant changes
  useEffect(() => {
    if (!startedRef.current) return;
    const ctx = buildContext();
    if (ctx && agentRef.current) {
      agentRef.current.setContext(ctx);
    }
  }, [tenantId]);

  // Show proactive alert with auto-dismiss
  useEffect(() => {
    if (state.proactiveAlert) {
      setShowAlert(true);
      if (alertTimer.current) clearTimeout(alertTimer.current);
      alertTimer.current = setTimeout(() => setShowAlert(false), 8000);
    } else {
      setShowAlert(false);
    }
  }, [state.proactiveAlert]);

  // Show last speech/results briefly
  useEffect(() => {
    if (state.lastResponse) {
      setShowSpeech(true);
      if (speechTimer.current) clearTimeout(speechTimer.current);
      speechTimer.current = setTimeout(() => setShowSpeech(false), 5000);
    }
    if (state.lastAction) {
      // Refresh data after action
      const t = setTimeout(onRefresh, 800);
      return () => clearTimeout(t);
    }
  }, [state.lastResponse, state.lastAction]);

  const colors = STATUS_COLORS[state.status] || STATUS_COLORS.disconnected;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-1.5 pointer-events-none select-none">
      {/* Proactive alert toast */}
      {showAlert && state.proactiveAlert && (
        <div className="pointer-events-auto bg-red-950/95 backdrop-blur-md border border-red-700/50 rounded-xl px-3 py-2 max-w-[280px] text-[11px] text-red-300 shadow-2xl shadow-red-900/30 animate-in slide-in-from-bottom-2 duration-300">
          <span className="font-extrabold text-red-400 text-[10px] uppercase tracking-wider">Alerta Proativo</span>
          <p className="mt-0.5 leading-tight">{state.proactiveAlert}</p>
        </div>
      )}

      {/* Last response toast */}
      {showSpeech && state.lastResponse && (
        <div className="pointer-events-auto bg-zinc-900/95 backdrop-blur-md border border-emerald-800/30 rounded-xl px-3 py-2 max-w-[280px] text-[11px] text-zinc-300 shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
          <span className="font-extrabold text-emerald-400 text-[10px] uppercase tracking-wider">EBD</span>
          <p className="mt-0.5 leading-tight">{state.lastResponse}</p>
        </div>
      )}

      {/* Status pill */}
      <div className={`flex items-center gap-2 ${colors.bg} backdrop-blur-md border ${colors.border} rounded-full px-3 py-1.5 shadow-xl transition-colors duration-500`}>
        {/* Dot with glow */}
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${colors.dot} transition-all duration-300`} />
          {state.status === "connected" && (
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-30" />
          )}
        </div>

        {/* Label */}
        <span className={`text-[10px] font-bold font-mono uppercase tracking-[0.15em] transition-colors duration-300 ${
          state.status === "connected" ? "text-emerald-400" :
          state.status === "error" ? "text-red-400" :
          "text-zinc-500"
        }`}>
          {STATUS_LABELS[state.status]}
        </span>

        {/* Waveform when listening */}
        {state.listening && (
          <div className="flex items-end gap-px h-2.5 ml-0.5">
            {[0.6, 1, 0.4, 0.8, 0.5].map((h, i) => (
              <div
                key={i}
                className="w-0.5 bg-emerald-400/60 rounded-full"
                style={{
                  height: `${h * 100}%`,
                  animation: `waveform 0.8s ease-in-out ${i * 0.12}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
