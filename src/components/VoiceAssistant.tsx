import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Check, AlertCircle, Loader2, Volume2, VolumeX, HelpCircle, Zap } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { processVoiceCommand, executeVoiceCommand, VoiceCommand } from '../services/voiceService';
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
  onCreateInsumo: (name: string, quantity: number, unit: string, price: number) => Promise<void>;
  onDeleteInsumo: (name: string) => Promise<void>;
  onCreateProduct: (name: string, price: number) => Promise<void>;
  onUpdateProduct: (name: string, price: number) => Promise<void>;
  onDeleteProduct: (name: string) => Promise<void>;
  onCreateOrder: (customer: string, product: string, quantity: number) => Promise<void>;
  onQueryStock: (name: string) => { currentStock: number; unit: string } | null;
  onGetDashboardSummary: () => any;
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
  onCreateInsumo,
  onDeleteInsumo,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onCreateOrder,
  onQueryStock,
  onGetDashboardSummary,
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
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [history, setHistory] = useState<Array<{ time: Date; action: string; success: boolean }>>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [conversationMode, setConversationMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
      const context = {
        insumos,
        products,
        orders,
        fichas,
        invoices,
        tenant,
      };

      const command: VoiceCommand = await processVoiceCommand(text, context);
      
      if (command.confidence < 0.3) {
        const msg = 'Não entendi bem. Pode repetir?';
        setResult({ type: 'error', message: msg });
        if (soundEnabled) speak(msg);
        setHistory(prev => [{ time: new Date(), action: text, success: false }, ...prev].slice(0, 10));
        return;
      }

      const responseMessage = await executeVoiceCommand(command, context, {
        navigate: onNavigate,
        addStock: onAddStock,
        removeStock: onRemoveStock,
        createInsumo: onCreateInsumo,
        deleteInsumo: onDeleteInsumo,
        createProduct: onCreateProduct,
        updateProduct: onUpdateProduct,
        deleteProduct: onDeleteProduct,
        createOrder: onCreateOrder,
        queryStock: onQueryStock,
        getDashboardSummary: onGetDashboardSummary,
        close: onClose,
      });

      const isSuccess = responseMessage.startsWith('✓') || responseMessage.startsWith('Abrindo');
      setResult({
        type: isSuccess ? 'success' : 'info',
        message: responseMessage,
      });

      if (soundEnabled) {
        speak(responseMessage.replace('✓ ', ''));
      }

      setHistory(prev => [{
        time: new Date(),
        action: `${text} → ${responseMessage}`,
        success: isSuccess,
      }, ...prev].slice(0, 10));

    } catch (err) {
      console.error('Error processing command:', err);
      const msg = 'Erro ao processar. Tente novamente.';
      setResult({ type: 'error', message: msg });
      if (soundEnabled) speak(msg);
    } finally {
      setIsProcessing(false);
      resetTranscript();
      
      if (conversationMode) {
        setTimeout(() => {
          if (!isListening) startListening();
        }, 500);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">EBD AI</h3>
              <p className="text-[11px] text-zinc-500">
                {conversationMode ? '🔴 Modo conversa ativo' : 'Toque e fale'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
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

        {/* Help Panel */}
        {showHelp && (
          <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 space-y-2 flex-shrink-0">
            <p className="font-bold text-white">Comandos disponíveis:</p>
            <ul className="space-y-1">
              <li>• <span className="text-amber-400">"Abrir pedidos"</span> - Navega pro módulo</li>
              <li>• <span className="text-amber-400">"Adicionar 100g de farinha"</span> - Atualiza estoque</li>
              <li>• <span className="text-amber-400">"Criar produto pizza R$25"</span> - Cria produto</li>
              <li>• <span className="text-amber-400">"Quanto tenho de açúcar?"</span> - Consulta estoque</li>
              <li>• <span className="text-amber-400">"Gerar relatório de vendas"</span> - Abre relatório</li>
              <li>• <span className="text-amber-400">"O que posso melhorar?"</span> - Dá insights</li>
            </ul>
          </div>
        )}

        {/* Main Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* Status */}
          <div className="text-center mb-6">
            {isListening && (
              <div className="animate-pulse">
                <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30 animate-pulse">
                  <Mic className="w-16 h-16 text-black" />
                </div>
                <p className="text-sm font-bold text-amber-400">
                  {conversationMode ? 'Ouvindo... (conversa)' : 'Ouvindo...'}
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
                <div className="w-32 h-32 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4 border-2 border-zinc-700">
                  <Zap className="w-16 h-16 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-500">
                  {conversationMode 
                    ? 'Modo conversa ativo. Diga algo!'
                    : 'Toque no microfone e fale'}
                </p>
                <p className="text-[10px] text-zinc-600 mt-2">
                  Ex: "Abrir pedidos" ou "Adicionar 100g de farinha"
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
                : result.type === 'error'
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-blue-500/10 border border-blue-500/20'
              }
            `}>
              {result.type === 'success' ? (
                <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : result.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              ) : (
                <Zap className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              )}
              <p className={`text-sm font-medium ${
                result.type === 'success' ? 'text-emerald-300' : 
                result.type === 'error' ? 'text-red-300' : 'text-blue-300'
              }`}>
                {result.message}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl mb-4 bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">
                {error === 'not-allowed' && 'Ative o microfone nas configurações.'}
                {error === 'no-speech' && 'Não detectei fala. Tente novamente.'}
                {error === 'network' && 'Erro de rede. Verifique sua conexão.'}
                {!['not-allowed', 'no-speech', 'network'].includes(error) && `Erro: ${error}`}
              </p>
            </div>
          )}

          {/* Action Button */}
          <div className="mb-4">
            <button
              onClick={handleMicPress}
              disabled={isProcessing}
              className={`
                w-full py-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                ${conversationMode 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-orange-500/20 hover:from-amber-600 hover:to-orange-600'
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
                  Falar com EBD AI
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
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-[11px] text-zinc-400 p-2 rounded-lg bg-zinc-900"
                  >
                    <span className={item.success ? 'text-emerald-400' : 'text-red-400'}>
                      {item.success ? '✓' : '✗'}
                    </span>
                    <span className="truncate flex-1">{item.action}</span>
                    <span className="text-zinc-600 text-[10px]">
                      {item.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
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
