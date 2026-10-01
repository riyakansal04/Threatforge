import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderUp, FileUp, X } from 'lucide-react';
import { api, currentCodebaseId, setCurrentCodebaseId } from '../api/client.js';
import Counts from '../components/Counts.jsx';
import { fmtBytes } from '../lib/format.js';
import { STAGE_LABELS, STAGE_PAGES } from '../lib/stages.js';

const EXT = ['.json', '.md', '.markdown', '.mmd', '.mermaid', '.sarif', '.txt', '.sha256', '.sha'];
const okFile = (f) => EXT.some((e) => f.name.toLowerCase().endsWith(e));
const extOf = (n) => (n.includes('.') ? n.slice(n.lastIndexOf('.')).toLowerCase() : '');
const KIND = { '.json': 'JSON', '.md': 'Markdown', '.markdown': 'Markdown', '.mmd': 'Mermaid', '.mermaid': 'Mermaid', '.sarif': 'SARIF', '.txt': 'Manifest', '.sha256': 'Manifest', '.sha': 'Manifest' };
const sig = (f) => `${f.name}|${f.size}|${f.lastModified}`;

const STAGE_DESCRIPTIONS = {
  triage: 'Validate, classify, correlate and deduplicate reported findings.',
  prioritization: 'Prioritize validated findings and define the remediation order.',
  investigation: 'Confirm root cause, affected paths, required controls and the recommended fix direction.',
  remediation: 'Capture implemented fixes, validation notes and remaining risk.',
};

const stageDisplay = (stage) => ({
  ...stage,
  label: STAGE_LABELS[stage.key] || stage.label,
  description: STAGE_DESCRIPTIONS[stage.key] || stage.description,
});

function StageUpload({ stage, files, onAdd, onRemove }) {
  const fileRef = useRef(null);
  const dirRef = useRef(null);
  const [over, setOver] = useState(false);
  const [ignored, setIgnored] = useState(0);

  const add = (list) => {
    const arr = Array.from(list || []);
    const good = arr.filter(okFile);
    setIgnored(arr.length - good.length);
    onAdd(stage.key, good);
  };

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">{stage.label}</h2>
        <p className="panel__hint">{stage.description}</p>
      </header>
      <div className="panel__body">
        <div
          className={over ? 'dropzone is-over' : 'dropzone'}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        >
          <span>Drop report files for this review area here</span>
          <div className="actions">
            <button type="button" className="btn" onClick={() => fileRef.current.click()}>
              <FileUp size={15} aria-hidden="true" /> Add files
            </button>
            <button type="button" className="btn" onClick={() => dirRef.current.click()}>
              <FolderUp size={15} aria-hidden="true" /> Add folder
            </button>
          </div>
          <span className="muted">Supported: JSON, Markdown, Mermaid, SARIF, text and manifest files.</span>
          <input ref={fileRef} type="file" multiple hidden accept={EXT.join(',')}
            onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          <input ref={dirRef} type="file" multiple hidden webkitdirectory="true"
            onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </div>

        {ignored > 0 && <p className="muted" style={{ marginTop: 10 }}>{ignored} file(s) ignored because the type is not supported.</p>}

        {files.length > 0 && (
          <div className="file-list">
            {files.map((f) => (
              <div className="file-row" key={sig(f)}>
                <code title={f.name}>{f.name}</code>
                <span className="tag">{KIND[extOf(f.name)]}</span>
                <span className="muted">{fmtBytes(f.size)}</span>
                <button type="button" className="expander" aria-label={`Remove ${f.name}`} onClick={() => onRemove(stage.key, sig(f))}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Upload() {
  const [phases, setPhases] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState([]);
  const [files, setFiles] = useState({});
  const [replace, setReplace] = useState(false);
  const [codebases, setCodebases] = useState([]);
  const [codebaseMode, setCodebaseMode] = useState(currentCodebaseId() ? 'existing' : 'new');
  const [codebaseId, setCodebaseId] = useState(currentCodebaseId());
  const [codebaseName, setCodebaseName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState(null);

  useEffect(() => {
    api.catalog().then((c) => setPhases(c.phases)).catch((e) => setLoadErr(e.message));
    api.codebases().then((res) => {
      const rows = res.codebases || [];
      setCodebases(rows);
    }).catch(() => {});
  }, []);

  const stageList = (phases || []).flatMap((p) => p.stages.map((s) => ({ ...stageDisplay(s), phase: p })));
  const chosen = stageList.filter((s) => selected.includes(s.key));
  const toggle = (key) => setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  const addFiles = (key, list) =>
    setFiles((cur) => {
      const have = new Map((cur[key] || []).map((f) => [sig(f), f]));
      list.forEach((f) => have.set(sig(f), f));
      return { ...cur, [key]: [...have.values()] };
    });
  const removeFile = (key, s) => setFiles((cur) => ({ ...cur, [key]: (cur[key] || []).filter((f) => sig(f) !== s) }));

  const payload = Object.fromEntries(chosen.map((s) => [s.key, files[s.key] || []]).filter(([, f]) => f.length));
  const canSubmit = Object.keys(payload).length > 0 && !busy;
  const canName = codebaseMode === 'new' ? !!codebaseName.trim() : !!codebaseId;
  const emptyChosen = chosen.filter((s) => !(files[s.key] || []).length);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const codebase = codebaseMode === 'new' ? { name: codebaseName } : { id: codebaseId };
      if (codebaseMode === 'new' && !codebaseName.trim()) throw new Error('Give this codebase a name first.');
      const res = await api.upload(payload, replace, codebase);
      if (res.codebase_id) setCurrentCodebaseId(res.codebase_id);
      setRuns(res.runs);
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setSelected([]); setFiles({}); setRuns(null); setError(''); setStep(1); };

  const stepCls = (n) => (step === n ? 'step is-current' : step > n ? 'step is-done' : 'step');

  return (
    <div className="stack">
      <div className="page-head">
        <div className="eyebrow">Add evidence to a codebase</div>
        <h1>Upload reports</h1>
        <p>Choose the review areas you ran, attach the matching output files, and ThreatForge will map them into the dashboard for the selected codebase.</p>
        <p className="muted" style={{marginTop: 8}}>Each scan upload is saved as its own report, so you can inspect one scan or view the full history together.</p>
      </div>

      <div className="steps">
        <span className={stepCls(1)}><b>1</b> Choose review areas</span>
        <span className={stepCls(2)}><b>2</b> Choose codebase</span>
        <span className={stepCls(3)}><b>3</b> Add report files</span>
        <span className={stepCls(4)}><b>4</b> Review import</span>
      </div>

      {loadErr && <div className="banner banner--danger">Could not load stages: {loadErr}. Check that the backend is running on port 8080.</div>}
      {error && <div className="banner banner--danger">{error}</div>}

      {step === 1 && phases && (
        <>
          <p className="muted">Select every review area represented by your files. Each area gets its own upload dropzone, so outputs stay separated.</p>
          <div className="stack">
            {phases.map((p) => (
              <div key={p.id} className={p.available ? 'phase' : 'phase is-off'}>
                <div className="phase__head">
                  <h3>{p.label}</h3>
                  <span className={p.available ? 'tag tag--on' : 'tag'}>{p.available ? 'Available' : 'Coming later'}</span>
                </div>
                <div className="phase__body">
                  {p.stages.map((raw) => {
                    const s = stageDisplay(raw);
                    const on = selected.includes(s.key);
                    return (
                      <label key={s.key} className={`stage-pick ${on ? 'is-on' : ''} ${p.available ? '' : 'is-off'}`}>
                        <input type="checkbox" checked={on} disabled={!p.available} onChange={() => toggle(s.key)} />
                        <div>
                          <strong>{s.label}</strong>
                          {s.description && <span>{s.description}</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="actions">
            <button type="button" className="btn btn--primary btn--lg" disabled={!selected.length} onClick={() => setStep(2)}>
              Continue with {selected.length || 'no'} review area{selected.length === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <section className="panel">
            <header className="panel__head">
              <h2 className="panel__title">Codebase</h2>
              <p className="panel__hint">Save this upload under a project name so future reports stay in the right workspace.</p>
            </header>
            <div className="panel__body">
              <div className="toolbar">
                <label className="check">
                  <input type="radio" checked={codebaseMode === 'existing'} onChange={() => setCodebaseMode('existing')} />
                  Existing codebase
                </label>
                <label className="check">
                  <input type="radio" checked={codebaseMode === 'new'} onChange={() => setCodebaseMode('new')} />
                  New codebase
                </label>
              </div>
              {codebaseMode === 'existing' ? (
                <select className="input codebase-input" value={codebaseId} onChange={(e) => setCodebaseId(e.target.value)}>
                  <option value="">Select saved codebase</option>
                  {codebases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <input
                  className="input codebase-input"
                  placeholder="Example: Payments API - Sep 2026"
                  value={codebaseName}
                  onChange={(e) => setCodebaseName(e.target.value)}
                />
              )}
            </div>
          </section>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="btn btn--primary btn--lg" disabled={!canName} onClick={() => setStep(3)}>
              Continue to report files
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {chosen.map((s) => (
            <StageUpload key={s.key} stage={s} files={files[s.key] || []} onAdd={addFiles} onRemove={removeFile} />
          ))}
          {emptyChosen.length > 0 && Object.keys(payload).length > 0 && (
            <div className="banner banner--warn">
              No files added for: {emptyChosen.map((s) => s.label).join(', ')}. Those review areas will be skipped.
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace existing data for these review areas instead of adding to it
          </label>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setStep(2)}>Back</button>
            <button type="button" className="btn btn--primary btn--lg" disabled={!canSubmit} onClick={submit}>
              {busy ? 'Saving reports...' : 'Save to dashboard'}
            </button>
          </div>
        </>
      )}

      {step === 4 && runs && (
        <>
          {runs.map((r) => {
            const label = STAGE_LABELS[r.stage] || r.label;
            return (
              <section className="panel" key={r.stage}>
                <header className="panel__head">
                  <h2 className="panel__title">{label}</h2>
                  <p className="panel__hint">
                    {r.files_stored} of {r.files_received} file(s) stored
                    {r.skipped_duplicates.length > 0 && `, ${r.skipped_duplicates.length} duplicate file(s) skipped from this upload`}
                  </p>
                </header>
                <div className="panel__body result">
                  <div><h3 className="field__label">Mapped</h3><Counts counts={r.counts} /></div>
                  {r.warnings.length > 0 && (
                    <div className="banner banner--warn" style={{ display: 'block' }}>
                      <strong>Needs a look</strong>
                      <ul className="bullets">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                    </div>
                  )}
                  {STAGE_PAGES[r.stage] && (
                    <div><Link className="btn btn--primary" to={STAGE_PAGES[r.stage]}>Open {label}</Link></div>
                  )}
                </div>
              </section>
            );
          })}
          <div className="actions">
            <button type="button" className="btn" onClick={reset}>Upload more</button>
            <Link className="btn" to="/scanning/overview">Open analysis dashboard</Link>
            <Link className="btn" to="/pre-scan/raw-artifacts">Open raw artifacts</Link>
          </div>
        </>
      )}
    </div>
  );
}
