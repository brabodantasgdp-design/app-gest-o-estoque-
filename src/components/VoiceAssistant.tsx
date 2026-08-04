import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Check, AlertCircle, Loader2 } from 'lucide-react';
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
  } = useVoiceRecognition();

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [history, setHistory] = useState<Array<{ time: Date; action: string; success: boolean }>>([]);

  useEffect(() => {
    if (transcript && !isListening) {
      handleProcessCommand(transcript);
    }
  }, [transcript, isListening]);

  const handleProcessCommand = async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setResult(null);

    try {
      const command: VoiceCommand = await processVoiceCommand(text, insumos, products, orders);
      
      if (command.confidence < 0.3) {
        setResult({
          type: 'error',
          message: 'Não entendi bem. Tente: "adicionar 100 gramas de farinha"',
        });
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

      setHistory(prev => [{
        time: new Date(),
        action: `${text} → ${responseMessage}`,
        success: responseMessage.startsWith('✓'),
      }, ...prev].slice(0, 5));

    } catch (err) {
      console.error('Error processing command:', err);
      setResult({
        type: 'error',
        message: 'Erro ao processar. Tente novamente.',
      });
    } finally {
      setIsProcessing(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Mic className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Assistente de Voz</h3>
              <p className="text-[11px] text-zinc-500">
                {isSupported ? 'Diga um comando' : 'Não suportado neste navegador'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content */}
        <div className="p-6">
          
          {/* Mic Button */}
          <div className="flex justify-center mb-6">
            <button
              onClick={handleMicPress}
              disabled={!isSupported || isProcessing}
              className={`
                relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300
                ${isListening 
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 scale-110' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/20'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {/* Pulse animation when listening */}
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                  <span className="absolute inset-2 rounded-full bg-red-500/20 animate-pulse" />
                </>
              )}
              
              {isProcessing ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : isListening ? (
                <MicOff className="w-10 h-10 text-white relative z-10" />
              ) : (
                <Mic className="w-10 h-10 text-white relative z-10" />
              )}
            </button>
          </div>

          {/* Status Text */}
          <div className="text-center mb-6">
            {isListening && (
              <div className="animate-pulse">
                <p className="text-sm font-bold text-amber-400">Ouvindo...</p>
                {interimTranscript && (
                  <p className="text-sm text-zinc-400 mt-2 italic">"{interimTranscript}"</p>
                )}
              </div>
            )}
            
            {isProcessing && (
              <p className="text-sm font-bold text-blue-400">Processando...</p>
            )}
            
            {!isListening && !isProcessing && !result && (
              <p className="text-sm text-zinc-500">
                Toque no microfone e fale algo como:<br />
                <span className="text-zinc-400">"Adicionar 100 gramas de farinha"</span>
              </p>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={`
              p-4 rounded-xl mb-6 flex items-start gap-3
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
            <div className="p-4 rounded-xl mb-6 bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">
                {error === 'not-allowed' && 'Permissão do microfone negada. Ative nas configurações.'}
                {error === 'no-speech' && 'Não detectei fala. Tente novamente.'}
                {error === 'network' && 'Erro de rede. Verifique sua conexão.'}
                {!['not-allowed', 'no-speech', 'network'].includes(error) && `Erro: ${error}`}
              </p>
            </div>
          )}

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
          <div className="mt-6 pt-4 border-t border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
              Comandos de exemplo
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                'Adicionar 100g de farinha',
                'Quanto tenho de açúcar?',
                'Criar insumo leite, 1L, R$4',
                'Remover 50ml de leite',
              ].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => {
                    resetTranscript();
                    handleProcessCommand(cmd);
                  }}
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
