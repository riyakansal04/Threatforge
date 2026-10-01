import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { Disclosure, Field, PageShell, Panel, Stats } from '../../components/Blocks.jsx';
import { ScanScopeSelector, scanTitle } from '../../components/ScanHistory.jsx';
import { Val } from '../../components/Val.jsx';
import { ArtifactViewer } from '../../components/Viewers.jsx';
import { SCAN_LABELS } from '../../lib/scanning.js';

export default function Coverage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('scan_id') || '';
  const fn = useCallback(() => api.scanCoverage(selectedId), [selectedId]);
  const { data, loading, error } = useApi(fn);
  const [art, setArt] = useState(null);
  const items = data?.items || [];
  const coveredItems = items.filter((it) => it.coverage);
  const history = data?.scan_history || [];
  const selected = data?.selected_scan;
  const reportLabel = selected ? scanTitle(selected) : '';
  useEffect(() => {
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
    setParams(next);
  };

  return (
    <PageShell
      eyebrow="Scanning"
      title="Scan scope"
      description={selected ? `Reported review scope for ${scanTitle(selected)}.` : 'What the selected report says it reviewed, with stated limitations.'}
      state={{ loading, error, hasData: !!data?.has_data }}
      emptyTitle="No scan scope yet"
      emptyText="Scope details appear after you upload report files that include what was reviewed."
    >
      <ScanScopeSelector scans={history} value={selectedId} onChange={setSelected} />
      {coveredItems.map((it) => {
        const c = it.coverage;
        const numeric = Object.entries(c?.attributes || {}).filter(([, v]) => typeof v === 'number');
        return (
          <Panel key={it.id} title={`${reportLabel || it.scan_label || 'Selected report'} - ${SCAN_LABELS[it.scan_type] || it.scan_type}`}>
            {numeric.length > 0 && <Stats items={numeric.map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v }))} />}
            <Field label="Summary" value={c.summary} />
            <Field label="Limitations" value={c.limitations} />
            {c.attributes && (
              <Disclosure title="Open reported details">
                <Val v={c.attributes} />
              </Disclosure>
            )}
            {it.artifact_id && <div><button type="button" className="btn btn--sm" onClick={() => setArt(it.artifact_id)}>Open raw scope artifact</button></div>}
          </Panel>
        );
      })}
      {coveredItems.length === 0 && data?.has_data && <p className="muted">No scan-scope records match this report selection.</p>}
      {art && <ArtifactViewer id={art} onClose={() => setArt(null)} />}
    </PageShell>
  );
}
