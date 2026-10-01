import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, currentCodebaseId, setCurrentCodebaseId } from '../api/client.js';
import { PageShell } from '../components/Blocks.jsx';
import { fmtDate } from '../lib/format.js';

export default function CodebaseHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const selected = currentCodebaseId();

  const load = () => {
    setLoading(true);
    setError('');
    api.codebases()
      .then((res) => setItems(res.codebases || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const open = (id) => {
    setCurrentCodebaseId(id);
    window.location.href = '/scanning/overview';
  };

  const fresh = () => {
    setCurrentCodebaseId('');
    window.location.href = '/upload';
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name} and all stored results for it?`)) return;
    setBusy(row.id);
    try {
      await api.deleteCodebase(row.id);
      if (String(selected) === String(row.id)) setCurrentCodebaseId('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <PageShell
      eyebrow="Saved workspaces"
      title="Codebases"
      description="Pick a saved project context before reviewing architecture, scans, findings, review scope, and raw reports."
      state={{ loading, error, hasData: items.length > 0 }}
      emptyTitle="No codebases yet"
      emptyText="Create a codebase during upload, then add the reports you want to review."
      showEmptyContent
    >
      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={fresh}>Create codebase</button>
        <Link className="btn" to="/upload">Upload reports</Link>
      </div>

      {items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Codebase</th><th>Runs</th><th>Created</th><th>Updated</th><th>Last upload</th><th /></tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const isSelected = String(selected) === String(row.id);
                return (
                  <tr key={row.id} className={isSelected ? 'is-selected' : ''}>
                    <td>
                      <strong>{row.name}</strong>
                      {isSelected && <span className="tag tag--on" style={{ marginLeft: 8 }}>selected</span>}
                    </td>
                    <td>{row.run_count || 0}</td>
                    <td>{fmtDate(row.created_at)}</td>
                    <td>{fmtDate(row.updated_at)}</td>
                    <td>{fmtDate(row.last_run_at)}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn btn--sm" onClick={() => open(row.id)}>Open</button>
                        <Link className="btn btn--sm" to="/upload" onClick={() => setCurrentCodebaseId(row.id)}>Upload</Link>
                        <button type="button" className="btn btn--sm" disabled={busy === row.id} onClick={() => remove(row)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
