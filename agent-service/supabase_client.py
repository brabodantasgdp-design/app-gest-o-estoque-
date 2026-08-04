"""Supabase client — todas as queries com filtro obrigatório de tenant_id."""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("SUPABASE_URL", "")
_key = os.getenv("SUPABASE_ANON_KEY", "")
_supabase: Client | None = create_client(_url, _key) if _url and _key else None


def _require_client() -> Client:
    if not _supabase:
        raise RuntimeError("SUPABASE_URL/SUPABASE_ANON_KEY não configurados")
    return _supabase


def find_insumo(tenant_id: str, name: str) -> dict | None:
    """Busca insumo por nome (case insensitive, partial match)."""
    sb = _require_client()
    res = sb.table("insumos").select("*").eq("tenant_id", tenant_id).ilike("name", f"%{name}%").limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def search_insumos(tenant_id: str, name: str) -> list[dict]:
    """Busca insumos com fuzzy match (retorna todos os possíveis)."""
    sb = _require_client()
    res = sb.table("insumos").select("id,name,current_stock,unit,min_stock,unit_cost").eq("tenant_id", tenant_id).ilike("name", f"%{name}%").limit(5).execute()
    return res.data or []


def get_all_insumos(tenant_id: str) -> list[dict]:
    sb = _require_client()
    res = sb.table("insumos").select("id,name,current_stock,unit,min_stock,unit_cost,category").eq("tenant_id", tenant_id).execute()
    return res.data or []


def get_all_products(tenant_id: str) -> list[dict]:
    sb = _require_client()
    res = sb.table("products").select("id,name,new_price,items_sold").eq("tenant_id", tenant_id).execute()
    return res.data or []


def create_insumo(tenant_id: str, data: dict) -> dict:
    sb = _require_client()
    data["tenant_id"] = tenant_id
    res = sb.table("insumos").insert(data).execute()
    return (res.data or [{}])[0]


def update_insumo(insumo_id: str, tenant_id: str, data: dict) -> dict:
    sb = _require_client()
    res = sb.table("insumos").update(data).eq("id", insumo_id).eq("tenant_id", tenant_id).execute()
    return (res.data or [{}])[0]


def create_product(tenant_id: str, data: dict) -> dict:
    sb = _require_client()
    data["tenant_id"] = tenant_id
    res = sb.table("products").insert(data).execute()
    return (res.data or [{}])[0]
