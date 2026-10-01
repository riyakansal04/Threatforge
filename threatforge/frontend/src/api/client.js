async function req(path, opts) {
  const res = await fetch(`/api${path}`, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail || j);
    } catch { /* keep status text */ }
    throw new Error(msg);
  }
  return res.json();
}

const CODEBASE_KEY = 'threatforge.codebase_id';
export const currentCodebaseId = () => localStorage.getItem(CODEBASE_KEY) || '';
export const setCurrentCodebaseId = (id) => {
  if (id) localStorage.setItem(CODEBASE_KEY, String(id));
  else localStorage.removeItem(CODEBASE_KEY);
};

const addQuery = (path, params = {}) => {
  const [base, existing = ''] = path.split('?');
  const q = new URLSearchParams(existing);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `${base}?${s}` : base;
};

const scoped = (path, params = {}) => addQuery(path, { codebase_id: currentCodebaseId() || '0', ...params });

export const api = {
  catalog: () => req('/catalog'),
  codebases: () => req('/codebases'),
  createCodebase: (name) => req('/codebases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }),
  deleteCodebase: (id) => req(`/codebases/${id}`, { method: 'DELETE' }),
  status: () => req(scoped('/status')),
  repositoryIntelligence: () => req(scoped('/prescan/repository-intelligence')),
  threatModel: () => req(scoped('/prescan/threat-model')),
  securityBaseline: () => req(scoped('/prescan/security-baseline')),
  scanPlanning: () => req(scoped('/prescan/scan-planning')),
  evidence: () => req(scoped('/prescan/evidence')),
  lifecycleStage: (key) => req(scoped(`/lifecycle/${key}`)),
  jiraConfig: () => req(scoped('/jira/config')),
  createJiraIssue: (itemKey) => req(scoped(`/jira/remediations/${encodeURIComponent(itemKey)}`), { method: 'POST' }),
  updateLifecycleRecord: (stageKey, recordKey, itemKey, updates) =>
    req(scoped(`/lifecycle/${encodeURIComponent(stageKey)}/records/${encodeURIComponent(recordKey)}/${encodeURIComponent(itemKey)}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(updates),
    }),
  artifact: (id) => req(`/artifacts/${id}`),
  clearStage: (key) => req(scoped(`/stages/${key}`), { method: 'DELETE' }),
  upload: (filesByStage, replace, codebase) => {
    const fd = new FormData();
    Object.entries(filesByStage).forEach(([stage, files]) =>
      files.forEach((f) => fd.append(`files:${stage}`, f, f.name))
    );
    return req(addQuery('/upload', {
      replace: replace ? 'true' : 'false',
      codebase_id: codebase?.id,
      codebase_name: codebase?.name,
    }), { method: 'POST', body: fd });
  },
  // scanning
  scanOverview: (id) => req(scoped('/scanning/overview', { scan_id: id })),
  scans: () => req(scoped('/scanning/scans')),
  scan: (id) => req(`/scanning/scans/${id}`),
  scanFindings: (id) => req(scoped('/scanning/findings', { scan_id: id })),
  scanCoverage: (id) => req(scoped('/scanning/coverage', { scan_id: id })),
  scanArtifacts: (id) => req(scoped('/scanning/artifacts', { scan_id: id })),
  deleteScan: (id) => req(`/scanning/scans/${id}`, { method: 'DELETE' }),
};
