"""Base Skill — toda habilidade do agente herda daqui."""
from dataclasses import dataclass, field
from supabase_client import require_client


@dataclass
class SkillResult:
    success: bool
    action: str
    message: str
    data: dict | None = None


class BaseSkill:
    """Habilidade base. Subclasse e implemente `execute(tenant_id, params)`."""

    name: str = "base"
    description: str = ""
    triggers: list[str] = field(default_factory=list)  # palavras-chave que ativam

    def execute(self, tenant_id: str, params: dict) -> SkillResult:
        raise NotImplementedError

    def matches(self, text: str) -> bool:
        """Verifica se esta skill deve ser ativada baseado nas triggers."""
        lower = text.lower()
        return any(t in lower for t in self.triggers)
