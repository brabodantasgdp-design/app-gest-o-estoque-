from .base import BaseSkill, SkillResult
from supabase_client import require_client
import datetime


def _today(): return datetime.date.today().isoformat()


def _find_and_update(tenant_id: str, name: str, quantity: float, operation: str) -> SkillResult:
    sb = require_client()
    res = sb.table("insumos").select("*").eq("tenant_id", tenant_id).ilike("name", f"%{name}%").limit(1).execute()
    if not res.data:
        return SkillResult(False, f"stock_{operation}", f"Não encontrei '{name}'.")
    item = res.data[0]
    ns = item["current_stock"] + quantity if operation == "add" else max(0, item["current_stock"] - quantity)
    sb.table("insumos").update({"current_stock": ns, "last_updated": _today()}).eq("id", item["id"]).eq("tenant_id", tenant_id).execute()

    unit = item.get("unit", "g")
    if operation == "add":
        low = " ⚠️ Estoque baixo!" if ns <= item.get("min_stock", 0) else ""
        return SkillResult(True, "add_stock", f"+{quantity} de {item['name']}. Total: {ns}{unit}.{low}", {"name": item["name"], "new_stock": ns})
    else:
        if ns <= 0:
            return SkillResult(True, "remove_stock", f"{item['name']} ZEROU!", {"name": item["name"], "new_stock": 0})
        low = " ⚠️ Estoque baixo!" if ns <= item.get("min_stock", 0) else ""
        return SkillResult(True, "remove_stock", f"-{quantity} de {item['name']}. Restam {ns}{unit}.{low}", {"name": item["name"], "new_stock": ns})


class AddStockSkill(BaseSkill):
    name = "add_stock"
    description = "Adicionar quantidade ao estoque"
    triggers = ["adicionar", "entrou", "chegou", "recebi", "colocar", "botar", "somar"]

    def execute(self, tenant_id: str, params: dict) -> SkillResult:
        return _find_and_update(tenant_id, params.get("item_name", ""), params.get("quantity", 0), "add")


class RemoveStockSkill(BaseSkill):
    name = "remove_stock"
    description = "Remover quantidade do estoque"
    triggers = ["gastei", "gastou", "usei", "usou", "remover", "tirar", "baixar", "diminuir", "consumiu", "perdi", "saiu"]

    def execute(self, tenant_id: str, params: dict) -> SkillResult:
        return _find_and_update(tenant_id, params.get("item_name", ""), params.get("quantity", 0), "remove")
