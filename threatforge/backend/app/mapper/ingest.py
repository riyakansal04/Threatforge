"""One stage upload: read files, map them to entities, merge into PostgreSQL, keep the raw files as evidence."""
from app import store
from app.mapper.extract import extract, score_all, unmatched_keys
from app.mapper.fields import STAGES
from app.mapper.readers import manifest_entries, read_upload
from app.mapper.util import is_empty, merge_record


def _check_manifest(uploads: list, warnings: list):
    listed: dict = {}
    for u in uploads:
        if u.kind == "manifest":
            listed.update(manifest_entries(u))
    if not listed:
        return None
    actual = {u.filename: u.sha256 for u in uploads if u.kind != "manifest"}
    verified = [n for n, h in listed.items() if actual.get(n) == h]
    mismatched = [n for n, h in listed.items() if n in actual and actual[n] != h]
    for n in mismatched:
        warnings.append(f"{n}: content does not match the hash in the manifest")
    return {"listed": len(listed), "verified": len(verified), "mismatched": mismatched}


def ingest(conn, stage_key: str, raw_files: list, replace: bool = False, codebase_id=None) -> dict:
    cfg = STAGES[stage_key]
    warnings, skipped, uploads, seen = [], [], [], set()

    if replace:
        store.clear_stage(conn, stage_key, codebase_id)

    for filename, data in raw_files:
        u = read_upload(filename, data)
        if u.kind == "unsupported":
            warnings.append(f"{u.filename}: unsupported file type, skipped")
            continue
        if u.sha256 in seen or store.artifact_exists(conn, stage_key, u.sha256, codebase_id):
            skipped.append(u.filename)
            continue
        seen.add(u.sha256)
        if u.note:
            warnings.append(f"{u.filename}: {u.note}")
        if u.kind in ("json", "markdown"):
            scores = score_all(u.tree)
            mine = scores[stage_key]
            best_key = max(scores, key=scores.get)
            if mine == 0:
                warnings.append(f"{u.filename}: no {cfg['label']} fields recognised, stored as evidence only")
            elif best_key != stage_key and scores[best_key] > mine:
                warnings.append(f"{u.filename}: looks more like {STAGES[best_key]['label']} output "
                                f"({scores[best_key]} fields matched there, {mine} here)")
            if u.kind == "json":
                miss = unmatched_keys(u.tree, stage_key)
                if miss:
                    more = f" (+{len(miss) - 10} more)" if len(miss) > 10 else ""
                    warnings.append(f"{u.filename}: fields not mapped, kept as evidence only: "
                                    + ", ".join(miss[:10]) + more)
        uploads.append(u)

    result = {"stage": stage_key, "label": cfg["label"], "run_id": None, "files_received": len(raw_files),
              "files_stored": len(uploads), "skipped_duplicates": skipped, "warnings": warnings, "counts": {}}
    if not uploads:
        return result

    counts = {}
    manifest = _check_manifest(uploads, warnings)
    if manifest:
        counts["manifest"] = manifest

    ext = extract(stage_key, uploads)
    existing = store.load_singleton(conn, cfg["table"], codebase_id)
    merged = merge_record(existing["data"] if existing else {}, ext.singleton)
    if not is_empty(merged):
        store.save_singleton(conn, cfg["table"], merged, codebase_id)
    counts["fields_filled"] = len(ext.singleton)
    counts["diagrams"] = len(ext.singleton.get("diagrams", []))
    for table, items in ext.records.items():
        counts[table] = store.upsert_items(conn, table, items, codebase_id)

    run_id = store.create_run(conn, stage_key, len(uploads), counts, warnings, codebase_id)
    for u in uploads:
        store.save_artifact(conn, run_id, stage_key, u, codebase_id)
    store.rebuild_evidence(conn, stage_key, codebase_id)

    result.update(run_id=run_id, counts=counts)
    return result
