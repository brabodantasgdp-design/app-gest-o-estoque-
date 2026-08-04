import { pipeline, cos_sim } from "@xenova/transformers";

let _extractor: any = null;
let _embeddings: { intent: string; embedding: number[] }[] | null = null;

const INTENTS = [
  { intent: "register_insumo", description: "cadastrar criar adicionar novo insumo item ingrediente materia prima no estoque sistema" },
  { intent: "add_stock", description: "adicionar aumentar entrar chegou receber comprar mais acrescentar repor quantidade no estoque" },
  { intent: "remove_stock", description: "remover gastar usar consumir tirar diminuir baixar sair perdi menos quantidade do estoque" },
  { intent: "query_stock", description: "consultar verificar checar olhar quanto tem qual estoque mostrar exibir informacao item" },
  { intent: "report", description: "resumo relatorio dashboard visao geral status situacao como esta o negocio loja empresa" },
  { intent: "alert", description: "alerta problema critico zerado acabou estoque baixo faltando urgencia atencao" },
  { intent: "create_product", description: "criar cadastrar novo produto item cardapio catalogo preco valor venda" },
  { intent: "navigate", description: "abrir ir navegar para tela modulo aba secao pagina mostrar" },
  { intent: "open_add_form", description: "abrir modal formulario janela de adicionar novo cadastrar insumo produto item" },
];

async function getExtractor() {
  if (!_extractor) _extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return _extractor;
}

async function getEmbeddings() {
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
  score: number;
}

export async function matchIntent(text: string): Promise<SemanticMatch | null> {
  try {
    const embeddings = await getEmbeddings();
    const userEmbedding = await computeEmbedding(text);
    let bestScore = 0, bestIntent = "";
    for (const item of embeddings) {
      const similarity = cos_sim(userEmbedding, item.embedding);
      if (similarity > bestScore) { bestScore = similarity; bestIntent = item.intent; }
    }
    if (bestScore < 0.25) return null;
    return { intent: bestIntent, score: bestScore };
  } catch {
    return null;
  }
}
