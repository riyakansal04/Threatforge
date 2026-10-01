"""Small helpers shared by the mapper: key cleaning, coercion, merging."""
import hashlib
import json
import re

ID_KEYS = (
    "component_id", "interface_id", "store_id", "flow_id", "integration_id", "control_id",
    "reference_id", "threat_id", "relationship_id", "convergence_id", "diagram_id", "id",
)


def snake(key) -> str:
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", str(key).strip())
    return re.sub(r"[^0-9a-zA-Z]+", "_", s).strip("_").lower()


def snake_keys(node):
    if isinstance(node, dict):
        return {snake(k): snake_keys(v) for k, v in node.items()}
    if isinstance(node, list):
        return [snake_keys(v) for v in node]
    return node


def is_empty(v) -> bool:
    if v is None:
        return True
    if isinstance(v, str):
        return not v.strip()
    if isinstance(v, (list, dict, tuple, set)):
        return len(v) == 0
    return False


def as_text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, (int, float, bool)):
        return str(v)
    if isinstance(v, list):
        return "; ".join(t for t in (as_text(i) for i in v) if t)
    if isinstance(v, dict):
        return "; ".join(f"{k}: {as_text(x)}" for k, x in v.items() if not is_empty(x))
    return str(v)


def as_list(v, key_field: str = "name") -> list:
    if is_empty(v):
        return []
    if isinstance(v, list):
        return [i for i in v if not is_empty(i)]
    if isinstance(v, dict):
        if all(isinstance(x, dict) for x in v.values()):
            out = []
            for k, x in v.items():
                item = dict(x)
                item.setdefault(key_field, k)
                out.append(item)
            return out
        if all(not isinstance(x, (dict, list)) for x in v.values()):
            return [{"name": k, "value": x} for k, x in v.items() if not is_empty(x)]
        return [v]
    return [v]


REF_ALIASES = {
    "reference_id": ("reference_id", "id"),
    "file_or_location": ("file_or_location", "file", "path", "file_path", "location", "uri", "source", "filename"),
    "line_or_range_if_available": ("line_or_range_if_available", "line", "lines", "line_range", "range", "start_line"),
    "description": ("description", "note", "notes", "message", "text", "summary"),
    "evidence_type": ("evidence_type", "type", "kind"),
}


def normalize_reference(r):
    if isinstance(r, str):
        return {"file_or_location": r.strip()} if r.strip() else None
    if isinstance(r, dict):
        out = {}
        for canon, aliases in REF_ALIASES.items():
            for a in aliases:
                if not is_empty(r.get(a)):
                    out[canon] = as_text(r[a])
                    break
        return out or None
    return None


def normalize_refs(v) -> list:
    out = []
    for r in as_list(v, "file_or_location"):
        n = normalize_reference(r)
        if n:
            out = merge_lists(out, [n])
    return out


def _norm(s) -> str:
    return " ".join(str(s).lower().split())


def identity(item) -> str:
    if isinstance(item, dict):
        for k in ID_KEYS:
            if not is_empty(item.get(k)):
                return f"{k}:{_norm(item[k])}"
        if not is_empty(item.get("name")):
            return f"name:{_norm(item['name'])}"
    if isinstance(item, str):
        return "s:" + _norm(item)
    return "h:" + hashlib.sha1(json.dumps(item, sort_keys=True, default=str).encode()).hexdigest()


def merge_lists(old: list, new: list) -> list:
    out = list(old)
    index = {identity(i): n for n, i in enumerate(out)}
    for item in new:
        k = identity(item)
        if k in index:
            cur = out[index[k]]
            if isinstance(cur, dict) and isinstance(item, dict):
                out[index[k]] = merge_record(cur, item)
        else:
            index[k] = len(out)
            out.append(item)
    return out


def merge_record(old: dict, new: dict) -> dict:
    """Existing values win. New information is only added where something is missing."""
    out = dict(old)
    for k, v in new.items():
        if is_empty(v):
            continue
        cur = out.get(k)
        if is_empty(cur):
            out[k] = v
        elif isinstance(cur, list) and isinstance(v, list):
            out[k] = merge_lists(cur, v)
        elif isinstance(cur, dict) and isinstance(v, dict):
            out[k] = merge_record(cur, v)
    return out


LABEL_KEYS = ("name", "title", "component_id", "interface_id", "store_id", "flow_id", "integration_id",
              "control_id", "threat_id", "relationship_id", "convergence_id", "scenario", "target",
              "service", "path_or_interface", "id")


def label_of(item) -> str:
    if isinstance(item, dict):
        for k in LABEL_KEYS:
            if not is_empty(item.get(k)):
                return as_text(item[k])[:100]
    return as_text(item)[:100] or "item"


def iter_refs(data: dict, default_owner: str):
    """Yields (owner_label, reference) for every source reference inside an entity."""
    for key in ("source_references", "evidence_references"):
        for ref in data.get(key) or []:
            n = normalize_reference(ref)
            if n:
                yield default_owner, n
    for field, val in data.items():
        if field in ("source_references", "evidence_references", "extra", "diagrams"):
            continue
        if isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    for key in ("source_references", "evidence_references"):
                        for ref in item.get(key) or []:
                            n = normalize_reference(ref)
                            if n:
                                yield f"{field}: {label_of(item)}", n