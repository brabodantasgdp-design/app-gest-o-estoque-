from .base import BaseSkill, SkillResult
from supabase_client import require_client


class QueryStockSkill(BaseSkill):
    name = "query_stock"
    description = "Consultar estoque de um insumo"
    triggers = ["quanto tem", "consultar", "estoque de", "qual o estoque", "ver estoque"]

    def execute(self, tenant_id: str, params: dict) -> SkillResult:
        name = params.get("item_name", "").strip()
        if not name:
            return SkillResult(False, self.name, "Especifique o nome do insumo.")
        sb = require_client()
        res = sb.table("insumos").select("*").eq("tenant_id", tenant_id).ilike("name", f"%{name}%").limit(1).execute()
        if not res.data:
            return SkillResult(False, self.name, f"Não encontrei '{name}'.")
        item = res.data[0]
        valor = round(item.get("unit_cost", 0) * item.get("current_stock", 0), 2)
        return SkillResult(True, self.name, f"{item['name']}: {item['current_stock']}{item.get('unit','g')} | Mín: {item.get('min_stock',0)} | Valor: R${valor}", item)
