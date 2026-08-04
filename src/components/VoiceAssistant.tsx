import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, X, Check, AlertCircle, Volume2, VolumeX, 
  Zap, Minimize2, Maximize2, Brain, History, Settings,
  MessageCircle, Command, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { ebdAi, SystemState } from '../services/jarvisCore';
import { ebdAiVoice, VoiceConfig } from '../services/jarvisVoice';
import { ebdAiTools, ToolCall } from '../services/jarvisTools';
import { geminiService } from '../services/geminiService';
import { toolExecutor, ToolResult } from '../services/advancedTools';
import { episodicMemory } from '../services/episodicMemory';
import { Insumo, Product, Order, FichaTecnica, InvoiceScan, Tenant } from '../types';

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  insumos: Insumo[];
  products: Product[];
  orders: Order[];
  fichas: FichaTecnica[];
  invoices: InvoiceScan[];
  tenant?: Tenant;
  activeTenantId: string;
  onNavigate: (module: string) => void;
  onRefresh: () => Promise<void>;
}

type ViewMode = 'main' | 'history' | 'settings' | 'tools';

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  isOpen,
  onClose,
  insumos,
  products,
  orders,
  fichas,
  invoices,
  tenant,
  activeTenantId,
  onNavigate,
  onRefresh,
}) => {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    speak,
    isSpeaking,
  } = useVoiceRecognition();

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<Array<{ time: Date; input: string; response: string; success: boolean }>>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ebdAiThinking, setEbdAiThinking] = useState(false);
  const [toolHistory, setToolHistory] = useState<ToolCall[]>([]);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    rate: 1.1,
    pitch: 0.9,
    volume: 1,
    voice: null,
    enabled: true,
  });
  const [showQuickActions, setShowQuickActions] = useState(true);
  
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update EBD AI state when data changes
  useEffect(() => {
    ebdAi.updateState({ insumos, products, orders, fichas, invoices, tenant });
  }, [insumos, products, orders, fichas, invoices, tenant]);

  // Load tool history
  useEffect(() => {
    setToolHistory(ebdAiTools.getCallHistory(20));
  }, [isProcessing]);

  // Set company ID for Gemini
  useEffect(() => {
    if (activeTenantId) {
      geminiService.setCompanyId(activeTenantId);
    }
  }, [activeTenantId]);

  // Auto-scroll
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history, result]);

  // Process voice transcript
  useEffect(() => {
    if (transcript && !isListening && !isProcessing) {
      handleProcessCommand(transcript);
    }
  }, [transcript, isListening]);

  // Auto-start listening when minimized
  useEffect(() => {
    if (isMinimized && isSupported && !isListening && !isProcessing) {
      // Auto-listen in minimized mode
    }
  }, [isMinimized, isSupported]);

  const handleProcessCommand = async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setEbdAiThinking(true);
    setResult(null);

    try {
      // Add user turn to context
      ebdAi.addTurn('user', text);
      
      // Record episode start
      const toolsUsed: string[] = [];
      let response: { success: boolean; message: string; data?: any } = { success: false, message: '' };
      
      try {
        // Try Gemini first
        const geminiResponse = await geminiService.chat(text);
        response = {
          success: geminiResponse.success,
          message: geminiResponse.response,
          data: geminiResponse.functionCalls?.[0] ? { navigate: geminiResponse.functionCalls[0].args?.module } : null,
        };
        
        if (geminiResponse.functionCalls) {
          geminiResponse.functionCalls.forEach(fc => toolsUsed.push(fc.name));
        }
      } catch (geminiError) {
        console.log('Gemini unavailable, using local tools');
        
        // Fallback to advanced tools with execution
        const context = {
          tenantId: activeTenantId,
          userId: 'current',
          insumos,
          products,
          orders,
          fichas,
        };

        // Try to match a tool call
        const lower = text.toLowerCase();
        let toolResult: ToolResult | null = null;

        if (lower.includes('quanto tenho') || lower.includes('estoque de')) {
          const itemMatch = lower.match(/(?:de|do|da)\s+(.+?)[\?\s]*$/);
          const itemName = itemMatch ? itemMatch[1].trim() : '';
          toolResult = await toolExecutor.execute('getInventoryStatus', { lowStockOnly: false }, context);
          toolsUsed.push('getInventoryStatus');
        } else if (lower.includes('adicionar') || lower.includes('entrou')) {
          const qtyMatch = lower.match(/(\d+)/);
          const itemMatch = lower.match(/(?:de|do|da)\s+(.+?)[\.\s]*$/);
          if (qtyMatch && itemMatch) {
            toolResult = await toolExecutor.execute('addStock', {
              itemName: itemMatch[1].trim(),
              quantity: parseInt(qtyMatch[1]),
            }, context);
            toolsUsed.push('addStock');
          }
        } else if (lower.includes('remover') || lower.includes('saiu')) {
          const qtyMatch = lower.match(/(\d+)/);
          const itemMatch = lower.match(/(?:de|do|da)\s+(.+?)[\.\s]*$/);
          if (qtyMatch && itemMatch) {
            toolResult = await toolExecutor.execute('removeStock', {
              itemName: itemMatch[1].trim(),
              quantity: parseInt(qtyMatch[1]),
            }, context);
            toolsUsed.push('removeStock');
          }
        } else if (lower.includes('resumo') || lower.includes('dashboard')) {
          toolResult = await toolExecutor.execute('getAnalytics', { type: 'summary' }, context);
          toolsUsed.push('getAnalytics');
        } else if (lower.includes('relatório') && lower.includes('vendas')) {
          toolResult = await toolExecutor.execute('getAnalytics', { type: 'sales' }, context);
          toolsUsed.push('getAnalytics');
        } else if (lower.includes('margem') || lower.includes('lucro')) {
          toolResult = await toolExecutor.execute('getAnalytics', { type: 'profit' }, context);
          toolsUsed.push('getAnalytics');
        } else if (lower.includes('criar produto')) {
          const nameMatch = lower.match(/produto\s+(.+?)(?:\s+por|\s+preço|\s+custa)/i);
          const priceMatch = lower.match(/(?:por|preço|custa)\s+(?:r\$?\s*)?(\d+[\.,]?\d*)/i);
          if (nameMatch && priceMatch) {
            toolResult = await toolExecutor.execute('createProduct', {
              name: nameMatch[1].trim(),
              price: parseFloat(priceMatch[1].replace(',', '.')),
            }, context);
            toolsUsed.push('createProduct');
          }
        } else if (lower.includes('ajuda') || lower.includes('help')) {
          toolResult = await toolExecutor.execute('getHelp', {}, context);
          toolsUsed.push('getHelp');
        }

        if (toolResult) {
          response = {
            success: toolResult.success,
            message: toolResult.message,
            data: toolResult.data,
          };
        } else {
          // Fallback to basic tools
          const basicResult = await ebdAiTools.processNaturalLanguage(text, activeTenantId);
          response = {
            success: basicResult.success,
            message: basicResult.response,
            data: basicResult.data,
          };
          if (basicResult.success) toolsUsed.push('basicTool');
        }
      }
      
      // Add EBD AI turn to context
      ebdAi.addTurn('ebdAi', response.message);
      
      // Record episode in episodic memory
      episodicMemory.recordEpisode({
        type: 'command',
        input: text,
        output: response.message,
        toolsUsed,
        success: response.success,
        context: { tenantId: activeTenantId },
      });

      // Save to history
      setHistory(prev => [
        { time: new Date(), input: text, response: response.message, success: response.success },
        ...prev
      ].slice(0, 20));

      setResult({ success: response.success, message: response.message });

      // Handle navigation if needed
      if (response.data?.navigate) {
        onNavigate(response.data.navigate);
      }

      // Speak response
      if (soundEnabled) {
        await ebdAiVoice.speak(response.message);
      }

      // Refresh data if stock was modified
      if (response.success && toolsUsed.some(t => ['addStock', 'removeStock', 'createProduct', 'createOrder'].includes(t))) {
        await onRefresh();
      }

    } catch (err) {
      console.error('EBD AI Error:', err);
      setResult({ success: false, message: 'Erro ao processar comando.' });
      
      // Record error episode
      episodicMemory.recordEpisode({
        type: 'error',
        input: text,
        output: 'Erro ao processar',
        toolsUsed: [],
        success: false,
        context: { error: err },
      });
      
      if (soundEnabled) {
        await ebdAiVoice.speakError('Erro ao processar');
      }
    } finally {
      setIsProcessing(false);
      setEbdAiThinking(false);
      resetTranscript();
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setResult(null);
      startListening();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (input && input.value.trim()) {
      handleProcessCommand(input.value.trim());
      input.value = '';
    }
  };

  const clearMemory = () => {
    ebdAi.resetContext();
    setHistory([]);
    setResult(null);
  };

  const toggleSound = async () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    ebdAiVoice.setEnabled(newState);
    
    if (newState) {
      await ebdAiVoice.speak('Áudio ativado');
    }
  };

  if (!isOpen) return null;

  // ============================================================
  // MINIMIZED VIEW - Floating orb
  // ============================================================
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 lg:bottom-8 right-4 z-50 flex flex-col items-end gap-3">
        {/* Result toast */}
        {result && (
          <div className={`max-w-xs p-3 rounded-xl shadow-2xl animate-slide-in text-xs ${
            result.success 
              ? 'bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 text-white' 
              : 'bg-gradient-to-r from-red-500/90 to-red-600/90 text-white'
          }`}>
            {result.message}
          </div>
        )}
        
        {/* Context hint */}
        {ebdAi.getTopic() && (
          <div className="max-w-xs p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs shadow-lg">
            💭 {ebdAi.getTopic()}
          </div>
        )}
        
        {/* Main floating orb */}
        <div className="flex items-center gap-3">
          {isListening && (
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i}
                  className="w-1 bg-amber-500 rounded-full animate-pulse"
                  style={{ 
                    height: `${12 + Math.random() * 20}px`,
                    animationDelay: `${i * 0.1}s` 
                  }} 
                />
              ))}
            </div>
          )}
          
          <button
            onClick={() => setIsMinimized(false)}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
              isListening 
                ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 shadow-red-500/40 animate-pulse' 
                : ebdAiThinking
                ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-blue-500/40'
                : 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 shadow-orange-500/30 hover:scale-110'
            }`}
          >
            {ebdAiThinking ? (
              <Brain className="w-7 h-7 text-white animate-spin" />
            ) : (
              <Zap className="w-7 h-7 text-white" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // FULL VIEW - Side panel
  // ============================================================
  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-50 flex">
      {/* Backdrop */}
      <div 
        className="flex-1 bg-black/60 backdrop-blur-sm lg:hidden" 
        onClick={onClose} 
      />
      
      {/* Panel */}
      <div className="w-full sm:w-[420px] bg-[#0A0A0C] border-l border-zinc-800/50 flex flex-col shadow-2xl">
        
        {/* ============================================================ */}
        {/* HEADER */}
        {/* ============================================================ */}
        <div className="px-5 py-4 border-b border-zinc-800/50 bg-gradient-to-r from-[#121214] to-[#1A1A1E] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${
                isListening 
                  ? 'bg-gradient-to-br from-red-500 to-red-600 animate-pulse' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-500'
              }`}>
                <Zap className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-wider">EBD AI</h3>
                <p className="text-[10px] text-zinc-500">
                  {ebdAiThinking ? '🧠 Processando...' : 
                   isListening ? '🔴 Ouvindo...' : 
                   isSpeaking ? '🔊 Falando...' : '⚡ Pronto'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={toggleSound} 
                className={`p-2 rounded-lg transition-colors ${
                  soundEnabled ? 'text-amber-500 hover:bg-amber-500/10' : 'text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setIsMinimized(true)} 
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button 
                onClick={onClose} 
                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* View tabs */}
          <div className="flex gap-1 mt-3">
            {[
              { id: 'main', icon: Zap, label: 'Chat' },
              { id: 'history', icon: History, label: 'Histórico' },
              { id: 'tools', icon: Command, label: 'Tools' },
              { id: 'settings', icon: Settings, label: 'Config' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  viewMode === tab.id 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/* MAIN VIEW */}
        {/* ============================================================ */}
        {viewMode === 'main' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={historyRef}>
              
              {/* Welcome message */}
              {history.length === 0 && !result && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Brain className="w-10 h-10 text-amber-500" />
                  </div>
                  <p className="text-zinc-400 text-sm mb-2">Olá! Sou o EBD AI</p>
                  <p className="text-zinc-600 text-xs">Diga um comando ou clique no microfone</p>
                  
                  {/* Quick suggestions */}
                  <div className="mt-6 space-y-2 px-4">
                    {[
                      'Quanto tenho de estoque?',
                      'Relatório de vendas',
                      'Criar produto novo',
                      'Estoque baixo',
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleProcessCommand(suggestion)}
                        className="w-full p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-all text-left"
                      >
                        💡 {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* History messages */}
              {history.map((item, index) => (
                <div key={index} className="space-y-2">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] p-3 rounded-2xl rounded-br-sm bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-300">{item.input}</p>
                    </div>
                  </div>
                  
                  {/* EBD AI response */}
                  <div className="flex justify-start">
                    <div className={`max-w-[85%] p-3 rounded-2xl rounded-bl-sm ${
                      item.success 
                        ? 'bg-zinc-800/50 border border-zinc-700/50' 
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}>
                      <p className={`text-xs whitespace-pre-line ${item.success ? 'text-zinc-300' : 'text-red-300'}`}>
                        {item.response}
                      </p>
                      <p className="text-[9px] text-zinc-600 mt-1">
                        {item.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Thinking indicator */}
              {ebdAiThinking && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-2xl rounded-bl-sm bg-zinc-800/50 border border-zinc-700/50">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-amber-500 animate-spin" />
                      <span className="text-xs text-zinc-400">Processando...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================ */}
            {/* INPUT AREA */}
            {/* ============================================================ */}
            <div className="p-4 border-t border-zinc-800/50 bg-[#121214]">
              {/* Interim transcript */}
              {isListening && interimTranscript && (
                <div className="mb-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <p className="text-[10px] text-amber-400 italic">"{interimTranscript}"</p>
                </div>
              )}

              {/* Text input */}
              <form onSubmit={handleTextSubmit} className="flex gap-2 mb-3">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Digite um comando..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-500 hover:bg-amber-500/30 transition-colors"
                >
                  <Command className="w-4 h-4" />
                </button>
              </form>

              {/* Mic button */}
              <div className="flex justify-center">
                <button
                  onClick={handleMicPress}
                  disabled={!isSupported}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isListening 
                      ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 scale-110' 
                      : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-orange-500/20 hover:scale-105'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isListening ? (
                    <MicOff className="w-7 h-7 text-white" />
                  ) : (
                    <Mic className="w-7 h-7 text-white" />
                  )}
                </button>
              </div>
              
              {!isSupported && (
                <p className="text-center text-[10px] text-red-400 mt-2">
                  Reconhecimento de voz não suportado neste navegador
                </p>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* HISTORY VIEW */}
        {/* ============================================================ */}
        {viewMode === 'history' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Memória do EBD AI</h3>
              <button 
                onClick={clearMemory}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20"
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            </div>
            
            <div className="space-y-2">
              {ebdAi.getRecentMemory(30).map((entry) => (
                <div 
                  key={entry.id} 
                  className={`p-3 rounded-lg border ${
                    entry.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                    entry.type === 'error' ? 'bg-red-500/5 border-red-500/20' :
                    'bg-zinc-900/50 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-medium ${
                      entry.type === 'success' ? 'text-emerald-400' :
                      entry.type === 'error' ? 'text-red-400' :
                      'text-zinc-400'
                    }`}>
                      {entry.type.toUpperCase()}
                    </span>
                    <span className="text-[9px] text-zinc-600">
                      {new Date(entry.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-300">{entry.input}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{entry.output}</p>
                </div>
              ))}
              
              {ebdAi.getRecentMemory(30).length === 0 && (
                <div className="text-center py-8">
                  <History className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-600">Nenhum registro ainda</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TOOLS VIEW */}
        {/* ============================================================ */}
        {viewMode === 'tools' && (
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-bold text-white mb-4">Tool Calls</h3>
            
            <div className="space-y-2">
              {toolHistory.map((call) => (
                <div key={call.id} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-amber-400">{call.name}</span>
                    <span className="text-[9px] text-zinc-600">
                      {new Date(call.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {JSON.stringify(call.args, null, 2)}
                  </p>
                </div>
              ))}
              
              {toolHistory.length === 0 && (
                <div className="text-center py-8">
                  <Command className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-600">Nenhum tool call registrado</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SETTINGS VIEW */}
        {/* ============================================================ */}
        {viewMode === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h3 className="text-sm font-bold text-white mb-4">Configurações EBD AI</h3>
            
            {/* Voice settings */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-500" />
                Voz
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-400 mb-1 block">Velocidade: {voiceConfig.rate.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={voiceConfig.rate}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value);
                      setVoiceConfig(prev => ({ ...prev, rate }));
                      ebdAiVoice.setRate(rate);
                    }}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] text-zinc-400 mb-1 block">Tom: {voiceConfig.pitch.toFixed(1)}</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={voiceConfig.pitch}
                    onChange={(e) => {
                      const pitch = parseFloat(e.target.value);
                      setVoiceConfig(prev => ({ ...prev, pitch }));
                      ebdAiVoice.setPitch(pitch);
                    }}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Available tools */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Command className="w-4 h-4 text-amber-500" />
                Ferramentas Disponíveis
              </h4>
              
              <div className="space-y-1">
                {ebdAiTools.getAvailableTools().map((tool) => (
                  <div key={tool.name} className="p-2 rounded-lg bg-zinc-800/50">
                    <p className="text-[10px] font-mono text-amber-400">{tool.name}</p>
                    <p className="text-[9px] text-zinc-500">{tool.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Context info */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-500" />
                Contexto
              </h4>
              
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Sessão:</span>
                  <span className="text-zinc-300 font-mono">{ebdAi.getRecentTurns(1).length > 0 ? 'Ativa' : 'Nova'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Memórias:</span>
                  <span className="text-zinc-300">{ebdAi.getRecentMemory(100).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Último módulo:</span>
                  <span className="text-zinc-300">{ebdAi.getLastModule() || 'Nenhum'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
