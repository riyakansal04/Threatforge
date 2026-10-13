"""Format-agnostic adapter: turns the files of one scan report package into a Scan bundle.
JSON / SARIF / Markdown are parsed into generic structures, findings are discovered by content,
fields are recognised by meaning (concepts.py), unrecognised fields are kept as attributes."""
import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Optional

from app.mapper.readers import BULLET, HEADING, KV, manifest_entries
from app.mapper.util import as_text, is_empty, merge_record, normalize_reference, normalize_refs, snake
from app.scanning import concepts as C

KEY_ONLY = re.compile(r"^(?:[-*+]\s+)?\*{0,2}([A-Za-z][A-Za-z0-9 /&_-]{1,40}?)\*{0,2}:\*{0,2}\s*$")
PATHLIKE = re.compile(r"^[\w@./\\\-]+\.[A-Za-z0-9]{1,8}(?::\d+(?:-\d+)?)?$")
SEV_WORDS = {"critical", "high", "medium", "low", "info", "informational"}
CLASS_WORDS = ("confirm", "candidate", "validat", "reproduc", "investigat", "establish", "suspect", "unconfirm")
TEXT_FIELDS = {
    "severity", "confidence", "cwe", "category", "classification", "confirmation_reason", "title",
    "finding_id", "rule_id", "runtime_target",
}
SCAN_FROM_MANIFEST = {"tool": "tool", "capabilities": "capabilities", "target": "target",
                      "repository_reference": "repository_reference", "start_time": "started_at",
                      "end_time": "completed_at", "status": "status", "configuration": "configuration_reference"}
MD_SECTION = re.compile(r"^(#{1,6})\s+(.*?)\s*#*$")
MD_FINDING_ID = re.compile(r"\b([A-Za-z][A-Za-z0-9_-]*-\d{2,}[A-Za-z0-9_-]*)\b")


@dataclass
class Bundle:
    scan: dict = field(default_factory=dict)
    findings: list = field(default_factory=list)    # (item_key, data)
    evidence: list = field(default_factory=list)    # (item_key, [rows])
    coverage: Optional[dict] = None
    manifest: Optional[dict] = None
    types: dict = field(default_factory=dict)       # sha256 -> artifact type
    warnings: list = field(default_factory=list)


def _norm(v):
    return " ".join(as_text(v).lower().split())


def _coerce(canon, v):
    if canon in TEXT_FIELDS:
        return as_text(v)
    if canon == "source_references":
        return normalize_refs(v)
    return v


# ---------------- finding discovery ----------------
def find_records(node, path=(), out=None, depth=0):
    out = [] if out is None else out
    if depth > 8:
        return out
    if isinstance(node, dict):
        if C.is_finding(node):
            out.append((path, node, "single"))
            return out
        vals = list(node.values())
        if vals and all(isinstance(v, dict) for v in vals) and sum(C.is_finding(v) for v in vals) >= max(1, len(vals) // 2):
            out.append((path, node, "keyed"))
            return out
        for k, v in node.items():
            find_records(v, path + (str(k),), out, depth + 1)
    elif isinstance(node, list):
        recs = [x for x in node if isinstance(x, dict)]
        if recs and sum(C.is_finding(r) for r in recs) >= max(1, len(recs) // 2):
            out.append((path, node, "list"))
            return out
        for x in node:
            find_records(x, path, out, depth + 1)
    return out


def iter_records(found):
    for path, cont, kind in found:
        if kind == "single":
            yield path, cont
        elif kind == "keyed":
            for k, v in cont.items():
                if isinstance(v, dict) and C.is_finding(v):
                    r = dict(v)
                    if not any(snake(kk) in ("id", "finding_id") for kk in v):
                        r["finding_id"] = k
                    yield path, r
        else:
            for v in cont:
                if isinstance(v, dict) and C.is_finding(v):
                    yield path, v


def md_findings(text):
    """Per-finding Markdown sections: a heading followed by 'Key: value' lines / bullet lists."""
    recs, cur, list_key, in_fence = [], None, None, False

    def close():
        nonlocal cur
        if cur and C.is_finding(cur["rec"]):
            cur["rec"].setdefault("title", cur["heading"])
            recs.append(((), cur["rec"]))
        cur = None

    for raw in text.splitlines():
        s = raw.strip()
        if s.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        h = HEADING.match(s)
        if h:
            close()
            cur, list_key = {"heading": h.group(1).strip(), "rec": {}}, None
            continue
        if cur is None or not s:
            continue
        m = KV.match(s)
        if m:
            cur["rec"][snake(m.group(1))], list_key = m.group(2).strip(), None
            continue
        m = KEY_ONLY.match(s)
        if m:
            list_key = snake(m.group(1))
            cur["rec"][list_key] = []
            continue
        b = BULLET.match(s)
        if b and list_key:
            cur["rec"][list_key].append(b.group(2).strip())
    close()
    return recs


def md_finding_narratives(text, filename):
    """Free-form assessment sections keyed by finding id, used as supplemental finding context."""
    sections, cur = [], None

    def close():
        nonlocal cur
        if cur:
            sections.append(cur)
        cur = None

    for raw in text.splitlines():
        s = raw.strip()
        h = MD_SECTION.match(s)
        if h:
            close()
            title = h.group(2).strip()
            m = MD_FINDING_ID.search(title)
            if m:
                cur = {"finding_id": m.group(1), "heading": title, "lines": []}
            else:
                cur = None
            continue
        if cur is not None:
            cur["lines"].append(raw.rstrip())
    close()

    out = []
    for section in sections:
        paragraphs, buf = [], []
        for raw in section["lines"]:
            s = raw.strip()
            if not s or s.startswith("|") or re.match(r"^[-|: ]+$", s):
                if buf:
                    paragraphs.append(" ".join(buf))
                    buf = []
                continue
            if s.startswith(("-", "*", "+")):
                continue
            buf.append(s)
        if buf:
            paragraphs.append(" ".join(buf))

        confirmation = next(
            (p for p in paragraphs if re.search(r"\bconfirmed\b|\bvalidation\b", p, re.I)),
            "",
        )
        impact = next((re.sub(r"^impact:\s*", "", p, flags=re.I) for p in paragraphs if re.match(r"impact:\s*", p, re.I)), "")
        description = next((p for p in paragraphs if p != confirmation and not re.match(r"impact:\s*", p, re.I)), "")
        title = section["heading"].split(":", 1)[1].strip() if ":" in section["heading"] else section["heading"]
        rec = {
            "finding_id": section["finding_id"],
            "title": title,
            "confirmation_reason": confirmation,
            "description": description,
            "impact": impact,
            "source_references": [{"file_or_location": filename, "evidence_type": "assessment_report"}],
        }
        out.append({k: v for k, v in rec.items() if not is_empty(v)})
    return out


def sarif_findings(tree, filename):
    out = []
    for run in tree.get("runs") or []:
        if not isinstance(run, dict):
            continue
        driver = (run.get("tool") or {}).get("driver") or {}
        rules = {r.get("id"): r for r in driver.get("rules") or [] if isinstance(r, dict)}
        for res in run.get("results") or []:
            if not isinstance(res, dict):
                continue
            rid = res.get("ruleId")
            rule = rules.get(rid) or {}
            props = {**(rule.get("properties") or {}), **(res.get("properties") or {})}
            tags = [t for t in (props.get("tags") or []) if isinstance(t, str)]
            cwe = next((m.group(0).upper() for t in tags for m in [re.search(r"cwe-\d+", t, re.I)] if m), None)
            msg = res.get("message")
            msg = msg.get("text") if isinstance(msg, dict) else msg
            refs, first = [], None
            for loc in (res.get("locations") or [])[:5]:
                phys = (loc or {}).get("physicalLocation") or {}
                uri = (phys.get("artifactLocation") or {}).get("uri")
                line = (phys.get("region") or {}).get("startLine")
                if uri:
                    s = f"{uri}:{line}" if line else str(uri)
                    first = first or s
                    refs.append({"file_or_location": s, "evidence_type": "sarif"})
            attrs = {"rule_id": rid, "sarif_level": res.get("level") or (rule.get("defaultConfiguration") or {}).get("level")}
            rec = {
                "title": rule.get("name") or (rule.get("shortDescription") or {}).get("text") or rid,
                "description": msg,
                "severity": as_text(props.get("severity") or props.get("security-severity")),
                "confidence": as_text(props.get("confidence") or props.get("precision")),
                "cwe": cwe,
                "category": next((t for t in tags if not t.lower().startswith("external/")), None),
                "code_location": first,
                "source_references": refs,
                "attributes": {k: v for k, v in attrs.items() if v},
                "source_file": filename,
                "source_format": "sarif",
            }
            out.append({k: v for k, v in rec.items() if not is_empty(v)})
    return out


# ---------------- record mapping ----------------
def map_object(d, rules):
    out, extra = {}, {}
    for k, v in d.items():
        if is_empty(v):
            continue
        _, names = C.match(rules, str(k))
        if names:
            for n in names:
                out.setdefault(n, v)
        else:
            extra[str(k)] = v
    if extra:
        out["extra"] = extra
    return out


def _take(attrs, *keys):
    for key in keys:
        if key in attrs and not is_empty(attrs[key]):
            return attrs.pop(key)
    return None


def _line_range(item):
    if not isinstance(item, dict):
        return ""
    start = item.get("startLine") or item.get("start_line") or item.get("line")
    end = item.get("endLine") or item.get("end_line")
    if start and end and str(start) != str(end):
        return f"{start}-{end}"
    return as_text(start)


def _location_of(item):
    if not isinstance(item, dict):
        return as_text(item)
    path = item.get("path") or item.get("file") or item.get("file_path") or item.get("location")
    line = _line_range(item)
    if path and line:
        return f"{as_text(path)}:{line}"
    return as_text(path or item.get("location"))


def _normalize_code_evidence(value):
    items = value if isinstance(value, list) else [value]
    out = []
    for item in items:
        if is_empty(item):
            continue
        if not isinstance(item, dict):
            out.append({"description": as_text(item)})
            continue
        ev = {}
        for src, dst in (
            ("id", "id"), ("label", "label"), ("language", "language"), ("code", "code"),
            ("explanation", "explanation"), ("description", "description"), ("path", "path"),
        ):
            if not is_empty(item.get(src)):
                ev[dst] = item[src]
        if not is_empty(item.get("startLine") or item.get("start_line")):
            ev["start_line"] = item.get("startLine") or item.get("start_line")
        if not is_empty(item.get("endLine") or item.get("end_line")):
            ev["end_line"] = item.get("endLine") or item.get("end_line")
        loc = _location_of(item)
        if loc:
            ev["location"] = loc
        out.append(ev or item)
    return out


def _promote_nested_finding_fields(out, attrs):
    taxonomy = _take(attrs, "taxonomy")
    if isinstance(taxonomy, dict):
        if is_empty(out.get("category")) and not is_empty(taxonomy.get("category")):
            out["category"] = as_text(taxonomy.get("category"))
        if is_empty(out.get("cwe")) and not is_empty(taxonomy.get("cwe")):
            out["cwe"] = as_text(taxonomy.get("cwe"))
        remaining = {k: v for k, v in taxonomy.items() if k not in ("category", "cwe") and not is_empty(v)}
        if remaining:
            attrs["taxonomy"] = remaining
    elif not is_empty(taxonomy):
        attrs["taxonomy"] = taxonomy

    code_evidence = out.get("evidence_items")
    if is_empty(code_evidence):
        code_evidence = _take(attrs, "codeEvidence", "code_evidence", "evidenceItems", "evidence_items")
    if not is_empty(code_evidence):
        out["evidence_items"] = _normalize_code_evidence(code_evidence)

    locations = _take(attrs, "locations")
    if is_empty(out.get("code_location")) and not is_empty(locations):
        locs = locations if isinstance(locations, list) else [locations]
        out["code_location"] = [_location_of(item) for item in locs if _location_of(item)]
    elif not is_empty(locations):
        attrs["locations"] = locations

    for canon, keys in {
        "rule_id": ("ruleId", "rule_id"),
        "entry_points": ("entryPoints", "entry_points"),
        "related_threats": ("relatedThreats", "related_threats"),
        "related_scan_focus": ("relatedScanFocus", "related_scan_focus"),
        "validation": ("validation",),
    }.items():
        if is_empty(out.get(canon)):
            value = _take(attrs, *keys)
            if not is_empty(value):
                out[canon] = value
        else:
            for key in keys:
                attrs.pop(key, None)


def map_record(rec, scan_type, path, filename, fmt):
    out, attrs, obj = {}, {}, {}
    obj_name, obj_rules = C.OBJECTS.get(scan_type, (None, None))
    for k, v in rec.items():
        if is_empty(v):
            continue
        if snake(k) in ("id", "uid", "uuid") and "finding_id" not in out:
            out["finding_id"] = as_text(v)
            continue
        csc, cn = C.match(C.FINDING, str(k))
        osc, on = C.match(obj_rules, str(k)) if obj_rules else (None, [])
        placed = False
        if on and (not csc or osc >= csc):
            for n in on:
                obj.setdefault(n, v)
            placed = True
        if cn and (not osc or csc >= osc):
            for n in cn:
                if n in out:
                    attrs.setdefault(str(k), v)
                else:
                    out[n] = _coerce(n, v)
            placed = True
        if not placed:
            attrs[str(k)] = v
    if isinstance(out.get("attack_path"), dict) and obj_name == "attack_path_trace":
        obj = {**map_object(out.pop("attack_path"), obj_rules), **obj}
    _promote_nested_finding_fields(out, attrs)
    if "severity" not in out:
        for p in reversed(path):
            if snake(p) in SEV_WORDS:
                out["severity"] = str(p)
                break
    if "classification" not in out:
        for p in reversed(path):
            if any(w in snake(p) for w in CLASS_WORDS):
                out["classification"] = str(p).replace("_", " ").strip()
                break
    out = {k: v for k, v in out.items() if not is_empty(v)}
    if obj:
        out[obj_name] = obj
    if attrs:
        out["attributes"] = attrs
    out["source_file"], out["source_format"] = filename, fmt
    return out


def item_key(f):
    if f.get("finding_id"):
        return "id:" + _norm(f["finding_id"])
    basis = "|".join(_norm(f.get(k)) for k in ("title", "category", "code_location", "affected_area", "affected_dependency"))
    if basis.strip("|"):
        return "k:" + hashlib.sha1(basis.encode()).hexdigest()
    return "h:" + hashlib.sha1(json.dumps(f, sort_keys=True, default=str).encode()).hexdigest()


def evidence_rows(f):
    rows = []

    def add(loc, desc, origin, ref=None):
        if loc or desc:
            rows.append({"origin": origin, "location": loc, "description": str(desc)[:1500] if desc else None,
                         "reference": ref})

    def add_ref(ref, origin, text_as_description=False):
        if isinstance(ref, dict):
            n = normalize_reference(ref)
            if n:
                add(n.get("file_or_location"), n.get("description"), origin, n)
            else:
                add(None, as_text(ref), origin)
        else:
            s = as_text(ref)
            if text_as_description and not PATHLIKE.match(s):
                add(None, s, origin)
            else:
                add(s, None, origin)

    for ref in f.get("source_references") or []:
        add_ref(ref, "source_references")
    for item in f.get("evidence_items") or []:
        if isinstance(item, dict):
            loc = item.get("location") or _location_of(item)
            desc = item.get("explanation") or item.get("description") or item.get("label") or item.get("code")
            add(loc, desc, "evidence_items", item)
        elif not is_empty(item):
            add(None, as_text(item), "evidence_items")
    origins = ("evidence",) if f.get("evidence_items") else ("code_location", "evidence")
    for origin in origins:
        v = f.get(origin)
        for item in (v if isinstance(v, list) else [v]):
            if is_empty(item):
                continue
            if isinstance(item, dict):
                r = normalize_reference(item)
                if r:
                    add(r.get("file_or_location"), r.get("description"), origin, r)
                else:
                    add(None, as_text(item), origin)
            else:
                s = as_text(item)
                if PATHLIKE.match(s) or origin == "code_location":
                    add(s, None, origin)
                else:
                    add(None, s, origin)
    for obj_name in ("attack_path_trace", "dependency", "runtime_validation"):
        obj = f.get(obj_name)
        if not isinstance(obj, dict):
            continue
        for key in ("source_references", "evidence_references"):
            for ref in obj.get(key) or []:
                add_ref(ref, f"{obj_name}.{key}")
        for key in ("runtime_evidence",):
            v = obj.get(key)
            for item in (v if isinstance(v, list) else [v]):
                if not is_empty(item):
                    add_ref(item, f"{obj_name}.{key}", text_as_description=True)
    return rows


# ---------------- scan / coverage / manifest ----------------
def _contains(v, chosen, depth=0):
    if id(v) in chosen:
        return True
    if depth > 6:
        return False
    if isinstance(v, dict):
        return any(_contains(x, chosen, depth + 1) for x in v.values())
    if isinstance(v, list):
        return any(_contains(x, chosen, depth + 1) for x in v[:200])
    return False


def collect_meta(node, chosen, fields, attrs, cov, depth=0):
    """Scan-level information: everything outside the finding lists. Unknown keys become attributes."""
    if not isinstance(node, dict) or depth > 3:
        return
    for k, v in node.items():
        if is_empty(v) or id(v) in chosen:
            continue
        _, names = C.match(C.SCAN, str(k))
        if names:
            fields.setdefault(names[0], v)
            continue
        if C.match(C.COVKEY, str(k))[1]:
            cov.append(v)
            continue
        if isinstance(v, dict) and (_contains(v, chosen) or any(C.match(C.SCAN, str(kk))[1] for kk in v)):
            collect_meta(v, chosen, fields, attrs, cov, depth + 1)
            continue
        if _contains(v, chosen):
            continue
        attrs.setdefault(str(k), v)


def map_coverage(v):
    if isinstance(v, str):
        return {"summary": v}
    if isinstance(v, list):
        return {"attributes": {"items": v}}
    if not isinstance(v, dict):
        return {"attributes": {"value": v}}
    out, attrs = {}, {}
    for k, x in v.items():
        if is_empty(x):
            continue
        _, names = C.match(C.COVERAGE, str(k))
        if names:
            out.setdefault(names[0], x)
        else:
            attrs[str(k)] = x
    if attrs:
        out["attributes"] = attrs
    return out


def map_manifest(u):
    if not isinstance(u.tree, (dict, list)):
        ents = manifest_entries(u)
        out = {"artifacts": [{"file_name": n, "sha256": h} for n, h in ents.items()]} if ents else {}
    else:
        tree = u.tree if isinstance(u.tree, dict) else {"items": u.tree}
        while len(tree) == 1 and isinstance(next(iter(tree.values())), dict):
            tree = next(iter(tree.values()))
        out, attrs = {}, {}
        for k, x in tree.items():
            if is_empty(x):
                continue
            _, names = C.match(C.MANIFEST, str(k))
            if names:
                out.setdefault(names[0], x)
            else:
                attrs[str(k)] = x
        if attrs:
            out["attributes"] = attrs
    if out:
        out["artifact_reference"] = u.filename
    return out


def classify_json(tree, recs):
    if recs:
        return "json_report"
    keys = []

    def walk(n, d=0):
        if isinstance(n, dict) and d < 2:
            for k, v in n.items():
                keys.append(str(k))
                walk(v, d + 1)

    walk(tree)
    cov = sum(1 for k in keys if C.match(C.COVERAGE_HINT, k)[1])
    man = sum(1 for k in keys if C.match(C.MANIFEST, k)[1])
    scn = sum(1 for k in keys if C.match(C.SCAN, k)[1])
    if cov and cov >= man:
        return "coverage"
    if man >= 3:
        return "manifest"
    if scn:
        return "json_report"
    return "supporting_artifact"


def detect_type(text):
    t = text.lower()
    for word, st in (("supply", "supply_chain"), ("dependency", "supply_chain"), ("runtime", "runtime"),
                     ("dynamic", "runtime"), ("exploit", "exploitable"), ("module", "module"),
                     ("deep", "deep"), ("standard", "standard")):
        if word in t:
            return st
    return None


# ---------------- the bundle ----------------
def build_bundle(scan_type, uploads) -> Bundle:
    b = Bundle()
    per = []
    for u in uploads:
        recs = []
        if u.kind in ("json", "manifest") and u.tree is not None:
            recs = find_records(u.tree)
            role = classify_json(u.tree, recs)
        elif u.kind == "manifest":
            role = "manifest"
        elif u.kind == "sarif":
            role = "sarif_report"
        elif u.kind == "markdown":
            coverage_hints = sum(1 for key in (u.tree or {}) if C.match(C.COVERAGE_HINT, key)[1])
            role = "coverage" if "coverage" in u.filename.lower() or coverage_hints >= 2 else "markdown_report"
        else:
            role = "supporting_artifact"
        b.types[u.sha256] = role
        per.append((u, role, recs))

    # ---- findings: JSON first, then Markdown, then SARIF ----
    chosen, jf = set(), []
    for u, role, recs in per:
        if role == "json_report":
            for path, cont, _ in recs:
                chosen.add(id(cont))
            jf += [(p, r, u.filename) for p, r in iter_records(recs)]
    mdf = []
    md_supplements = []
    for u, role, _ in per:
        if role == "markdown_report":
            sec = [(p, r, u.filename) for p, r in md_findings(u.text)]
            tab = [(p, r, u.filename) for p, r in iter_records(find_records(u.tree))]
            mdf += sec if len(sec) >= len(tab) else tab
            md_supplements += [((), r, u.filename) for r in md_finding_narratives(u.text, u.filename)]
    sf, sarif_count = [], 0
    for u, role, _ in per:
        if role == "sarif_report" and isinstance(u.tree, dict):
            found = sarif_findings(u.tree, u.filename)
            sarif_count += len(found)
            sf += found

    mapped = []
    if jf:
        mapped = [map_record(r, scan_type, p, fn, "json") for p, r, fn in jf]
    elif mdf:
        mapped = [map_record(r, scan_type, p, fn, "markdown") for p, r, fn in mdf]
    elif sf:
        mapped = sf

    by_key = {}
    for f in mapped:
        k = item_key(f)
        by_key[k] = merge_record(by_key[k], f) if k in by_key else f
    if by_key and md_supplements:
        for p, r, fn in md_supplements:
            f = map_record(r, scan_type, p, fn, "markdown")
            k = item_key(f)
            if k in by_key:
                by_key[k] = merge_record(by_key[k], f)
    for k, f in by_key.items():
        b.findings.append((k, f))
        b.evidence.append((k, evidence_rows(f)))

    # ---- scan-level fields, coverage, manifest ----
    fields_, attrs, cov = {}, {}, []
    for u, role, _ in per:
        if role == "json_report" and isinstance(u.tree, dict) and id(u.tree) not in chosen:
            collect_meta(u.tree, chosen, fields_, attrs, cov)
    md_fields, md_cov = {}, []
    for u, role, _ in per:
        if role == "markdown_report":
            collect_meta(u.tree, set(), md_fields, {}, md_cov)
    for k, v in md_fields.items():
        fields_.setdefault(k, v)
    if not cov:
        cov = md_cov

    for u, role, _ in per:
        if role == "sarif_report" and isinstance(u.tree, dict):
            for run in (u.tree.get("runs") or [])[:1]:
                driver = (run.get("tool") or {}).get("driver") or {}
                if driver.get("name"):
                    fields_.setdefault("tool", " ".join(x for x in (driver.get("name"), driver.get("version")) if x))
                inv = (run.get("invocations") or [{}])[0] or {}
                if inv.get("startTimeUtc"):
                    fields_.setdefault("started_at", inv["startTimeUtc"])
                if inv.get("endTimeUtc"):
                    fields_.setdefault("completed_at", inv["endTimeUtc"])

    for u, role, _ in per:
        if role == "manifest":
            m = map_manifest(u)
            if m:
                b.manifest = merge_record(b.manifest or {}, m)
                for mk, sk in SCAN_FROM_MANIFEST.items():
                    if not is_empty(m.get(mk)):
                        fields_.setdefault(sk, m[mk])

    parts = [map_coverage(v) for v in cov if not is_empty(v)]
    for u, role, _ in per:
        if role == "coverage":
            c = map_coverage(u.tree if u.tree is not None else {"summary": u.text[:2000]})
            c["artifact_reference"] = u.filename
            parts.append(c)
    merged = {}
    for p in parts:
        merged = merge_record(merged, p)
    b.coverage = merged or None

    rep = fields_.pop("scan_type", None)
    if rep is not None:
        attrs["reported_scan_type"] = rep
        d = detect_type(as_text(rep))
        if d and d != scan_type:
            b.warnings.append(f"The report says it is a '{as_text(rep)}' scan but it was uploaded as {scan_type.replace('_', ' ')}.")
    if sarif_count:
        attrs["sarif_results"] = sarif_count
    b.scan = {"scan_type": scan_type, **{k: v for k, v in fields_.items() if not is_empty(v)}}
    if attrs:
        b.scan["attributes"] = attrs
    if not b.findings:
        b.warnings.append("No finding records were recognised in the uploaded files. The scan is stored with 0 findings "
                          "and every file is kept as a raw artifact.")
    return b
