import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Check, AlertCircle, Volume2, VolumeX, Zap } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { processVoiceCommand, CommandResult } from '../services/voiceService';
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
  onNavigate: (module: string) => void;
  onAddStock: (product: string, quantity: number, unit: string) => Promise<void>;
  onRemoveStock: (product: string, quantity: number, unit: string) => Promise<void>;
  onCreateProduct: (name: string, price: number) => Promise<void>;
  onCreateOrder: (customer: string, product: string, quantity: number) => Promise<void>;
  onQueryStock: (name: string) => { currentStock: number; unit: string } | null;
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
  onNavigate,
  onAddStock,
  onRemoveStock,
  onCreateProduct,
  onCreateOrder,
  onQueryStock,
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
  const [history, setHistory] = useState<Array<{ time: Date; input: string; result: CommandResult }>>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [conversationMode, setConversationMode] = useState(false);

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
      const context = { insumos, products, orders, fichas, invoices, tenant };

      const commandResult = await processVoiceCommand(text, context, {
        navigate: onNavigate,
        addStock: onAddStock,
        removeStock: onRemoveStock,
        createProduct: onCreateProduct,
        createOrder: onCreateOrder,
        queryStock: onQueryStock,
        close: onClose,
      });

      setResult(commandResult);
      setHistory(prev => [{ time: new Date(), input: text, result: commandResult }, ...prev].slice(0, 10));

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
        setTimeout(() => {
          if (!isListening) startListening();
        }, 300);
      }
    }
  };

  const handleMicPress = () => {
    if (conversationMode) {
      setConversationMode(false);
      stopListening();
    } else {
      resetTranscript();
      setResult(null);
      setConversationMode(true);
      startListening();
    }
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
                {conversationMode ? '🔴 Conversando...' : 'Toque pra falar'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 text-zinc-400 hover:text-white rounded-lg">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => { setConversationMode(false); stopListening(); onClose(); }} className="p-2 text-zinc-400 hover:text-white rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="p-5 overflow-y-auto flex-1">
          
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
            
            {!isListening && !isProcessing && !isSpeaking && !result && (
              <p className="text-[11px] text-zinc-500">
                {conversationMode ? 'Diga algo!' : 'Toque e fale um comando'}
              </p>
            )}
          </div>

          {/* Result */}
          {result && (
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

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl mb-4 bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">
                {error === 'not-allowed' ? 'Ative o microfone.' : `Erro: ${error}`}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => handleProcessCommand('Abrir dashboard')} className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white text-left">
              📊 Abrir dashboard
            </button>
            <button onClick={() => handleProcessCommand('Abrir insumos')} className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white text-left">
              📦 Abrir insumos
            </button>
            <button onClick={() => handleProcessCommand('Abrir pedidos')} className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white text-left">
              🛒 Abrir pedidos
            </button>
            <button onClick={() => handleProcessCommand('Abrir produtos')} className="p-2 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white text-left">
              🏷️ Abrir produtos
            </button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-zinc-600 uppercase mb-1.5">Histórico</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {history.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-zinc-900">
                    <span className={item.result.success ? 'text-emerald-400' : 'text-red-400'}>
                      {item.result.success ? '✓' : '✗'}
                    </span>
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
