import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Check, AlertCircle, Volume2, VolumeX, Zap, MessageCircle, Minimize2, Maximize2 } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { processVoiceCommand, CommandResult } from '../services/voiceService';
import { 
  ConversationState, 
  startConversation, 
  processConversationStep, 
  detectIntent 
} from '../services/conversationEngine';
import { Insumo, Product, Order, FichaTecnica, InvoiceScan, Tenant } from '../types';
import { insumosService, productsService, ordersService } from '../lib/database';

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
  const [result, setResult] = useState<CommandResult | null>(null);
  const [history, setHistory] = useState<Array<{ time: Date; input: string; response: string }>>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [conversationMode, setConversationMode] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Conversation state
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  
  // Auto-scroll
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history, conversationHistory]);

  useEffect(() => {
    if (transcript && !isListening && !isProcessing) {
      handleProcessCommand(transcript);
    }
  }, [transcript, isListening]);

  useEffect(() => {
    if (isOpen && conversationMode && !isListening) {
      setTimeout(() => startListening(), 100);
    }
  }, [isOpen, conversationMode]);

  const handleProcessCommand = async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setResult(null);

    try {
      // If we're in a conversation, continue it
      if (conversation) {
        const response = processConversationStep(conversation, text);
        
        setConversationHistory(prev => [...prev, `Você: ${text}`, `AI: ${response.message}`]);
        
        if (response.state === null) {
          // Conversation finished - execute the action
          const data = conversation.data;
          setConversation(null);
          
          try {
            if (data.name && data.quantity !== undefined && !data.customer) {
              // Create insumo
              await insumosService.create({
                tenantId: activeTenantId,
                code: `INS-${Math.floor(100 + Math.random() * 900)}`,
                name: data.name,
                category: 'Via Voz',
                unit: data.unit || 'g',
                currentStock: data.quantity,
                minStock: Math.floor(data.quantity * 0.2),
                unitCost: data.cost ? data.cost / data.quantity : 0,
                supplier: 'Via assistente de voz',
                lastUpdated: new Date().toISOString().split('T')[0],
              });
              await onRefresh();
            } else if (data.name && data.price !== undefined) {
              // Create product
              await productsService.create({
                tenantId: activeTenantId,
                name: data.name,
                price: data.price,
                cost: 0,
                margin: 0,
                category: 'Via Voz',
                description: 'Criado via assistente de voz',
                active: true,
                createdAt: new Date().toISOString(),
              } as any);
              await onRefresh();
            } else if (data.customer && data.product) {
              // Create order
              const prod = products.find(p => p.name.toLowerCase().includes(data.product.toLowerCase()));
              if (prod) {
                await ordersService.create({
                  tenantId: activeTenantId,
                  customerName: data.customer,
                  items: [{ productName: prod.name, quantity: data.quantity || 1, unitPrice: prod.price, subtotal: prod.price * (data.quantity || 1) }],
                  totalAmount: prod.price * (data.quantity || 1),
                  status: 'Pendente',
                  createdAt: new Date().toISOString(),
                } as any);
                await onRefresh();
              }
            }
          } catch (err) {
            console.error('Error executing:', err);
          }
          
          setResult({ action: 'success', response: response.message, success: true });
          if (soundEnabled) speak(response.message.replace('✓ ', ''));
          
          setConversationHistory([]);
        } else {
          // Continue conversation
          setConversation(response.state);
          setResult({ action: 'conversation', response: response.message, success: true });
          if (soundEnabled) speak(response.message);
        }
        
        setHistory(prev => [{ time: new Date(), input: text, response: response.message }, ...prev].slice(0, 10));
        setIsProcessing(false);
        resetTranscript();
        
        if (conversationMode) {
          setTimeout(() => { if (!isListening) startListening(); }, 300);
        }
        return;
      }

      // Check if user wants to start a conversation
      const intent = detectIntent(text);
      if (intent) {
        const response = startConversation(intent);
        setConversation(response.state);
        setResult({ action: 'conversation', response: response.message, success: true });
        if (soundEnabled) speak(response.message);
        
        setConversationHistory([`AI: ${response.message}`]);
        setHistory(prev => [{ time: new Date(), input: text, response: response.message }, ...prev].slice(0, 10));
        setIsProcessing(false);
        resetTranscript();
        
        if (conversationMode) {
          setTimeout(() => { if (!isListening) startListening(); }, 300);
        }
        return;
      }

      // Direct command
      const context = { insumos, products, orders, fichas, invoices, tenant };
      const commandResult = await processVoiceCommand(text, context, {
        navigate: onNavigate,
        addStock: async (product, qty, unit) => {
          const insumo = insumos.find(i => i.name.toLowerCase().includes(product.toLowerCase()));
          if (insumo) {
            await insumosService.update(insumo.id, {
              ...insumo,
              currentStock: insumo.currentStock + qty,
              lastUpdated: new Date().toISOString().split('T')[0],
            });
            await onRefresh();
          }
        },
        removeStock: async (product, qty, unit) => {
          const insumo = insumos.find(i => i.name.toLowerCase().includes(product.toLowerCase()));
          if (insumo) {
            await insumosService.update(insumo.id, {
              ...insumo,
              currentStock: Math.max(0, insumo.currentStock - qty),
              lastUpdated: new Date().toISOString().split('T')[0],
            });
            await onRefresh();
          }
        },
        createProduct: async (name, price) => {
          await productsService.create({
            tenantId: activeTenantId,
            name,
            price,
            cost: 0,
            margin: 0,
            category: 'Via Voz',
            description: 'Criado via assistente de voz',
            active: true,
            createdAt: new Date().toISOString(),
          } as any);
          await onRefresh();
        },
        createOrder: async (customer, product, qty) => {
          const prod = products.find(p => p.name.toLowerCase().includes(product.toLowerCase()));
          if (prod) {
            await ordersService.create({
              tenantId: activeTenantId,
              customerName: customer,
              items: [{ productName: prod.name, quantity: qty, unitPrice: prod.price, subtotal: prod.price * qty }],
              totalAmount: prod.price * qty,
              status: 'Pendente',
              createdAt: new Date().toISOString(),
            } as any);
            await onRefresh();
          }
        },
        queryStock: (name) => {
          const insumo = insumos.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
          if (!insumo) return null;
          return { currentStock: insumo.currentStock, unit: insumo.unit };
        },
        close: onClose,
      });

      setResult(commandResult);
      setHistory(prev => [{ time: new Date(), input: text, response: commandResult.response }, ...prev].slice(0, 10));

      if (soundEnabled && commandResult.response) {
        speak(commandResult.response.replace('✓ ', ''));
      }

    } catch (err) {
      console.error('Error:', err);
      const errorResult: CommandResult = { action: 'error', response: 'Erro ao processar.', success: false };
      setResult(errorResult);
      if (soundEnabled) speak('Erro ao processar');
    } finally {
      setIsProcessing(false);
      resetTranscript();
      
      if (conversationMode) {
        setTimeout(() => { if (!isListening) startListening(); }, 300);
      }
    }
  };

  const handleMicPress = () => {
    if (conversationMode) {
      setConversationMode(false);
      setConversation(null);
      setConversationHistory([]);
      stopListening();
    } else {
      resetTranscript();
      setResult(null);
      setConversationMode(true);
      startListening();
    }
  };

  if (!isOpen) return null;

  // MINIMIZED VIEW - Floating widget
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col items-end gap-2">
        {/* Result toast */}
        {result && (
          <div className={`max-w-xs p-2 rounded-lg text-[10px] shadow-lg animate-in slide-in-from-right ${
            result.success 
              ? 'bg-emerald-500/90 text-white' 
              : 'bg-red-500/90 text-white'
          }`}>
            {result.response}
          </div>
        )}
        
        {/* Conversation indicator */}
        {conversation && (
          <div className="max-w-xs p-2 rounded-lg bg-amber-500/90 text-black text-[10px] shadow-lg">
            💭 {conversationHistory[conversationHistory.length - 1]?.replace('AI: ', '') || 'Aguardando...'}
          </div>
        )}
        
        {/* Main floating button */}
        <div className="flex items-center gap-2">
          {isListening && (
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          )}
          <button
            onClick={() => setIsMinimized(false)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
              conversationMode 
                ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/30' 
                : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-orange-500/30'
            }`}
          >
            {conversationMode ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // FULL VIEW - Side panel
  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />
      
      {/* Panel */}
      <div className="w-full sm:w-96 bg-[#121214] border-l border-zinc-800 flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#18181b] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
              <Zap className="w-3.5 h-3.5 text-black" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-white">EBD AI</h3>
              <p className="text-[9px] text-zinc-500">
                {conversation ? '💭 Conversando...' : isListening ? '🔴 Ouvindo...' : 'Pronto'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 text-zinc-400 hover:text-white rounded">
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setIsMinimized(true)} className="p-1.5 text-zinc-400 hover:text-white rounded">
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setConversationMode(false); setConversation(null); stopListening(); onClose(); }} className="p-1.5 text-zinc-400 hover:text-white rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Conversation Area */}
        {conversation && (
          <div className="px-4 py-2 border-b border-zinc-800 bg-amber-500/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-amber-400">MODO CONVERSA</span>
              <button onClick={() => { setConversation(null); setConversationHistory([]); }} className="text-[9px] text-zinc-400 hover:text-red-400">
                Cancelar
              </button>
            </div>
            <div className="space-y-0.5 max-h-20 overflow-y-auto" ref={historyRef}>
              {conversationHistory.map((msg, i) => (
                <p key={i} className={`text-[10px] ${msg.startsWith('AI:') ? 'text-amber-300' : 'text-zinc-400'}`}>
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Mic Button */}
          <div className="flex justify-center">
            <button
              onClick={handleMicPress}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                conversationMode 
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 animate-pulse' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-orange-500/20 hover:scale-105'
              }`}
            >
              {conversationMode ? (
                <MicOff className="w-8 h-8 text-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
          </div>

          {/* Status */}
          <div className="text-center">
            {isListening && !isProcessing && (
              <div>
                <p className="text-xs font-bold text-amber-400 animate-pulse">Ouvindo...</p>
                {interimTranscript && (
                  <p className="text-[10px] text-zinc-400 mt-1 italic truncate">"{interimTranscript}"</p>
                )}
              </div>
            )}
            {isProcessing && <p className="text-xs font-bold text-blue-400">Processando...</p>}
            {isSpeaking && <p className="text-xs font-bold text-emerald-400">Falando...</p>}
            {!isListening && !isProcessing && !isSpeaking && !result && !conversation && (
              <p className="text-[10px] text-zinc-500">Toque e fale um comando</p>
            )}
          </div>

          {/* Result */}
          {result && !conversation && (
            <div className={`p-2.5 rounded-lg flex items-start gap-2 text-xs ${
              result.success 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' 
                : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              {result.success ? <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
              <span>{result.response}</span>
            </div>
          )}

          {/* Quick Actions */}
          {!conversation && (
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Criar insumo', cmd: 'Criar insumo', icon: '📦' },
                { label: 'Criar produto', cmd: 'Criar produto', icon: '🏷️' },
                { label: 'Criar pedido', cmd: 'Criar pedido', icon: '🛒' },
                { label: 'Dashboard', cmd: 'Abrir dashboard', icon: '📊' },
                { label: 'Insumos', cmd: 'Abrir insumos', icon: '📦' },
                { label: 'Produtos', cmd: 'Abrir produtos', icon: '🏷️' },
              ].map((item) => (
                <button 
                  key={item.cmd}
                  onClick={() => handleProcessCommand(item.cmd)} 
                  className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-700 text-left flex items-center gap-1.5"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase mb-1">Histórico</p>
              <div className="space-y-1 max-h-32 overflow-y-auto" ref={historyRef}>
                {history.map((item, index) => (
                  <div key={index} className="text-[10px] p-1.5 rounded bg-zinc-900">
                    <span className="text-zinc-400">{item.input}</span>
                    <span className="text-zinc-600 ml-2">{item.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
