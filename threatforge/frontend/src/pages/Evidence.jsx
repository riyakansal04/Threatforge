import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { PageShell, Panel } from '../components/Blocks.jsx';
import { STAGE_LABELS } from '../lib/stages.js';

export default function Evidence() {
  const { data, loading, error } = useApi(api.evidence);
  const [stage, setStage] = useState('all');
  const [q, setQ] = useState('');

  const refs = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.references || []).filter((r) =>
      (stage === 'all' || r.stage_key === stage) &&
      (!term || JSON.stringify(r).toLowerCase().includes(term)));
  }, [data, stage, q]);

  const sections = [
    { id: 'refs', title: 'Source references', isVisible: () => (data?.references || []).length > 0 },
  ];

  return (
    <PageShell
      eyebrow="Traceability"
      title="Source evidence"
      description="Search the source references used to support mapped codebase, threat, planning, scan and finding information."
      state={{ loading, error, hasData: (data?.references || []).length > 0 }}
      emptyTitle="No source references yet"
      emptyText="Source references appear after mapped report files include traceable file or line evidence."
      sections={sections}
      sectionData={{}}
    >
      <Panel id="refs" title="Source references" hint="Use this when you need to audit where displayed information came from.">
        <div className="toolbar">
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">All stages</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" placeholder="Search references" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted">{refs.length} reference{refs.length === 1 ? '' : 's'}</span>
        </div>
        {refs.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Stage</th><th>Mapped information</th><th>Item</th><th>Location</th><th>Description</th><th>Type</th></tr></thead>
              <tbody>
                {refs.map((r, i) => {
                  const ref = r.reference || {};
                  return (
                    <tr key={`${r.stage_key}-${r.owner_label || 'item'}-${i}`}>
                      <td>{STAGE_LABELS[r.stage_key] || r.stage_key}</td>
                      <td>{String(r.entity_type || 'Item').replace(/_/g, ' ')}</td>
                      <td>{r.owner_label || <span className="muted">-</span>}</td>
                      <td><code>{ref.file_or_location}{ref.line_or_range_if_available ? `:${ref.line_or_range_if_available}` : ''}</code></td>
                      <td>{ref.description || <span className="muted">-</span>}</td>
                      <td>{ref.evidence_type || <span className="muted">-</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No source references match.</p>}
      </Panel>
    </PageShell>
  );
}
