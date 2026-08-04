from .base import BaseSkill, SkillResult
from supabase_client import require_client


class ReportSkill(BaseSkill):
    name = "report"
    description = "Relatório rápido do negócio"
    triggers = ["resumo", "relatório", "relatorio", "como tá", "como esta", "dashboard", "visão geral"]

    def execute(self, tenant_id: str, params: dict) -> SkillResult:
        sb = require_client()
        ins = sb.table("insumos").select("id,current_stock,min_stock").eq("tenant_id", tenant_id).execute().data or []
        prods = sb.table("products").select("id").eq("tenant_id", tenant_id).execute().data or []
        alerts = sum(1 for i in ins if i["current_stock"] <= i.get("min_stock", 0))
        return SkillResult(True, self.name, f"{len(ins)} insumos, {len(prods)} produtos. {alerts} alertas.", {"insumos": len(ins), "produtos": len(prods), "alertas": alerts})


class AlertSkill(BaseSkill):
    name = "alert"
    description = "Verificar alertas de estoque"
    triggers = ["alerta", "estoque baixo", "crítico", "critico", "zerado", "acabou", "problema", "sem estoque"]

    def execute(self, tenant_id: str, params: dict) -> SkillResult:
        sb = require_client()
        ins = sb.table("insumos").select("name,current_stock,min_stock").eq("tenant_id", tenant_id).execute().data or []
        empty = [i for i in ins if i["current_stock"] <= 0]
        critical = [i for i in ins if 0 < i["current_stock"] <= i.get("min_stock", 0) * 0.5]
        low = [i for i in ins if i.get("min_stock", 0) * 0.5 < i["current_stock"] <= i.get("min_stock", 0)]
        if not empty and not critical and not low:
            return SkillResult(True, self.name, "Tudo ok, sem alertas.")
        return SkillResult(True, self.name, f"{len(empty)} zerados, {len(critical)} críticos, {len(low)} baixos.", {"empty": len(empty), "critical": len(critical), "low": len(low), "items": [i["name"] for i in empty + critical + low]})
