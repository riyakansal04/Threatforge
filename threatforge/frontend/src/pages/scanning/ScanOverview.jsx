import { useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { PageShell, Sections } from '../../components/Blocks.jsx';
import Counts from '../../components/Counts.jsx';
import { ScanHistoryTable, ScanScopeSelector } from '../../components/ScanHistory.jsx';
import { Dist, MiniTable } from '../../components/Scanning.jsx';
import { fmtDate } from '../../lib/format.js';
import { SCAN_LABELS, SCAN_STAGE_LABELS } from '../../lib/scanning.js';

function ScanTypeCards({ rows = [], selectedId = '' }) {
  const active = rows.filter((row) => row.count || row.findings);
  if (!active.length) return <p className="muted">No scan reports have been uploaded yet.</p>;
  const maxFindings = Math.max(...active.map((row) => row.findings || 0), 1);
  return (
    <div className="scan-lanes">
      {active.map((row) => {
        const query = new URLSearchParams();
        if (selectedId) query.set('scan_id', selectedId);
        if (row.scan_type) query.set('scan_type', SCAN_LABELS[row.scan_type] || row.scan_type);
        const queryString = query.toString();
        return (
          <Link className="scan-lane" to={`/scanning/findings${queryString ? `?${queryString}` : ''}`} key={`${row.scan_type || 'scan'}-${row.count}-${row.latest || ''}`}>
            <div className="scan-lane__main">
              <span className="tag">{SCAN_LABELS[row.scan_type] || row.scan_type}</span>
              <div className="scan-lane__track" aria-label={`${row.findings} findings`}>
                <span style={{ width: `${Math.max(6, ((row.findings || 0) / maxFindings) * 100)}%` }} />
              </div>
              <strong>{row.findings || 0}</strong>
            </div>
            <div className="scan-lane__meta">
              <span>{row.count} report{row.count === 1 ? '' : 's'}</span>
              <span>{fmtDate(row.latest)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function ScanOverview() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('scan_id') || '';
  const fn = useCallback(() => api.scanOverview(selectedId), [selectedId]);
  const { data, loading, error } = useApi(fn);
  const d = data || {};
  const history = d.scan_history || [];
  const selected = d.selected_scan;
  const latest = d.latest_scan;
  useEffect(() => {
    if (!loading && history.length > 0 && (!selectedId || !selected)) {
      const next = new URLSearchParams(params);
      const fallbackId = String(latest?.id || history[0].id);
      if (fallbackId === selectedId) return;
      next.set('scan_id', fallbackId);
      setParams(next, { replace: true });
    }
  }, [loading, selectedId, selected, history, latest, params, setParams]);

  const setSelected = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('scan_id', id);
    setParams(next);
  };

  const sections = [
    { id: 'summary', title: 'Select report', render: () => (
      <ScanScopeSelector scans={history} value={selectedId} onChange={setSelected} />
    ) },
    { id: 'types', title: 'Report scope by type', render: () => <ScanTypeCards rows={d.by_type || []} selectedId={selectedId} /> },
    { id: 'distribution', title: 'Finding signals', hint: 'Counted from uploaded reports only. Nothing is scored or estimated.', render: () => (
      <div className="dist-grid">
        <Dist title="Severity (as reported)" items={d.severity} unit="findings" />
        <Dist title="Confidence (as reported)" items={d.confidence} unit="findings" />
        <Dist title="Category" items={d.category} unit="findings" />
        <Dist title="Classification (as reported)" items={d.classification} unit="findings" />
        <Dist title="Scan status" items={d.statuses} unit="reports" />
        {!(d.severity?.length || d.category?.length || d.classification?.length) && <p className="muted">The uploaded reports contain no severity, category or classification values.</p>}
      </div>
    ) },
    { id: 'history', title: 'Report history', render: () => (
      <ScanHistoryTable scans={history} selectedId={selectedId} onSelect={setSelected} />
    ) },
    { id: 'artifacts', title: 'Available artifact types', render: () => (
      (d.artifact_types || []).length
        ? <div className="chips">{d.artifact_types.map((a) => <span className="chip" key={a.label}>{a.label}: {a.count}</span>)}</div>
        : <p className="muted">No artifacts stored.</p>
    ) },
    { id: 'runs', title: 'Recent runs', render: () => (
      (d.recent_runs || []).length ? (
        <MiniTable
          cols={[
            { label: 'Stage', get: (r) => SCAN_STAGE_LABELS[r.stage_key] || r.stage_key },
            { label: 'Files', get: (r) => r.file_count },
            { label: 'Mapped', get: (r) => <Counts counts={r.counts} /> },
            { label: 'Warnings', get: (r) => (r.warnings || []).length ? r.warnings : null },
            { label: 'When', get: (r) => fmtDate(r.created_at) },
          ]}
          rows={d.recent_runs}
        />
      ) : <p className="muted">No runs yet.</p>
    ) },
  ];

  return (
    <PageShell
      eyebrow="Scanning"
      title="Security analysis dashboard"
      description="What scan reports have been uploaded, what they reviewed, and what findings they produced."
      state={{ loading, error, hasData: !!d.has_data }}
      emptyTitle="No scan reports yet"
      emptyText="Run a scanning stage in Codex Security, then upload its report files. This page shows what will appear."
      sections={sections}
    >
      <Sections d={{}} sections={sections} />
    </PageShell>
  );
}
