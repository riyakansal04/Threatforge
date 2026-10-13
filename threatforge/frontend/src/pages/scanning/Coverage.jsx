import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { Disclosure, Field, PageShell, Panel, Stats } from '../../components/Blocks.jsx';
import { ScanScopeSelector, scanTitle } from '../../components/ScanHistory.jsx';
import { MiniTable } from '../../components/Scanning.jsx';
import { Val } from '../../components/Val.jsx';
import { ArtifactViewer } from '../../components/Viewers.jsx';
import { asArray, cleanPresentationText, humanizeEnumValue, isEmpty } from '../../lib/format.js';
import { SCAN_LABELS, compactValue, str } from '../../lib/scanning.js';

function CoverageList({ title, items }) {
  const rows = asArray(items).filter((item) => !isEmpty(item));
  if (!rows.length) return null;
  return (
    <section className="scan-coverage-block">
      <h3>{title}</h3>
      <ul>
        {rows.map((item, index) => <li key={`${title}-${index}`}>{cleanPresentationText(compactValue(item) || str(item))}</li>)}
      </ul>
    </section>
  );
}

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
        const areas = asArray(c?.assessed_areas);
        const files = asArray(c?.files_reviewed);
        const exclusions = asArray(c?.exclusions || c?.limitations);
        const openQuestions = asArray(c?.open_questions);
        const numeric = Object.entries(c?.attributes || {}).filter(([, v]) => typeof v === 'number');
        const metrics = [
          { label: 'Assessed areas', value: areas.length },
          { label: 'Files reviewed', value: files.length },
          { label: 'Exclusions', value: exclusions.length },
          { label: 'Open questions', value: openQuestions.length },
          ...numeric.map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v })),
        ].filter((item) => Number(item.value) > 0);
        return (
          <Panel key={it.id} title={`${reportLabel || it.scan_label || 'Selected report'} - ${SCAN_LABELS[it.scan_type] || it.scan_type}`}>
            {metrics.length > 0 && <Stats items={metrics} />}
            <div className="chips">
              {c.status && <span className="chip">Status: {humanizeEnumValue(c.status)}</span>}
              {c.validation_mode && <span className="chip">Validation: {humanizeEnumValue(c.validation_mode)}</span>}
              {c.runtime_testing && <span className="chip">Runtime: {humanizeEnumValue(c.runtime_testing)}</span>}
              {c.source_modification && <span className="chip">Source changes: {humanizeEnumValue(c.source_modification)}</span>}
              {c.managed_scan_id && <span className="chip">{cleanPresentationText(str(c.managed_scan_id))}</span>}
            </div>
            <Field label="Summary" value={c.summary} />
            {areas.length > 0 && (
              <MiniTable
                cols={[
                  { label: 'Area', get: (row) => row.area || row.name || row.target || row },
                  { label: 'Coverage', get: (row) => row.coverage || row.status },
                  { label: 'Notes', get: (row) => row.notes || row.summary || row.description },
                ]}
                rows={areas}
              />
            )}
            <CoverageList title="Files reviewed" items={files} />
            <CoverageList title="Exclusions" items={exclusions} />
            <CoverageList title="Open questions" items={openQuestions} />
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
