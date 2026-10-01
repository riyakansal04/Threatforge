"""Reads uploaded files: detects the kind, masks secrets, parses JSON / Markdown / SARIF / Mermaid / manifests."""
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import Any

from app.mapper.fields import ALL_ALIASES
from app.mapper.util import as_text, snake, snake_keys

SECRET_PATTERNS = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S), "[REDACTED PRIVATE KEY]"),
    (re.compile(
        r"(?i)([\"']?(?:password|passwd|pwd|secret|client_secret|api[_-]?key|access[_-]?key|"
        r"private[_-]?key|auth[_-]?token|token)[\"']?\s*[:=]\s*)([\"']?)([^\"'\s,}\]]{4,})(\2)"),
     r"\1\2[REDACTED]\4"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED]"),
    (re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-]{20,}"), "Bearer [REDACTED]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"), "[REDACTED]"),
    (re.compile(r"\bsk-[A-Za-z0-9]{20,}\b"), "[REDACTED]"),
]

HEX64 = re.compile(r"^[a-fA-F0-9]{64}$")
SUM_LINE = re.compile(r"^([a-fA-F0-9]{64})\s+\*?(.+)$")
FENCE = re.compile(r"```mermaid\s*\n(.*?)```", re.S)
HEADING = re.compile(r"^#{1,6}\s+(.*?)\s*#*$")
BULLET = re.compile(r"^([-*+]|\d+[.)])\s+(.*)$")
KV = re.compile(r"^(?:[-*+]\s+)?\*{0,2}([A-Za-z][A-Za-z0-9 /&_-]{1,40}?)\*{0,2}:\*{0,2}\s+(.+)$")


@dataclass
class Upload:
    filename: str
    kind: str  # json | markdown | mermaid | sarif | manifest | other | unsupported
    size_bytes: int
    sha256: str
    text: str
    redacted: bool
    tree: Any = None
    diagrams: list = field(default_factory=list)
    note: str = ""


def redact(text: str):
    out = text
    for pattern, repl in SECRET_PATTERNS:
        out = pattern.sub(repl, out)
    return out, out != text


def clean_filename(name: str) -> str:
    return PurePosixPath((name or "file").replace("\\", "/")).name or "file"


def make_diagram(title: str, source: str, origin: str) -> dict:
    return {"diagram_id": hashlib.sha1(source.strip().encode()).hexdigest()[:12],
            "title": title, "source": source.strip(), "origin": origin}


def markdown_diagrams(text: str, origin: str) -> list:
    out = []
    for n, m in enumerate(FENCE.finditer(text), 1):
        before = text[: m.start()].splitlines()
        title = next((HEADING.match(l.strip()).group(1) for l in reversed(before) if HEADING.match(l.strip())),
                     f"Diagram {n}")
        out.append(make_diagram(title, m.group(1), origin))
    return out


def markdown_tree(text: str) -> dict:
    """Turns headings into keys and their bullets / table rows / paragraphs into values."""
    tree: dict = {}
    key = None
    buf: list = []
    in_fence = False

    def add(k, v):
        if v in ("", [], None):
            return
        cur = tree.get(k)
        if cur is None:
            tree[k] = v
        elif isinstance(cur, list) and isinstance(v, list):
            cur.extend(v)

    def flush():
        if key is None:
            return
        items, para, header = [], [], None
        for s in buf:
            if s.startswith("|"):
                cells = [c.strip() for c in s.strip("|").split("|")]
                if all(re.match(r"^:?-{2,}:?$", c) for c in cells if c):
                    continue
                if header is None:
                    header = [snake(c) for c in cells]
                elif len(cells) == len(header):
                    items.append({h: c for h, c in zip(header, cells) if c})
                continue
            b = BULLET.match(s)
            if b:
                items.append(b.group(2).strip())
            else:
                para.append(s)
        add(key, items if items else " ".join(para))

    for raw in text.splitlines():
        s = raw.strip()
        if s.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or not s:
            continue
        h = HEADING.match(s)
        if h:
            flush()
            key = snake(re.sub(r"^\d+(\.\d+)*[.)]?\s*", "", h.group(1)))
            buf = []
            continue
        kv = KV.match(s)
        if kv:
            add(snake(kv.group(1)), kv.group(2).strip())
        buf.append(s)
    flush()
    return tree


def manifest_entries_from_tree(node, out: dict, hint=None):
    if isinstance(node, dict):
        name = next((node[k] for k in ("path", "file", "filename", "name", "artifact") if isinstance(node.get(k), str)), None)
        digest = next((v for v in node.values() if isinstance(v, str) and HEX64.match(v)), None)
        if digest and (name or hint):
            out[clean_filename(name or hint)] = digest.lower()
        for k, v in node.items():
            if isinstance(v, str) and HEX64.match(v) and not name and not digest_key(k):
                out[clean_filename(k)] = v.lower()
            elif isinstance(v, (dict, list)):
                manifest_entries_from_tree(v, out, hint=k)
    elif isinstance(node, list):
        for i in node:
            manifest_entries_from_tree(i, out, hint)


def digest_key(k) -> bool:
    return str(k).lower() in {"sha256", "sha_256", "hash", "digest", "checksum", "manifest_sha256"}


def manifest_entries(u: "Upload") -> dict:
    out: dict = {}
    if u.tree is not None:
        manifest_entries_from_tree(u.tree, out)
    else:
        for line in u.text.splitlines():
            m = SUM_LINE.match(line.strip())
            if m:
                out[clean_filename(m.group(2))] = m.group(1).lower()
    return out


def _looks_like_sarif(parsed, ext) -> bool:
    if not isinstance(parsed, dict) or not isinstance(parsed.get("runs"), list):
        return False
    return ext == ".sarif" or "sarif" in str(parsed.get("$schema", "")).lower() or parsed.get("version") == "2.1.0"


def _has_entity_fields(tree) -> bool:
    def walk(n, depth=0):
        if depth > 5:
            return False
        if isinstance(n, dict):
            return any(k in ALL_ALIASES or walk(v, depth + 1) for k, v in n.items())
        if isinstance(n, list):
            return any(walk(i, depth + 1) for i in n[:50])
        return False
    return walk(tree)


def read_upload(filename: str, data: bytes) -> Upload:
    filename = clean_filename(filename)
    sha = hashlib.sha256(data).hexdigest()
    text, redacted = redact(data.decode("utf-8-sig", errors="replace"))
    ext = PurePosixPath(filename).suffix.lower()
    base = dict(filename=filename, size_bytes=len(data), sha256=sha, text=text, redacted=redacted)

    if ext in (".mmd", ".mermaid"):
        stem = PurePosixPath(filename).stem
        return Upload(kind="mermaid", diagrams=[make_diagram(stem, text, filename)], **base)

    if ext in (".md", ".markdown"):
        return Upload(kind="markdown", tree=markdown_tree(text), diagrams=markdown_diagrams(text, filename), **base)

    if ext in (".json", ".sarif"):
        try:
            parsed = json.loads(text)
        except ValueError:
            return Upload(kind="other", note="not valid JSON, stored as evidence only", **base)
        if _looks_like_sarif(parsed, ext):
            return Upload(kind="sarif", tree=parsed, **base)
        tree = snake_keys(parsed)
        u = Upload(kind="json", tree=tree, **base)
        if "manifest" in filename.lower() or (not _has_entity_fields(tree) and manifest_entries(u)):
            u.kind = "manifest"
        return u

    if ext in (".sha256", ".sha", ".txt"):
        u = Upload(kind="manifest", **base)
        if manifest_entries(u):
            return u
        return Upload(kind="other", note="text file with no recognised content, stored as evidence only", **base)

    return Upload(kind="unsupported", note="unsupported file type", **base)


def sarif_references(tree: dict) -> list:
    refs = []
    for run in tree.get("runs") or []:
        for res in (run.get("results") or []) if isinstance(run, dict) else []:
            if not isinstance(res, dict):
                continue
            message = as_text((res.get("message") or {}).get("text") if isinstance(res.get("message"), dict) else "")
            for loc in (res.get("locations") or [])[:3]:
                phys = loc.get("physicalLocation") or {} if isinstance(loc, dict) else {}
                uri = (phys.get("artifactLocation") or {}).get("uri")
                line = (phys.get("region") or {}).get("startLine")
                if uri:
                    ref = {"file_or_location": str(uri), "evidence_type": "sarif"}
                    if line:
                        ref["line_or_range_if_available"] = str(line)
                    if message:
                        ref["description"] = message[:300]
                    refs.append(ref)
    return refs