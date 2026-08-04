import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare state: ErrorBoundaryState;
  declare props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Render error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center p-6">
          <div className="bg-[#121214] border border-red-500/30 rounded-2xl p-8 max-w-lg w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white">
                  {this.props.fallbackLabel || 'Erro de Renderizacao'}
                </h2>
                <p className="text-xs text-zinc-400">Algo quebrou durante a exibicao da tela</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-xs font-mono text-red-300 break-all">
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
            </div>

            {this.state.errorInfo && (
              <details className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <summary className="text-xs font-bold text-zinc-400 cursor-pointer hover:text-white">
                  Stack do Componente
                </summary>
                <pre className="mt-2 text-[10px] font-mono text-zinc-500 overflow-auto max-h-40 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recarregar App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
