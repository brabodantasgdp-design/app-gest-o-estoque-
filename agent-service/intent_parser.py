"""Motor de intenção — regex + fuzzy matching. Zero LLM, zero cota."""
import re
from rapidfuzz import fuzz, process
from dataclasses import dataclass, field


@dataclass
class ParsedIntent:
    action: str  # "register", "add", "remove", "query", "report", "alert", "product"
    params: dict = field(default_factory=dict)
    confidence: float = 1.0
    raw: str = ""


UNIT_MAP = {"kg": ("g", 1000), "kilo": ("g", 1000), "quilo": ("g", 1000),
            "l": ("ml", 1000), "litro": ("ml", 1000), "litros": ("ml", 1000),
            "g": ("g", 1), "grama": ("g", 1), "gramas": ("g", 1),
            "ml": ("ml", 1), "mililitro": ("ml", 1), "un": ("un", 1),
            "unidade": ("un", 1), "unidades": ("un", 1)}


def _parse_quantity_and_unit(s: str) -> tuple[float, str]:
    """Extrai quantidade e normaliza unidade. Ex: '5kg' → (5000, 'g')"""
    m = re.match(r"(\d+[\.,]?\d*)\s*(g|ml|un|kg|kilo|quilo|l|litro|litros|grama|gramas|mililitro|unidade|unidades)?", s)
    if not m:
        return 0, "g"
    qty = float(m.group(1).replace(",", "."))
    raw_unit = m.group(2) or "g"
    unit, factor = UNIT_MAP.get(raw_unit, ("g", 1))
    return qty * factor, unit


def fuzzy_match_name(query: str, candidates: list[str], threshold: int = 75) -> str | None:
    """Encontra o melhor match fuzzy entre os nomes conhecidos."""
    if not candidates or not query:
        return None
    result = process.extractOne(query, candidates, scorer=fuzz.partial_ratio, score_cutoff=threshold)
    return result[0] if result else None


def parse(text: str, known_names: list[str] | None = None) -> ParsedIntent:
    """
    Analisa o texto e retorna a intenção estruturada.
    
    Args:
        text: texto do usuário
        known_names: lista de nomes de insumos/produtos conhecidos (para fuzzy match)
    """
    t = text.strip()
    lower = t.lower()
    names = known_names or []

    # --- CADASTRAR INSUMO ---
    m = re.match(r"(?:cadastrar?|criar?|cria|novo)\s+(?:insumo|item|ingrediente)?\s*(.+?)(?:\s+(\d+[\.,]?\d*\s*(?:g|ml|un|kg|kilo|quilo|l|litro|litros|grama|gramas|mililitro|unidade|unidades)))?(?:\s+(?:pre[çc]o|custo|a|por)\s*r?\$?\s*(\d+[\.,]?\d*))?\s*$", lower)
    if m:
        name = m.group(1).strip()
        qty_str = m.group(2) or "0"
        price_str = m.group(3)
        qty, unit = _parse_quantity_and_unit(qty_str)
        price = float(price_str.replace(",", ".")) if price_str else 0
        if len(name) >= 2:
            return ParsedIntent("register", {"name": name, "quantity": qty, "unit": unit, "unit_cost": price}, raw=t)

    # --- ADICIONAR ESTOQUE ---
    m = re.match(r"(?:adicione?|adicionar|entrou|chegou|recebi|coloca|bota|somou?)\s+(\d+[\.,]?\d*\s*(?:g|ml|un|kg|kilo|quilo|l|litro|litros|grama|gramas|mililitro|unidade|unidades))?\s*(.+?)$", lower)
    if m:
        qty_str = m.group(1) or "1"
        name = m.group(2).strip()
        qty, unit = _parse_quantity_and_unit(qty_str)
        # Fuzzy match se tiver nomes conhecidos
        if names:
            matched = fuzzy_match_name(name, names, threshold=70)
            if matched:
                return ParsedIntent("add", {"item_name": matched, "quantity": qty, "unit": unit}, confidence=0.85, raw=t)
        return ParsedIntent("add", {"item_name": name, "quantity": qty, "unit": unit}, raw=t)

    # --- REMOVER ESTOQUE ---
    m = re.match(r"(?:gastou?|gastei|usou?|usei|remove?|remover|tirar|baixar|diminuir|consumiu|perdi|saiu)\s+(\d+[\.,]?\d*\s*(?:g|ml|un|kg|kilo|quilo|l|litro|litros|grama|gramas|mililitro|unidade|unidades))?\s*(.+?)$", lower)
    if m:
        qty_str = m.group(1) or "1"
        name = m.group(2).strip()
        qty, unit = _parse_quantity_and_unit(qty_str)
        if names:
            matched = fuzzy_match_name(name, names, threshold=70)
            if matched:
                return ParsedIntent("remove", {"item_name": matched, "quantity": qty, "unit": unit}, confidence=0.85, raw=t)
        return ParsedIntent("remove", {"item_name": name, "quantity": qty, "unit": unit}, raw=t)

    # --- CONSULTAR ESTOQUE ---
    m = re.match(r"(?:quanto|qual|estoque|consultar?)\s+(?:tem|tenho|est[aá])?\s*(?:de|do|da)?\s*(.+?)$", lower)
    if m:
        name = m.group(1).strip()
        if names:
            matched = fuzzy_match_name(name, names, threshold=65)
            if matched:
                return ParsedIntent("query", {"item_name": matched}, confidence=0.9, raw=t)
        return ParsedIntent("query", {"item_name": name}, raw=t)

    # --- RESUMO ---
    if re.search(r"(?:resumo|relat[oó]rio|como\s+(?:est[aá]|t[aá])|dashboard|vis[aã]o\s+geral)", lower):
        return ParsedIntent("report", {}, raw=t)

    # --- ALERTAS ---
    if re.search(r"(?:alerta|estoque\s+baixo|cr[ií]tico|zerado|acabou|problema|sem\s+estoque)", lower):
        return ParsedIntent("alert", {}, raw=t)

    # --- CRIAR PRODUTO ---
    m = re.match(r"(?:criar?|cria|cadastrar?)\s+(?:produto|prod|item)\s+(.+?)(?:\s+(?:pre[çc]o|por|a)\s*r?\$?\s*(\d+[\.,]?\d*))?\s*$", lower)
    if m:
        name = m.group(1).strip()
        price_str = m.group(2)
        price = float(price_str.replace(",", ".")) if price_str else 0
        return ParsedIntent("product", {"name": name, "price": price}, raw=t)

    return ParsedIntent("unknown", {}, confidence=0, raw=t)
