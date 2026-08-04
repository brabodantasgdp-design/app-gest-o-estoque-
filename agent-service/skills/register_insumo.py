from .base import BaseSkill, SkillResult
from supabase_client import require_client
import datetime, re


def _today(): return datetime.date.today().isoformat()


class RegisterInsumoSkill(BaseSkill):
    name = "register_insumo"
    description = "Cadastrar novo insumo no estoque"
    triggers = ["cadastrar", "criar insumo", "novo insumo", "cadastra", "registrar insumo"]

    def execute(self, tenant_id: str, params: dict) -> SkillResult:
        name = params.get("name", "").strip()
        if len(name) < 2:
            return SkillResult(False, self.name, "Nome do insumo muito curto.")

        sb = require_client()
        existing = sb.table("insumos").select("id,name,code").eq("tenant_id", tenant_id).ilike("name", f"%{name}%").limit(1).execute()
        if existing.data:
            return SkillResult(False, self.name, f"Insumo '{existing.data[0]['name']}' já existe (código: {existing.data[0].get('code', 'N/A')}).")

        code = f"INS-{int(datetime.datetime.now().timestamp())}"
        qty = params.get("quantity", 0)
        unit = params.get("unit", "g")
        data = {
            "tenant_id": tenant_id, "code": code, "name": name, "category": params.get("category", "Geral"),
            "unit": unit, "current_stock": qty, "min_stock": max(1, int(qty * 0.2)),
            "unit_cost": params.get("unit_cost", 0), "supplier": params.get("supplier", ""),
            "last_updated": _today(),
        }
        sb.table("insumos").insert(data).execute()
        return SkillResult(True, self.name, f"{name} cadastrado. {qty}{unit} em estoque.", data)
