import re
import uuid
from typing import Any, Iterable


def normalize_ingredient_name(name: str) -> str:
    lowered = (name or "").strip().lower()
    collapsed = re.sub(r"\s+", " ", lowered)
    tokens = [token for token in collapsed.split(" ") if token]
    normalized_tokens = [_singularize_token(token) for token in tokens]
    return " ".join(normalized_tokens)


def finalize_shopping_items(
    existing_items: Iterable[dict[str, Any]],
    pantry_items: Iterable[dict[str, Any]],
    candidate_items: Iterable[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    pantry_lookup = {
        normalize_ingredient_name((item or {}).get("name", ""))
        for item in pantry_items
        if (item or {}).get("name")
    }

    merged_by_name: dict[str, dict[str, Any]] = {}
    merged_order: list[str] = []
    for raw_item in [*(existing_items or []), *(candidate_items or [])]:
        prepared = _prepare_item(raw_item)
        if not prepared:
            continue
        normalized = normalize_ingredient_name(prepared["name"])
        if not normalized:
            continue
        if normalized not in merged_by_name:
            merged_order.append(normalized)
        # Keep the latest version of an item if it appears multiple times.
        merged_by_name[normalized] = prepared

    finalized: list[dict[str, Any]] = []
    excluded: list[str] = []
    for normalized in merged_order:
        item = merged_by_name[normalized]
        if normalized in pantry_lookup:
            excluded.append(item["name"])
            continue
        finalized.append(item)

    return finalized, excluded


def _prepare_item(raw_item: Any) -> dict[str, Any] | None:
    if not isinstance(raw_item, dict):
        return None

    name = str(raw_item.get("name", "")).strip()
    if not name:
        return None

    item_id = raw_item.get("id")
    if item_id:
        item_id_str = str(item_id)
    else:
        item_id_str = str(uuid.uuid4())

    return {
        "id": item_id_str,
        "name": name,
        "quantity": _optional_text(raw_item.get("quantity")),
        "unit": _optional_text(raw_item.get("unit")),
        "category": _optional_text(raw_item.get("category")),
        "checked": bool(raw_item.get("checked", False)),
    }


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _singularize_token(token: str) -> str:
    if len(token) <= 3:
        return token
    if token.endswith("ies") and len(token) > 4:
        return f"{token[:-3]}y"
    if token.endswith("es") and len(token) > 4:
        return token[:-2]
    if token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token
