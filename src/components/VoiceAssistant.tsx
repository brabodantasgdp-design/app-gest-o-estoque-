import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Check, AlertCircle, Volume2, VolumeX, Zap, MessageCircle } from 'lucide-react';
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
  
  // Conversation state
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);

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
          setConversation(null);
          
          // Parse and execute based on conversation data
          const data = conversation.data;
          if (data.name && data.quantity !== undefined) {
            // Create insumo
            try {
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
            } catch (err) {
              console.error('Error creating insumo:', err);
            }
          } else if (data.name && data.price !== undefined) {
            // Create product
            try {
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
            } catch (err) {
              console.error('Error creating product:', err);
            }
          } else if (data.customer && data.product) {
            // Create order
            try {
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
            } catch (err) {
              console.error('Error creating order:', err);
            }
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

      // Otherwise, process as direct command
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

  const handleCancelConversation = () => {
    setConversation(null);
    setConversationHistory([]);
    setResult({ action: 'cancelled', response: 'Conversa cancelada.', success: false });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 bg-[#18181b]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">EBD AI</h3>
              <p className="text-[10px] text-zinc-500">
                {conversation ? '💭 Em conversa...' : conversationMode ? '🔴 Conversando...' : 'Toque pra falar'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 text-zinc-400 hover:text-white rounded-lg">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => { setConversationMode(false); setConversation(null); stopListening(); onClose(); }} className="p-2 text-zinc-400 hover:text-white rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="p-5 overflow-y-auto flex-1">
          
          {/* Conversation Mode Indicator */}
          {conversation && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400">Modo Conversa</span>
                <button onClick={handleCancelConversation} className="ml-auto text-[10px] text-zinc-400 hover:text-red-400">
                  Cancelar
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {conversationHistory.map((msg, i) => (
                  <p key={i} className={`text-[10px] ${msg.startsWith('AI:') ? 'text-amber-300' : 'text-zinc-400'}`}>
                    {msg}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Mic Button */}
          <div className="flex justify-center mb-5">
            <button
              onClick={handleMicPress}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                conversationMode 
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 animate-pulse' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-orange-500/20 hover:scale-105'
              }`}
            >
              {conversationMode ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
          </div>

          {/* Status */}
          <div className="text-center mb-4">
            {isListening && !isProcessing && (
              <div>
                <p className="text-xs font-bold text-amber-400 animate-pulse">Ouvindo...</p>
                {interimTranscript && (
                  <p className="text-xs text-zinc-400 mt-1 italic truncate">"{interimTranscript}"</p>
                )}
              </div>
            )}
            
            {isProcessing && (
              <p className="text-xs font-bold text-blue-400">Processando...</p>
            )}
            
            {isSpeaking && (
              <p className="text-xs font-bold text-emerald-400">Falando...</p>
            )}
            
            {!isListening && !isProcessing && !isSpeaking && !result && !conversation && (
              <p className="text-[11px] text-zinc-500">
                {conversationMode ? 'Diga algo!' : 'Toque e fale um comando'}
              </p>
            )}
          </div>

          {/* Result */}
          {result && !conversation && (
            <div className={`p-3 rounded-xl mb-4 flex items-start gap-2 ${
              result.success 
                ? 'bg-emerald-500/10 border border-emerald-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {result.success ? (
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <p className={`text-xs font-medium ${result.success ? 'text-emerald-300' : 'text-red-300'}`}>
                {result.response}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          {!conversation && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => handleProcessCommand('Criar insumo')} className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white text-left">
                📦 Criar insumo
              </button>
              <button onClick={() => handleProcessCommand('Criar produto')} className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white text-left">
                🏷️ Criar produto
              </button>
              <button onClick={() => handleProcessCommand('Criar pedido')} className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white text-left">
                🛒 Criar pedido
              </button>
              <button onClick={() => handleProcessCommand('Abrir dashboard')} className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white text-left">
                📊 Dashboard
              </button>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase mb-1.5">Histórico</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {history.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-zinc-900">
                    <span className="text-zinc-400 truncate flex-1">{item.input}</span>
                    <span className="text-zinc-600">{item.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
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
