"""One scanning-stage upload: read files, build the Scan bundle, persist scan / findings / evidence / artifacts."""
from app import store
from app.mapper.ingest import _check_manifest
from app.mapper.readers import read_upload
from app.scanning import SCAN_STAGES
from app.scanning import store as scan_store
from app.scanning.adapter import build_bundle


def ingest_scan(conn, stage_key: str, raw_files: list, replace: bool = False, codebase_id=None) -> dict:
    cfg = SCAN_STAGES[stage_key]
    warnings, skipped, uploads, seen = [], [], [], set()

    if replace:
        scan_store.clear_stage(conn, stage_key, codebase_id)

    for filename, data in raw_files:
        u = read_upload(filename, data)
        if u.kind == "unsupported":
            warnings.append(f"{u.filename}: unsupported file type, skipped")
            continue
        if u.sha256 in seen:
            skipped.append(u.filename)
            continue
        seen.add(u.sha256)
        if u.note:
            warnings.append(f"{u.filename}: {u.note}")
        uploads.append(u)

    result = {"stage": stage_key, "label": cfg["label"], "run_id": None, "files_received": len(raw_files),
              "files_stored": len(uploads), "skipped_duplicates": skipped, "warnings": warnings, "counts": {}}
    if not uploads:
        return result

    bundle = build_bundle(cfg["scan_type"], uploads)
    warnings.extend(bundle.warnings)
    check = _check_manifest(uploads, warnings)

    counts = {"scans": 1, "findings": len(bundle.findings),
              "evidence": sum(len(rows) for _, rows in bundle.evidence),
              "coverage": 1 if bundle.coverage else 0, "manifest": 1 if bundle.manifest else 0,
              "artifacts": len(uploads)}
    if check:
        counts["manifest_check"] = check

    run_id = store.create_run(conn, stage_key, len(uploads), counts, warnings, codebase_id)
    scan_id = scan_store.create_scan(conn, run_id, stage_key, cfg["scan_type"], bundle.scan,
                                     bundle.coverage, bundle.manifest)

    artifact_ids = {}
    for u in uploads:
        artifact_ids[u.filename] = scan_store.save_artifact(
            conn, run_id, scan_id, stage_key, u, bundle.types.get(u.sha256, "supporting_artifact"), codebase_id)

    rows_by_key = dict(bundle.evidence)
    for key, data in bundle.findings:
        data["source_artifact_id"] = artifact_ids.get(data.get("source_file"))
        fid = scan_store.add_finding(conn, scan_id, key, data)
        for row in rows_by_key.get(key, []):
            scan_store.add_evidence(conn, scan_id, fid, data["source_artifact_id"], row)

    result.update(run_id=run_id, counts=counts)
    return result
