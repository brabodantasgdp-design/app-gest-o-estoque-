"""Skill Registry — cadastro e roteamento de habilidades."""
from .base import BaseSkill, SkillResult
from .register_insumo import RegisterInsumoSkill
from .manage_stock import AddStockSkill, RemoveStockSkill
from .query_stock import QueryStockSkill
from .report import ReportSkill, AlertSkill
from .create_product import CreateProductSkill

# Todas as skills registradas. Adicione novas aqui.
SKILLS: list[BaseSkill] = [
    RegisterInsumoSkill(),
    AddStockSkill(),
    RemoveStockSkill(),
    QueryStockSkill(),
    ReportSkill(),
    AlertSkill(),
    CreateProductSkill(),
]


def find_skill(text: str, params: dict | None = None) -> BaseSkill | None:
    """Encontra a skill que melhor corresponde ao texto."""
    lower = text.lower()

    # Match por triggers
    for skill in SKILLS:
        if skill.matches(text):
            return skill

    # Match por ação explícita nos params
    if params:
        action = params.get("action", "")
        for skill in SKILLS:
            if skill.name == action:
                return skill

    return None


def execute_skill(skill: BaseSkill, tenant_id: str, params: dict) -> SkillResult:
    """Executa uma skill com tratamento de erro."""
    try:
        return skill.execute(tenant_id, params)
    except Exception as e:
        return SkillResult(False, skill.name, f"Erro: {str(e)}")


def list_skills() -> list[dict]:
    """Lista todas as skills disponíveis."""
    return [{"name": s.name, "description": s.description, "triggers": s.triggers[:5]} for s in SKILLS]
