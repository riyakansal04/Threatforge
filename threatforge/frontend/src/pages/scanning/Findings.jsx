import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { PageShell } from '../../components/Blocks.jsx';
import { ScanScopeSelector, scanTitle } from '../../components/ScanHistory.jsx';
import { FindingDetail, FindingsTable } from '../../components/Scanning.jsx';
import { ArtifactViewer } from '../../components/Viewers.jsx';
import { humanizeEnumValue } from '../../lib/format.js';
import { SCAN_LABELS, isDisplayableFinding, sevOf, str } from '../../lib/scanning.js';

const FILTERS = [
  ['severity', 'Severity', sevOf],
  ['category', 'Category'],
  ['confidence', 'Confidence'],
  ['scan_type', 'Scan type', (f) => SCAN_LABELS[f.scan_type] || f.scan_type],
  ['classification', 'Classification'],
  ['cwe', 'CWE'],
  ['affected_area', 'Component / area'],
  ['affected_dependency', 'Dependency'],
  ['runtime_target', 'Runtime target'],
];

export default function Findings() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('scan_id') || '';
  const fn = useCallback(() => api.scanFindings(selectedId), [selectedId]);
  const { data, loading, error } = useApi(fn);
  const [filters, setFilters] = useState(() => Object.fromEntries(
    FILTERS.map(([k]) => [k, params.get(k) || '']).filter(([, v]) => v)
  ));
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [art, setArt] = useState(null);
  const rawItems = data?.findings || [];
  const items = rawItems.filter(isDisplayableFinding);
  const hiddenMetadataRows = Math.max(0, rawItems.length - items.length);
  const history = data?.scan_history || [];
  const selected = data?.selected_scan;
  useEffect(() => {
    if (!selectedId && params.get('scan_type')) return; // came from a scan-type link: show findings across all scans of that type
    if (!loading && history.length > 0 && (!selectedId || !selected)) {
      const fallbackId = String(history[0].id);
      if (fallbackId === selectedId) return;
      const next = new URLSearchParams(params);
      next.set('scan_id', fallbackId);
      setParams(next, { replace: true });
    }
  }, [loading, selectedId, selected, history, params, setParams]);
  const setSelected = (id) => {
    if (!id) return;
    const next = new URLSearchParams(params);
    next.set('scan_id', id);
    FILTERS.forEach(([k]) => next.delete(k));
    setParams(next);
    setFilters({});
    setQ('');
  };
  const setFilterValue = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    if (!value) delete nextFilters[key];
    setFilters(nextFilters);
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const getter = (k, g) => g || ((f) => humanizeEnumValue(str(f[k])));
  const options = useMemo(
    () => FILTERS.map(([k, label, g]) => [k, label, [...new Set(items.map(getter(k, g)).filter(Boolean))].sort()]),
    [items]
  );

  const shown = items.filter((f) =>
    FILTERS.every(([k, , g]) => !filters[k] || getter(k, g)(f) === filters[k]) &&
    (!q.trim() || JSON.stringify(f).toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <PageShell
      eyebrow="Scanning"
      title="Findings"
      description={selected ? `Findings for ${scanTitle(selected)}.` : 'Findings reported by the selected codebase report. Click a row for the full record.'}
      state={{ loading, error, hasData: !!data?.has_data }}
      emptyTitle="No findings yet"
      emptyText="Upload the report files of a scanning stage to see its findings here."
    >
      <ScanScopeSelector scans={history} value={selectedId} onChange={setSelected} />
      {items.length > 0 && (
        <>
          <div className="finding-page-summary">
            <strong>{shown.length}</strong>
            <span>{shown.length === 1 ? 'finding shown' : 'findings shown'}</span>
            <em>{items.length === shown.length ? 'All reported findings' : `${items.length - shown.length} filtered out`}</em>
          </div>
          {hiddenMetadataRows > 0 && (
            <p className="muted">
              {hiddenMetadataRows} scanner metadata {hiddenMetadataRows === 1 ? 'row was' : 'rows were'} hidden because it did not describe a concrete finding.
            </p>
          )}
          <div className="toolbar">
            {options.filter(([, , o]) => o.length > 0).map(([k, label, o]) => (
              <select key={k} className="input" value={filters[k] || ''} onChange={(e) => setFilterValue(k, e.target.value)}>
                <option value="">{label}: all</option>
                {o.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ))}
            <input className="input" placeholder="Search findings" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <FindingsTable items={shown} onOpen={setSel} showScan={!selected} />
        </>
      )}
      {items.length === 0 && data?.has_data && (
        <p className="muted">
          {rawItems.length > 0
            ? 'This report contains scanner metadata, but no concrete finding records were recognized.'
            : 'No findings were reported for this scan selection.'}
        </p>
      )}
      {sel && <FindingDetail f={sel} onClose={() => setSel(null)} onOpenArtifact={setArt} />}
      {art && <ArtifactViewer id={art} onClose={() => setArt(null)} />}
    </PageShell>
  );
}
