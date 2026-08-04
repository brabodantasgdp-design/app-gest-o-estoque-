"""EBD Agent Executor — executa a intenção contra o Supabase."""
import datetime
from supabase_client import (
    find_insumo, get_all_insumos, get_all_products,
    create_insumo, update_insumo, create_product,
)
from intent_parser import ParsedIntent


def _today():
    return datetime.date.today().isoformat()


def execute(tenant_id: str, intent: ParsedIntent) -> dict:
    """Executa a intenção e retorna { success, action, message, data }."""

    if intent.action == "register":
        p = intent.params
        existing = find_insumo(tenant_id, p["name"])
        if existing:
            return {"success": False, "action": "register", "message": f"Insumo '{existing['name']}' já existe (código: {existing.get('code', 'N/A')})."}
        code = f"INS-{int(datetime.datetime.now().timestamp())}"
        data = {
            "code": code, "name": p["name"], "category": "Geral",
            "unit": p.get("unit", "g"), "current_stock": p.get("quantity", 0),
            "min_stock": max(1, int(p.get("quantity", 0) * 0.2)),
            "unit_cost": p.get("unit_cost", 0), "supplier": "",
            "last_updated": _today(),
        }
        saved = create_insumo(tenant_id, data)
        return {"success": True, "action": "register", "message": f"{saved.get('name', p['name'])} cadastrado. {p.get('quantity', 0)}{p.get('unit', 'g')} em estoque.", "data": saved}

    elif intent.action == "add":
        p = intent.params
        item = find_insumo(tenant_id, p["item_name"])
        if not item:
            return {"success": False, "action": "add", "message": f"Não encontrei '{p['item_name']}'."}
        ns = item["current_stock"] + p.get("quantity", 0)
        update_insumo(item["id"], tenant_id, {"current_stock": ns, "last_updated": _today()})
        low = " ⚠️ Estoque baixo!" if ns <= item.get("min_stock", 0) else ""
        return {"success": True, "action": "add", "message": f"+{p.get('quantity', 0)} de {item['name']}. Total: {ns}{item.get('unit', 'g')}.{low}", "data": {"name": item["name"], "new_stock": ns}}

    elif intent.action == "remove":
        p = intent.params
        item = find_insumo(tenant_id, p["item_name"])
        if not item:
            return {"success": False, "action": "remove", "message": f"Não encontrei '{p['item_name']}'."}
        ns = max(0, item["current_stock"] - p.get("quantity", 0))
        update_insumo(item["id"], tenant_id, {"current_stock": ns, "last_updated": _today()})
        if ns <= 0:
            return {"success": True, "action": "remove", "message": f"{item['name']} ZEROU!", "data": {"name": item["name"], "new_stock": 0}}
        low = " ⚠️ Estoque baixo!" if ns <= item.get("min_stock", 0) else ""
        return {"success": True, "action": "remove", "message": f"-{p.get('quantity', 0)} de {item['name']}. Restam {ns}{item.get('unit', 'g')}.{low}", "data": {"name": item["name"], "new_stock": ns}}

    elif intent.action == "query":
        item = find_insumo(tenant_id, intent.params.get("item_name", ""))
        if not item:
            return {"success": False, "action": "query", "message": f"Não encontrei '{intent.params.get('item_name', '')}'."}
        v = round(item.get("unit_cost", 0) * item.get("current_stock", 0), 2)
        return {"success": True, "action": "query", "message": f"{item['name']}: {item['current_stock']}{item.get('unit', 'g')} | Mín: {item.get('min_stock', 0)} | Valor: R${v}", "data": item}

    elif intent.action == "report":
        ins = get_all_insumos(tenant_id)
        prods = get_all_products(tenant_id)
        alerts = sum(1 for i in ins if i["current_stock"] <= i.get("min_stock", 0))
        return {"success": True, "action": "report", "message": f"{len(ins)} insumos, {len(prods)} produtos. {alerts} alertas.", "data": {"insumos": len(ins), "produtos": len(prods), "alertas": alerts}}

    elif intent.action == "alert":
        ins = get_all_insumos(tenant_id)
        empty = [i for i in ins if i["current_stock"] <= 0]
        critical = [i for i in ins if 0 < i["current_stock"] <= i.get("min_stock", 0) * 0.5]
        low = [i for i in ins if i.get("min_stock", 0) * 0.5 < i["current_stock"] <= i.get("min_stock", 0)]
        if not empty and not critical and not low:
            return {"success": True, "action": "alert", "message": "Tudo ok, sem alertas.", "data": {"empty": 0, "critical": 0, "low": 0}}
        return {"success": True, "action": "alert", "message": f"{len(empty)} zerados, {len(critical)} críticos, {len(low)} baixos.", "data": {"empty": len(empty), "critical": len(critical), "low": len(low), "items": [i["name"] for i in empty + critical + low]}}

    elif intent.action == "product":
        p = intent.params
        data = {
            "name": p["name"], "category": "Geral",
            "sku": f"SKU-{int(datetime.datetime.now().timestamp())}",
            "stock_quantity": 0, "old_price": p.get("price", 0),
            "sale_discount_percent": 0, "new_price": p.get("price", 0),
            "items_sold": 0, "status": "In Stock",
        }
        saved = create_product(tenant_id, data)
        return {"success": True, "action": "product", "message": f"{saved.get('name', p['name'])} criado. R${p.get('price', 0):.2f}.", "data": saved}

    return {"success": False, "action": "unknown", "message": "Não entendi. Tente: cadastrar, adicionar, remover, consultar, resumo ou alertas."}
