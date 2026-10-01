"""Turns uploaded files into canonical entities. Matching is by field meaning, not by file name."""
from dataclasses import dataclass, field

from app.mapper.fields import IGNORED_KEYS, STAGES, dynamic_field_name, is_known_field_name, is_record_key
from app.mapper.readers import Upload, sarif_references
from app.mapper.util import (as_list, as_text, is_empty, merge_lists, normalize_refs)


def collect(node, match, out: dict, depth: int = 0, unmatched=None, path: str = ""):
    """Finds known fields anywhere in the content. A matched value is not searched any deeper.
    If `unmatched` is a list, it receives the paths of keys that carry content but matched nothing."""
    if depth > 6:
        return
    if isinstance(node, dict):
        for k, v in node.items():
            canons = match(k)
            if canons:
                for c in canons:
                    out.setdefault(c, []).append(v)
            elif not is_record_key(k):
                if (unmatched is not None and not isinstance(v, (dict, bool))
                        and not is_empty(v) and k not in IGNORED_KEYS):
                    unmatched.append(f"{path}{k}")
                collect(v, match, out, depth + 1, unmatched if isinstance(v, dict) else None, f"{path}{k}/")
    elif isinstance(node, list):
        for i in node:
            collect(i, match, out, depth + 1, None, path)


def collect_dynamic(node, out: dict, depth: int = 0):
    """Collect any meaningful keys that were not matched to the known stage schema."""
    if depth > 6:
        return
    if isinstance(node, dict):
        for k, v in node.items():
            if is_known_field_name(k):
                continue
            name = dynamic_field_name(k)
            if name and not is_empty(v):
                out.setdefault(name, []).append(v)
            if not is_record_key(k) and k not in IGNORED_KEYS:
                collect_dynamic(v, out, depth + 1)
    elif isinstance(node, list):
        for item in node:
            collect_dynamic(item, out, depth + 1)


def _has_content(values) -> bool:
    return bool(values) and any(not is_empty(v) for v in values)


def score(tree, stage_key: str) -> int:
    out: dict = {}
    collect(tree, STAGES[stage_key]["matcher"], out)
    return sum(1 for v in out.values() if _has_content(v))


def score_all(tree) -> dict:
    return {k: score(tree, k) for k in STAGES}


def unmatched_keys(tree, stage_key: str) -> list:
    miss: list = []
    collect(tree, STAGES[stage_key]["matcher"], {}, unmatched=miss)
    seen: list = []
    for m in miss:
        if m not in seen:
            seen.append(m)
    return seen


def _coerce(kind: str, v):
    return as_text(v) if kind == "text" else normalize_refs(v) if kind == "refs" else as_list(v)


def normalize_record(raw, rs: dict):
    if isinstance(raw, str):
        raw = {rs["primary"]: raw}
    if not isinstance(raw, dict):
        return None
    out, used = {}, set()
    # 1. exact names and aliases
    for canon, (kind, aliases) in rs["spec"].items():
        for a in (canon,) + tuple(aliases):
            if a in raw and not is_empty(raw[a]):
                val = _coerce(kind, raw[a])
                if not is_empty(val):
                    used.add(a)
                    out[canon] = val
                    break
    # 2. names we have not seen before, matched by meaning
    for k, v in raw.items():
        if k in used or is_empty(v):
            continue
        for canon in rs["matcher"](k):
            if canon in out:
                break
            val = _coerce(rs["spec"][canon][0], v)
            if not is_empty(val):
                out[canon] = val
                used.add(k)
            break
    if not out:
        return None
    st = out.get("scan_type")
    if isinstance(st, str) and "_" in st and " " not in st:
        out["scan_type"] = st.replace("_", " ").capitalize()
    extra = {k: v for k, v in raw.items() if k not in used and not is_empty(v)}
    if extra:
        out["extra"] = extra
    return out


def tidy_items(items: list) -> list:
    """Makes source references inside list items use the standard reference shape."""
    out = []
    for it in items:
        if isinstance(it, dict):
            it = dict(it)
            if "source_refs" in it:
                refs = it.pop("source_refs")
                if not is_empty(refs):
                    it["source_references"] = merge_lists(normalize_refs(it.get("source_references")),
                                                          normalize_refs(refs))
            for key in ("source_references", "evidence_references"):
                if not is_empty(it.get(key)):
                    it[key] = normalize_refs(it[key])
        out.append(it)
    return out


def build_field(kind: str, values: list):
    if kind == "text":
        for v in values:
            t = as_text(v)
            if t:
                return t
        return ""
    out: list = []
    for v in values:
        out = merge_lists(out, normalize_refs(v) if kind == "refs" else tidy_items(as_list(v)))
    return out


@dataclass
class Extracted:
    singleton: dict = field(default_factory=dict)
    records: dict = field(default_factory=dict)  # table -> [(item_key, data)]


def extract(stage_key: str, uploads: list) -> Extracted:
    cfg = STAGES[stage_key]
    match = cfg["matcher"]
    from_json: dict = {}
    from_md: dict = {}
    dynamic: dict = {}
    sarif_refs, diagrams = [], []

    for u in uploads:
        if u.kind == "json":
            collect(u.tree, match, from_json)
            collect_dynamic(u.tree, dynamic)
        elif u.kind == "markdown":
            collect(u.tree, match, from_md)
            collect_dynamic(u.tree, dynamic)
        elif u.kind == "sarif":
            collect_dynamic(u.tree, dynamic)
            sarif_refs += sarif_references(u.tree)
        elif u.kind == "manifest":
            collect_dynamic(u.tree, dynamic)
        if u.diagrams:
            diagrams += u.diagrams

    res = Extracted()
    for canon, (kind, _) in cfg["fields"].items():
        # JSON is the primary source. Markdown only fills fields that JSON did not provide.
        values = from_json.get(canon) if _has_content(from_json.get(canon)) else from_md.get(canon)
        if not _has_content(values):
            continue
        if kind == "records":
            rs = cfg["records"][canon]
            items = []
            for v in values:
                for raw in as_list(v, rs["key_field"]):
                    rec = normalize_record(raw, rs)
                    if rec:
                        items.append((rs["key_fn"](rec), rec))
            if items:
                res.records[rs["table"]] = items
        else:
            val = build_field(kind, values)
            if not is_empty(val):
                res.singleton[canon] = val

    for canon, values in dynamic.items():
        if canon in cfg["fields"] or canon in cfg["records"]:
            continue
        val = build_field("list", values)
        if not is_empty(val):
            res.singleton[canon] = val

    if sarif_refs:
        res.singleton["source_references"] = merge_lists(res.singleton.get("source_references", []), sarif_refs)
    if diagrams:
        res.singleton["diagrams"] = merge_lists([], diagrams)
    return res