import { useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { Modal } from './Blocks.jsx';
import { Mermaid } from './Mermaid.jsx';
import { fmtBytes } from '../lib/format.js';

const has = (k, v, t) => !t || JSON.stringify([k, v]).toLowerCase().includes(t);

function Node({ k, v, t, depth }) {
  if (!has(k, v, t)) return null;
  if (v === null || typeof v !== 'object') {
    return (
      <div className="jt-row">
        <span className="jt-k">{String(k)}</span>: <span className={`jt-v jt-${v === null ? 'null' : typeof v}`}>{JSON.stringify(v)}</span>
      </div>
    );
  }
  const entries = Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
  return (
    <details className="jt" open={depth < 1 || !!t}>
      <summary>
        <span className="jt-k">{String(k)}</span>{' '}
        <span className="muted">{Array.isArray(v) ? `[${entries.length}]` : `{${entries.length}}`}</span>
      </summary>
      <div className="jt-kids">
        {entries.map(([kk, vv]) => <Node key={kk} k={kk} v={vv} t={t} depth={depth + 1} />)}
      </div>
    </details>
  );
}

export function JsonTree({ data }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  return (
    <div className="stack-sm">
      <input className="input" placeholder="Search keys and values" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="jtree"><Node k="root" v={data} t={t} depth={0} /></div>
    </div>
  );
}

const locOf = (r) => {
  const p = r.locations?.[0]?.physicalLocation;
  const uri = p?.artifactLocation?.uri;
  return uri ? `${uri}${p?.region?.startLine ? `:${p.region.startLine}` : ''}` : '-';
};

export function SarifView({ data }) {
  const runs = Array.isArray(data?.runs) ? data.runs : [];
  if (!runs.length) return <p className="muted">No runs found in this SARIF file.</p>;
  return runs.map((run, i) => {
    const driver = run.tool?.driver || {};
    const rules = driver.rules || [];
    const results = run.results || [];
    return (
      <div key={i} className="stack-sm">
        <h3>{driver.name || 'Tool'} {driver.version && <span className="muted">{driver.version}</span>}</h3>
        <div className="chips"><span className="chip">{rules.length} rules</span><span className="chip">{results.length} results</span></div>
        {rules.length > 0 && (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Rule</th><th>Name</th><th>Description</th></tr></thead>
            <tbody>{rules.slice(0, 200).map((r, j) => (
              <tr key={j}><td><code>{r.id}</code></td><td>{r.name || '-'}</td><td>{r.shortDescription?.text || r.fullDescription?.text || '-'}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        {results.length > 0 && (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Rule</th><th>Level</th><th>Message</th><th>Location</th><th>Properties</th></tr></thead>
            <tbody>{results.slice(0, 500).map((r, j) => (
              <tr key={j}>
                <td><code>{r.ruleId || '-'}</code></td><td>{r.level || '-'}</td>
                <td>{r.message?.text || '-'}</td><td><code>{locOf(r)}</code></td>
                <td>{r.properties ? <code>{JSON.stringify(r.properties).slice(0, 160)}</code> : '-'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    );
  });
}

export function ArtifactViewer({ id, onClose }) {
  const fn = useCallback(() => api.artifact(id), [id]);
  const { data, loading, error } = useApi(fn);
  const [tab, setTab] = useState('preview');
  const name = (data?.filename || '').toLowerCase();
  let parsed = null;
  if (data && (name.endsWith('.json') || name.endsWith('.sarif'))) {
    try { parsed = JSON.parse(data.content); } catch { parsed = null; }
  }
  const isMd = data?.kind === 'markdown_report' || name.endsWith('.md') || name.endsWith('.markdown');
  const isMmd = name.endsWith('.mmd') || name.endsWith('.mermaid');
  const raw = data ? (data.content.length > 300000 ? `${data.content.slice(0, 300000)}\n\n... truncated` : data.content) : '';

  let preview = <pre className="pre">{raw}</pre>;
  if (parsed && data.kind === 'sarif_report') preview = <SarifView data={parsed} />;
  else if (parsed) preview = <JsonTree data={parsed} />;
  else if (isMd) preview = <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{data?.content || ''}</ReactMarkdown></div>;
  else if (isMmd) preview = <Mermaid source={data?.content || ''} />;

  return (
    <Modal title={data ? data.filename : 'Artifact'} onClose={onClose}>
      {loading && <p className="muted">Loading...</p>}
      {error && <div className="banner banner--danger">{error}</div>}
      {data && (
        <div className="stack-sm">
          <div className="chips">
            <span className="tag">{data.kind}</span>
            <span className="chip">{fmtBytes(data.size_bytes)}</span>
            <span className="chip"><code>{data.sha256.slice(0, 16)}...</code></span>
            {data.redacted && <span className="tag tag--warn">secrets masked</span>}
          </div>
          <div className="tabs">
            <button type="button" className={tab === 'preview' ? 'tab is-on' : 'tab'} onClick={() => setTab('preview')}>Preview</button>
            <button type="button" className={tab === 'raw' ? 'tab is-on' : 'tab'} onClick={() => setTab('raw')}>Raw source</button>
          </div>
          {tab === 'preview' ? preview : <pre className="pre">{raw}</pre>}
        </div>
      )}
    </Modal>
  );
}
