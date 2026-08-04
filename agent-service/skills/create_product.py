from .base import BaseSkill, SkillResult
from supabase_client import require_client
import datetime


class CreateProductSkill(BaseSkill):
    name = "create_product"
    description = "Criar novo produto no catálogo"
    triggers = ["criar produto", "cadastrar produto", "novo produto", "cria produto"]

    def execute(self, tenant_id: str, params: dict) -> SkillResult:
        name = params.get("name", "").strip()
        if len(name) < 2:
            return SkillResult(False, self.name, "Nome do produto muito curto.")
        price = params.get("price", 0)
        data = {
            "tenant_id": tenant_id, "name": name, "category": params.get("category", "Geral"),
            "sku": f"SKU-{int(datetime.datetime.now().timestamp())}",
            "stock_quantity": 0, "old_price": price, "sale_discount_percent": 0,
            "new_price": price, "items_sold": 0, "status": "In Stock",
        }
        sb = require_client()
        res = sb.table("products").insert(data).execute()
        saved = (res.data or [{}])[0]
        return SkillResult(True, self.name, f"{saved.get('name', name)} criado. R${price:.2f}.", saved)
