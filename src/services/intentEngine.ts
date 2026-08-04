/**
 * Motor de Intenção Semântica — Embeddings locais (MiniLM)
 * 
 * Troca regex cego por similaridade semântica.
 * Modelo roda no browser via WebAssembly, zero custo.
 */
import { pipeline, cos_sim } from "@xenova/transformers";

let _extractor: any = null;
let _embeddings: { intent: string; embedding: number[] }[] | null = null;

const INTENTS: { intent: string; description: string }[] = [
  {
    intent: "register_insumo",
    description: "cadastrar criar adicionar novo insumo item ingrediente matéria prima produto no estoque sistema",
  },
  {
    intent: "add_stock",
    description: "adicionar aumentar entrar chegou receber comprar mais acrescentar repor quantidade no estoque",
  },
  {
    intent: "remove_stock",
    description: "remover gastar usar consumir tirar diminuir baixar sair perdi menos quantidade do estoque",
  },
  {
    intent: "query_stock",
    description: "consultar verificar checar olhar quanto tem qual estoque mostrar exibir informação item",
  },
  {
    intent: "report",
    description: "resumo relatório dashboard visão geral status situação como está o negócio loja empresa",
  },
  {
    intent: "alert",
    description: "alerta problema crítico zerado acabou estoque baixo faltando urgente atenção",
  },
  {
    intent: "create_product",
    description: "criar cadastrar novo produto item cardápio catálogo preço valor venda",
  },
];

async function getExtractor() {
  if (!_extractor) {
    _extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return _extractor;
}

async function getEmbeddings(): Promise<{ intent: string; embedding: number[] }[]> {
  if (_embeddings) return _embeddings;
  const extractor = await getExtractor();
  _embeddings = [];
  for (const item of INTENTS) {
    const result = await extractor(item.description, { pooling: "mean", normalize: true });
    _embeddings.push({ intent: item.intent, embedding: Array.from(result.data) });
  }
  return _embeddings;
}

async function computeEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const result = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(result.data);
}

export interface SemanticMatch {
  intent: string;
  score: number; // 0..1
}

export async function matchIntent(text: string): Promise<SemanticMatch | null> {
  try {
    const embeddings = await getEmbeddings();
    const userEmbedding = await computeEmbedding(text);
    
    let bestScore = 0;
    let bestIntent = "";

    for (const item of embeddings) {
      const similarity = cos_sim(userEmbedding, item.embedding);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestIntent = item.intent;
      }
    }

    // Threshold: abaixo de 0.25 não tem confiança suficiente
    if (bestScore < 0.25) return null;

    return { intent: bestIntent, score: bestScore };
  } catch (err) {
    console.warn("[Semantic] Model not loaded, falling back to regex");
    return null;
  }
}
