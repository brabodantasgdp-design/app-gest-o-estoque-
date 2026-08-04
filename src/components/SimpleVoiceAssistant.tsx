import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Camera, Send } from 'lucide-react';

interface SimpleVoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string) => void;
}

export const SimpleVoiceAssistant: React.FC<SimpleVoiceAssistantProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setResponse('❌ Reconhecimento de voz não suportado neste navegador');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'pt-BR';
    recognitionRef.current.interimResults = false;
    recognitionRef.current.continuous = false;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setResponse('');
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      processCommand(text);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setResponse('❌ Permissão de microfone negada. Habilite nas configurações do navegador.');
      } else {
        setResponse('❌ Erro ao capturar áudio. Tente novamente.');
      }
    };

    recognitionRef.current.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const processCommand = async (text: string) => {
    setIsProcessing(true);
    const lower = text.toLowerCase();

    // Simple, reliable commands
    if (lower.includes('estoque') || lower.includes('insumo')) {
      onNavigate('insumos');
      setResponse('📦 Abrindo estoque...');
    } else if (lower.includes('produto') || lower.includes('cardápio')) {
      onNavigate('products');
      setResponse('🏷️ Abrindo produtos...');
    } else if (lower.includes('pedido') || lower.includes('comanda')) {
      onNavigate('orders');
      setResponse('🛒 Abrindo pedidos...');
    } else if (lower.includes('ficha') || lower.includes('receita')) {
      onNavigate('fichas');
      setResponse('📝 Abrindo fichas técnicas...');
    } else if (lower.includes('nota') || lower.includes('nf') || lower.includes('scan')) {
      onNavigate('invoices');
      setResponse('📄 Abrindo notas fiscais...');
    } else if (lower.includes('dashboard') || lower.includes('início') || lower.includes('home')) {
      onNavigate('dashboard');
      setResponse('📊 Abrindo dashboard...');
    } else if (lower.includes('ajuda') || lower.includes('help')) {
      setResponse(`💡 Comandos disponíveis:
• "Abrir estoque" - Vai para insumos
• "Abrir produtos" - Vai para produtos
• "Abrir pedidos" - Vai para pedidos
• "Abrir fichas" - Vai para fichas técnicas
• "Scanear nota" - Vai para OCR
• "Dashboard" - Vai para início`);
    } else {
      setResponse(`Não entendi: "${text}". Diga "ajuda" para ver comandos.`);
    }

    setIsProcessing(false);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim()) {
      processCommand(transcript);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md bg-[#121214] rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Mic className="w-4 h-4 text-black" />
            </div>
            <span className="text-sm font-bold text-white">Assistente de Voz</span>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {/* Mic Button */}
          <div className="flex justify-center">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                isListening 
                  ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-500 hover:scale-105 shadow-lg shadow-orange-500/30'
              }`}
            >
              {isListening ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
          </div>

          {/* Status */}
          <div className="text-center">
            {isListening ? (
              <p className="text-sm text-red-400 animate-pulse">🔴 Ouvindo...</p>
            ) : isProcessing ? (
              <p className="text-sm text-blue-400">Processando...</p>
            ) : (
              <p className="text-sm text-zinc-500">Toque no microfone e fale</p>
            )}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <p className="text-xs text-zinc-400 mb-1">Você disse:</p>
              <p className="text-sm text-white">{transcript}</p>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-300 whitespace-pre-line">{response}</p>
            </div>
          )}

          {/* Text Input */}
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Ou digite aqui..."
              className="flex-1 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-500"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '📦 Estoque', action: 'insumos' },
              { label: '🏷️ Produtos', action: 'products' },
              { label: '🛒 Pedidos', action: 'orders' },
              { label: '📝 Fichas', action: 'fichas' },
              { label: '📄 Notas', action: 'invoices' },
              { label: '📊 Home', action: 'dashboard' },
            ].map((item) => (
              <button
                key={item.action}
                onClick={() => {
                  onNavigate(item.action);
                  setResponse(`Abrindo ${item.label}...`);
                }}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-white hover:border-zinc-700"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
