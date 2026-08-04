"""EBD Agent — API REST Multi-Tenant de Processamento de Comandos.
   
Uso:
  POST /ebd/process
  Body: { "tenant_id": "...", "text": "cadastrar farinha 500g" }
  
Deploy:
  pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from intent_parser import parse
from ebd_executor import execute
from supabase_client import get_all_insumos as _get_insumos, get_all_products as _get_products

load_dotenv()

app = FastAPI(title="EBD Agent", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ProcessRequest(BaseModel):
    tenant_id: str
    text: str


class ProcessResponse(BaseModel):
    success: bool
    action: str
    message: str
    data: dict | None = None


@app.get("/")
def health():
    return {"status": "ok", "service": "EBD Agent"}


@app.post("/ebd/process", response_model=ProcessResponse)
def process_command(req: ProcessRequest):
    """Processa comando de texto com fuzzy matching contra o catálogo do tenant."""
    try:
        # Carrega nomes conhecidos para fuzzy match
        names = []
        try:
            insumos = _get_insumos(req.tenant_id)
            names = [i["name"] for i in insumos]
        except Exception:
            pass  # Supabase offline → segue sem fuzzy match

        intent = parse(req.text, known_names=names)

        if intent.action == "unknown":
            return ProcessResponse(
                success=False, action="unknown",
                message="Não entendi. Comandos:\n• cadastrar [nome] [qtd]\n• adicionar [qtd] de [nome]\n• gastar [qtd] de [nome]\n• consultar [nome]\n• resumo\n• alertas\n• criar produto [nome] preço [valor]"
            )

        result = execute(req.tenant_id, intent)
        return ProcessResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
