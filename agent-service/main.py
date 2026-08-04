"""EBD Agent — API REST Multi-Tenant com Skills Modulares.
   
Uso:
  POST /ebd/process  → processa comando de texto
  GET  /ebd/skills   → lista habilidades disponíveis
  
Deploy:
  pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000
"""
import os, re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from rapidfuzz import fuzz, process

from skills import SKILLS, find_skill, execute_skill, list_skills
from skills.base import SkillResult
from supabase_client import require_client

load_dotenv()

app = FastAPI(title="EBD Agent", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- Conversão de unidades ---
UNIT_MAP = {"kg": ("g", 1000), "kilo": ("g", 1000), "quilo": ("g", 1000),
            "l": ("ml", 1000), "litro": ("ml", 1000), "litros": ("ml", 1000),
            "g": ("g", 1), "grama": ("g", 1), "gramas": ("g", 1),
            "ml": ("ml", 1), "mililitro": ("ml", 1), "un": ("un", 1),
            "unidade": ("un", 1), "unidades": ("un", 1)}


def _parse_qty(s: str) -> tuple[float, str]:
    m = re.match(r"(\d+[\.,]?\d*)\s*(g|ml|un|kg|kilo|quilo|l|litro|litros|grama|gramas|mililitro|unidade|unidades)?", s.strip())
    if not m: return 0, "g"
    qty = float(m.group(1).replace(",", "."))
    raw = m.group(2) or "g"
    unit, factor = UNIT_MAP.get(raw, ("g", 1))
    return qty * factor, unit


def _fuzzy(text: str, candidates: list[str], cutoff: int = 70) -> str | None:
    if not text or not candidates: return None
    r = process.extractOne(text, candidates, scorer=fuzz.partial_ratio, score_cutoff=cutoff)
    return r[0] if r else None


def _extract_params(text: str, tenant_id: str) -> dict:
    """Extrai parâmetros do texto com fuzzy matching."""
    lower = text.lower()
    params: dict = {}

    # Tentar carregar nomes conhecidos
    names: list[str] = []
    try:
        sb = require_client()
        res = sb.table("insumos").select("name").eq("tenant_id", tenant_id).execute()
        names = [r["name"] for r in (res.data or [])]
    except Exception:
        pass

    # Registrar insumo
    m = re.match(r"(?:cadastrar?|criar?|cria|novo)\s+(?:insumo|item|ingrediente)?\s*(.+?)(?:\s+(\d+[\.,]?\d*\s*(?:g|ml|un|kg|kilo|quilo|l|litro|unidade|unidades)))?(?:\s+(?:pre[çc]o|custo|a|por)\s*r?\$?\s*(\d+[\.,]?\d*))?\s*$", lower)
    if m:
        name = m.group(1).strip()
        qty_str = m.group(2) or "0"
        price_str = m.group(3)
        qty, unit = _parse_qty(qty_str)
        price = float(price_str.replace(",", ".")) if price_str else 0
        if len(name) >= 2:
            params.update({"name": name, "quantity": qty, "unit": unit, "unit_cost": price})
            return params

    # Adicionar/remover estoque
    for pattern, action in [
        (r"(?:adicione?|adicionar|entrou|chegou|recebi|coloca|bota)\s+(\d+[\.,]?\d*\s*(?:g|ml|un|kg|kilo|quilo|l|litro|unidade|unidades)?)?\s*(.+?)$", "add"),
        (r"(?:gastou?|gastei|usou?|usei|remove?|remover|tirar|baixar|diminuir|consumiu|perdi)\s+(\d+[\.,]?\d*\s*(?:g|ml|un|kg|kilo|quilo|l|litro|unidade|unidades)?)?\s*(.+?)$", "remove"),
    ]:
        m = re.match(pattern, lower)
        if m:
            qty_str = m.group(1) or "1"
            name = m.group(2).strip()
            qty, unit = _parse_qty(qty_str)
            matched = _fuzzy(name, names, 70)
            params.update({"item_name": matched or name, "quantity": qty, "unit": unit})
            return params

    # Consultar
    m = re.match(r"(?:quanto|qual|estoque|consultar?)\s+(?:tem|tenho|est[aá])?\s*(?:de|do|da)?\s*(.+?)$", lower)
    if m:
        name = m.group(1).strip()
        matched = _fuzzy(name, names, 65)
        params.update({"item_name": matched or name})
        return params

    # Criar produto
    m = re.match(r"(?:criar?|cria|cadastrar?)\s+(?:produto|prod|item)\s+(.+?)(?:\s+(?:pre[çc]o|por|a)\s*r?\$?\s*(\d+[\.,]?\d*))?\s*$", lower)
    if m:
        name = m.group(1).strip()
        price_str = m.group(2)
        params.update({"name": name, "price": float(price_str.replace(",", ".")) if price_str else 0})
        return params

    return params


# --- Models ---
class ProcessRequest(BaseModel):
    tenant_id: str
    text: str


class ProcessResponse(BaseModel):
    success: bool
    action: str
    message: str
    data: dict | None = None


# --- Routes ---
@app.get("/")
def health():
    return {"status": "ok", "service": "EBD Agent v2", "skills": len(SKILLS)}


@app.get("/ebd/skills")
def get_skills():
    return {"skills": list_skills()}


@app.post("/ebd/process", response_model=ProcessResponse)
def process_command(req: ProcessRequest):
    """Processa comando com skills modulares + fuzzy matching."""
    try:
        # Extrai parâmetros e encontra a skill
        params = _extract_params(req.text, req.tenant_id)
        skill = find_skill(req.text, params)

        if not skill:
            return ProcessResponse(
                success=False, action="unknown",
                message="Não entendi. Tente:\n• cadastrar [nome] [qtd]\n• adicionar [qtd] de [nome]\n• gastar [qtd] de [nome]\n• consultar [nome]\n• resumo / alertas\n• criar produto [nome] preço [valor]"
            )

        result = execute_skill(skill, req.tenant_id, params)
        return ProcessResponse(success=result.success, action=result.action, message=result.message, data=result.data)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
