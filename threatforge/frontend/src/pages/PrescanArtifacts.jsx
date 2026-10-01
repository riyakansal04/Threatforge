import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { PageShell, Panel, Modal } from '../components/Blocks.jsx';
import { Mermaid } from '../components/Mermaid.jsx';
import { fmtBytes, fmtDate } from '../lib/format.js';
import { STAGE_LABELS } from '../lib/stages.js';
import { SCAN_LABELS } from '../lib/scanning.js';

const scanLabel = (scanType) => SCAN_LABELS[scanType] || scanType || 'Scan';
const stageLabel = (stageKey) => STAGE_LABELS[stageKey] || stageKey || 'Unknown stage';

export default function PrescanArtifacts() {
  const scanArtifactsApi = useCallback(() => api.scanArtifacts(''), []);
  const { data, loading, error, reload } = useApi(api.evidence);
  const scanRaw = useApi(scanArtifactsApi);
  const [viewing, setViewing] = useState(null);
  const [viewErr, setViewErr] = useState('');
  const [del, setDel] = useState(null);
  const [delErr, setDelErr] = useState('');
  const preScanArtifacts = data?.artifacts || [];
  const scanArtifacts = scanRaw.data?.artifacts || [];
  const artifacts = [
    ...preScanArtifacts.map((artifact) => ({
      ...artifact,
      origin: 'pre-scan',
      groupKey: `pre:${artifact.stage_key || 'unknown'}`,
      packageType: 'Pre-scan report',
      stageLabel: stageLabel(artifact.stage_key),
      owner: stageLabel(artifact.stage_key),
    })),
    ...scanArtifacts.map((artifact) => ({
      ...artifact,
      origin: 'scan',
      groupKey: `scan:${artifact.scan_db_id || artifact.scan_label || artifact.id}`,
      packageType: `${scanLabel(artifact.scan_type)} report`,
      stageLabel: `${scanLabel(artifact.scan_type)} scan`,
      owner: artifact.scan_label || `${scanLabel(artifact.scan_type)} report`,
      scanId: artifact.scan_db_id,
      stage_key: artifact.scan_type || 'scan-report',
    })),
  ];
  const loadingAll = loading || scanRaw.loading;
  const errorAll = error || scanRaw.error;
  const stageRows = [...artifacts.reduce((map, artifact) => {
    const key = artifact.groupKey;
    const row = map.get(key) || {
      key,
      stage_key: artifact.stage_key || 'unknown',
      origin: artifact.origin,
      label: artifact.stageLabel,
      owner: artifact.owner,
      packageType: artifact.packageType,
      scanId: artifact.scanId,
      count: 0,
      size: 0,
      latest: '',
      kinds: new Set(),
    };
    row.count += 1;
    row.size += artifact.size_bytes || 0;
    if (artifact.kind) row.kinds.add(artifact.kind);
    if (!row.latest || new Date(artifact.created_at || 0) > new Date(row.latest || 0)) row.latest = artifact.created_at;
    map.set(key, row);
    return map;
  }, new Map()).values()];

  const open = async (id) => {
    setViewErr('');
    try { setViewing(await api.artifact(id)); } catch (e) { setViewErr(e.message); }
  };

  const clear = async () => {
    if (!del?.stage_key && !del?.scanId) return;
    setDelErr('');
    try {
      if (del.origin === 'scan') await api.deleteScan(del.scanId);
      else await api.clearStage(del.stage_key);
      setDel(null);
      reload();
      scanRaw.reload();
    } catch (e) {
      setDelErr(e.message);
      setDel(null);
    }
  };

  const sections = [
    { id: 'stage-files', title: 'Raw files by stage', isVisible: () => stageRows.length > 0 },
    { id: 'artifacts', title: 'Individual files', isVisible: () => artifacts.length > 0 },
  ];

  return (
    <PageShell
      eyebrow="Traceability"
      title="Codebase raw artifacts"
      description="Original uploaded report files grouped by the stage or scan that produced them."
      state={{ loading: loadingAll, error: errorAll, hasData: artifacts.length > 0 }}
      emptyTitle="No raw artifacts yet"
      emptyText="Upload pre-scan or scan report files to inspect their stored raw artifacts here."
      sections={sections}
      sectionData={{}}
    >
      {delErr && <div className="banner banner--danger">{delErr}</div>}
      <div className="actions">
        <Link className="btn btn--primary" to="/upload">Upload replacement reports</Link>
      </div>

      <Panel id="stage-files" title="Raw files by stage or scan" hint="Use this table to see exactly which report package owns each uploaded artifact group.">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Stage or scan</th><th>Report package</th><th>Files</th><th>Types</th><th>Total size</th><th>Last upload</th><th /></tr></thead>
            <tbody>
              {stageRows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.label}
                  </td>
                  <td>{row.packageType}</td>
                  <td>{row.count}</td>
                  <td>{[...row.kinds].map((kind) => <span className="tag" key={kind}>{kind}</span>)}</td>
                  <td>{fmtBytes(row.size)}</td>
                  <td>{fmtDate(row.latest)}</td>
                  <td>
                    {row.origin === 'scan'
                      ? (
                        <button type="button" className="btn btn--sm" disabled={!row.scanId} onClick={() => setDel(row)}>
                          Delete report
                        </button>
                      )
                      : (
                        <button type="button" className="btn btn--sm" onClick={() => setDel(row)}>
                          Clear stage
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel id="artifacts" title="Individual files" hint="Open a stored file when you need the raw source behind a mapped result. Secret values are masked in stored text.">
        {viewErr && <div className="banner banner--danger">{viewErr}</div>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>File</th><th>Kind</th><th>Stage or scan</th><th>Report package</th><th>Size</th><th>SHA-256</th><th>Uploaded</th><th /></tr></thead>
            <tbody>
              {artifacts.map((a) => (
                <tr key={`${a.origin}-${a.id}`}>
                  <td><code>{a.filename}</code></td>
                  <td><span className="tag">{a.kind}</span> {a.redacted && <span className="tag tag--warn">secrets masked</span>}</td>
                  <td>{a.stageLabel}</td>
                  <td>{a.packageType}</td>
                  <td>{fmtBytes(a.size_bytes)}</td>
                  <td>{a.sha256 ? <code>{a.sha256.slice(0, 12)}...</code> : <span className="muted">-</span>}</td>
                  <td>{fmtDate(a.created_at)}</td>
                  <td><button type="button" className="btn btn--sm" onClick={() => open(a.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {viewing && (
        <Modal title={viewing.filename} onClose={() => setViewing(null)}>
          {viewing.kind === 'mermaid' && <Mermaid source={viewing.content} />}
          <pre className="pre" style={{ marginTop: viewing.kind === 'mermaid' ? 14 : 0 }}>
            {viewing.content.length > 200000 ? `${viewing.content.slice(0, 200000)}\n\n... truncated` : viewing.content}
          </pre>
        </Modal>
      )}

      {del && (
        <Modal title={del.origin === 'scan' ? 'Delete uploaded scan report' : 'Clear uploaded stage data'} onClose={() => setDel(null)}>
          <p>
            {del.origin === 'scan' ? 'Delete' : 'Clear'} <strong>{del.origin === 'scan' ? del.label : stageLabel(del.stage_key)}</strong>
            {' '}and its stored raw files for this codebase?
          </p>
          <p className="muted">Use Upload replacement reports afterwards to load corrected output.</p>
          <div className="actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => setDel(null)}>Cancel</button>
            <button type="button" className="btn btn--primary" onClick={clear}>{del.origin === 'scan' ? 'Delete report' : 'Clear stage'}</button>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
