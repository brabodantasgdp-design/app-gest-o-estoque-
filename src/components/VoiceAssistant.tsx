import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Check, AlertCircle, Loader2, Volume2, VolumeX } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { processVoiceCommand, executeVoiceCommand, VoiceCommand } from '../services/voiceService';
import { Insumo, Product, Order } from '../types';

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  insumos: Insumo[];
  products: Product[];
  orders: Order[];
  onAddStock: (insumoName: string, quantity: number, unit: string) => Promise<void>;
  onRemoveStock: (insumoName: string, quantity: number, unit: string) => Promise<void>;
  onCreateInsumo: (name: string, quantity: number, unit: string, price: number) => Promise<void>;
  onQueryStock: (insumoName: string) => { currentStock: number; unit: string } | null;
  onCreateProduct?: (name: string, price: number) => Promise<void>;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  isOpen,
  onClose,
  insumos,
  products,
  orders,
  onAddStock,
  onRemoveStock,
  onCreateInsumo,
  onQueryStock,
  onCreateProduct,
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
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [history, setHistory] = useState<Array<{ time: Date; action: string; success: boolean }>>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [conversationMode, setConversationMode] = useState(false);

  useEffect(() => {
    if (transcript && !isListening && !isProcessing) {
      handleProcessCommand(transcript);
    }
  }, [transcript, isListening]);

  useEffect(() => {
    if (isOpen && conversationMode && !isListening) {
      startListening();
    }
  }, [isOpen, conversationMode]);

  const handleProcessCommand = async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setResult(null);

    try {
      const command: VoiceCommand = await processVoiceCommand(text, insumos, products, orders);
      
      if (command.confidence < 0.3) {
        const msg = 'Não entendi bem. Tente novamente.';
        setResult({ type: 'error', message: msg });
        if (soundEnabled) speak(msg);
        setHistory(prev => [{ time: new Date(), action: text, success: false }, ...prev].slice(0, 5));
        return;
      }

      const responseMessage = await executeVoiceCommand(
        command,
        insumos,
        onAddStock,
        onRemoveStock,
        onCreateInsumo,
        onQueryStock,
        onCreateProduct
      );

      setResult({
        type: responseMessage.startsWith('✓') ? 'success' : 'error',
        message: responseMessage,
      });

      if (soundEnabled && responseMessage.startsWith('✓')) {
        speak(responseMessage.replace('✓ ', ''));
      }

      setHistory(prev => [{
        time: new Date(),
        action: `${text} → ${responseMessage}`,
        success: responseMessage.startsWith('✓'),
      }, ...prev].slice(0, 5));

    } catch (err) {
      console.error('Error processing command:', err);
      const msg = 'Erro ao processar. Tente novamente.';
      setResult({ type: 'error', message: msg });
      if (soundEnabled) speak(msg);
    } finally {
      setIsProcessing(false);
      resetTranscript();
      
      // In conversation mode, keep listening
      if (conversationMode) {
        setTimeout(() => {
          if (!isListening) startListening();
        }, 500);
      }
    }
  };

  const handleMicPress = () => {
    if (conversationMode) {
      // Toggle conversation mode off
      setConversationMode(false);
      stopListening();
    } else {
      resetTranscript();
      setResult(null);
      setConversationMode(true);
      startListening();
    }
  };

  const handleSingleCommand = () => {
    setConversationMode(false);
    resetTranscript();
    setResult(null);
    startListening();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Mic className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Assistente de Voz</h3>
              <p className="text-[11px] text-zinc-500">
                {conversationMode ? 'Modo conversa ativo' : 'Toque e fale'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button
              onClick={() => {
                setConversationMode(false);
                stopListening();
                onClose();
              }}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          
          {/* Status */}
          <div className="text-center mb-6">
            {isListening && (
              <div className="animate-pulse">
                <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
                  <Mic className="w-16 h-16 text-white animate-pulse" />
                </div>
                <p className="text-sm font-bold text-purple-400">
                  {conversationMode ? 'Ouvindo... (modo conversa)' : 'Ouvindo...'}
                </p>
                {interimTranscript && (
                  <p className="text-sm text-zinc-400 mt-2 italic max-h-20 overflow-hidden">"{interimTranscript}"</p>
                )}
              </div>
            )}
            
            {isSpeaking && (
              <div className="flex items-center justify-center gap-2 text-blue-400">
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span className="text-sm font-bold">Falando...</span>
              </div>
            )}
            
            {isProcessing && (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                <p className="text-sm font-bold text-amber-400">Processando...</p>
              </div>
            )}
            
            {!isListening && !isProcessing && !isSpeaking && !result && (
              <div>
                <div className="w-32 h-32 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                  <Mic className="w-16 h-16 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-500">
                  {conversationMode 
                    ? 'Modo conversa ativo. Diga algo!'
                    : 'Toque no microfone e fale algo'}
                </p>
                <p className="text-[10px] text-zinc-600 mt-2">
                  Ex: "Adicionar 100 gramas de farinha"
                </p>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={`
              p-4 rounded-xl mb-4 flex items-start gap-3
              ${result.type === 'success' 
                ? 'bg-emerald-500/10 border border-emerald-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
              }
            `}>
              {result.type === 'success' ? (
                <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <p className={`text-sm font-medium ${result.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                {result.message}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl mb-4 bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">
                {error === 'not-allowed' && 'Ative o microfone nas configurações do navegador.'}
                {error === 'no-speech' && 'Não detectei fala. Tente novamente.'}
                {error === 'network' && 'Erro de rede. Verifique sua conexão.'}
                {!['not-allowed', 'no-speech', 'network'].includes(error) && `Erro: ${error}`}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleMicPress}
              disabled={isProcessing}
              className={`
                flex-1 py-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                ${conversationMode 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30' 
                  : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20 hover:from-purple-600 hover:to-indigo-600'
                }
                disabled:opacity-50
              `}
            >
              {conversationMode ? (
                <>
                  <MicOff className="w-5 h-5" />
                  Parar Conversa
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Modo Conversa
                </>
              )}
            </button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Últimas ações
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {history.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-[11px] text-zinc-400"
                  >
                    <span className={item.success ? 'text-emerald-400' : 'text-red-400'}>
                      {item.success ? '✓' : '✗'}
                    </span>
                    <span className="truncate flex-1">{item.action}</span>
                    <span className="text-zinc-600">
                      {item.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Commands */}
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Comandos
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                'Adicionar 100g de farinha',
                'Quanto tenho de açúcar?',
                'Criar insumo leite, 1L, R$4',
              ].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => handleProcessCommand(cmd)}
                  className="px-3 py-1.5 rounded-lg bg-[#1A1A1E] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
