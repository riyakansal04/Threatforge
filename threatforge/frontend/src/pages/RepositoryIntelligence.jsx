import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import DataTable from '../components/DataTable.jsx';
import { Field, PageShell, Sections, Stats } from '../components/Blocks.jsx';
import { asArray, cleanPresentationText, count, isEmpty, labelOf, splitEvidence, splitLeadingLabel } from '../lib/format.js';

const TECH_COLS = [
  { label: 'Technology', keys: ['name'] },
  { label: 'Role', keys: ['roles'] },
  { label: 'Version / purpose', keys: ['detail'] },
];

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'from', 'into', 'this', 'that', 'when', 'then', 'also', 'they',
  'using', 'used', 'uses', 'based', 'started', 'starts', 'application', 'repository',
  'evidence', 'workflow', 'runtime', 'dependency', 'dependencies', 'language',
]);

function textOf(value) {
  if (typeof value === 'string') return splitEvidence(value).text;
  if (value && typeof value === 'object') {
    return cleanPresentationText([
      value.name,
      value.language,
      value.framework,
      value.library,
      value.dependency_name,
      value.service,
      value.title,
      value.description,
      value.summary,
      value.detail,
      value.purpose,
    ].filter(Boolean).join(' ')) || labelOf(value);
  }
  return cleanPresentationText(value);
}

function tokensOf(value) {
  return new Set(cleanPresentationText(textOf(value))
    .toLowerCase()
    .replace(/python\s*3/g, 'python')
    .replace(/admin_secret/g, 'admin secret')
    .match(/[a-z0-9_./-]+/g)
    ?.map((x) => x.replace(/[._/-]/g, ' ').trim())
    .flatMap((x) => x.split(/\s+/))
    .filter((x) => x.length > 2 && !STOP_WORDS.has(x)) || []);
}

function isSimilar(a, b) {
  const left = tokensOf(a);
  const right = tokensOf(b);
  if (!left.size || !right.size) return false;
  const overlap = [...left].filter((x) => right.has(x)).length;
  return overlap / Math.min(left.size, right.size) >= 0.58;
}

function addUnique(list, value) {
  const text = cleanPresentationText(value);
  if (!text || list.some((item) => item.toLowerCase() === text.toLowerCase())) return;
  list.push(text);
}

function addRefs(list, refs) {
  asArray(refs).forEach((ref) => {
    const text = cleanPresentationText(typeof ref === 'string' ? ref : `${ref.file_or_location || ''}${ref.line_or_range_if_available ? `:${ref.line_or_range_if_available}` : ''}`);
    if (text && !list.includes(text)) list.push(text);
  });
}

function refsOf(item) {
  const refs = [];
  if (typeof item === 'string') addRefs(refs, splitEvidence(item).refs);
  if (item && typeof item === 'object') {
    addRefs(refs, item.source_references);
    addRefs(refs, item.evidence_references);
    addRefs(refs, item.evidence);
    Object.entries(item).forEach(([key, value]) => {
      if (/evidence|reference/i.test(key) && typeof value === 'string') addRefs(refs, splitEvidence(value).refs);
    });
  }
  return refs;
}

function technologyName(item) {
  if (item && typeof item === 'object') {
    return cleanPresentationText(item.name || item.language || item.framework || item.library || item.dependency_name || labelOf(item));
  }
  const text = textOf(item);
  const lead = splitLeadingLabel(text);
  const candidate = lead.text || text;
  const match = candidate.match(/^([A-Za-z][A-Za-z0-9.+_-]*)(?:\s+via|\s+with|\s+imported|\s+for|\s+using|,|$)/i);
  return cleanPresentationText(match?.[1] || candidate);
}

function techKey(name) {
  return cleanPresentationText(name)
    .toLowerCase()
    .replace(/\bpython\s*3\b/g, 'python')
    .replace(/\blxml\.etree\b/g, 'lxml')
    .replace(/[^a-z0-9]+/g, '');
}

function detailOf(item) {
  if (typeof item === 'string') {
    const lead = splitLeadingLabel(splitEvidence(item).text);
    return cleanPresentationText(lead.text || item);
  }
  if (item && typeof item === 'object') {
    return cleanPresentationText(item.version_evidence || item.purpose || item.description || item.summary || item.detail || '');
  }
  return '';
}

function buildTechnologyView(d) {
  const rows = [];
  const byKey = new Map();
  const additionalRuntimeNotes = [];
  const additionalDependencyNotes = [];

  const ensureRow = (name) => {
    const cleanName = cleanPresentationText(name);
    const key = techKey(cleanName);
    if (!key) return null;
    if (!byKey.has(key)) {
      const row = { name: cleanName, roles: [], detail: '', evidence: [], supporting_notes: [] };
      byKey.set(key, row);
      rows.push(row);
    }
    return byKey.get(key);
  };

  const addPrimary = (field, role) => {
    asArray(d[field]).forEach((item) => {
      const row = ensureRow(technologyName(item));
      if (!row) return;
      addUnique(row.roles, role);
      const detail = detailOf(item);
      if (detail && !row.detail) row.detail = detail;
      addRefs(row.evidence, refsOf(item));
    });
  };

  addPrimary('languages', 'Language');
  addPrimary('frameworks', 'Framework');
  addPrimary('libraries', 'Library');

  const mergeSecondary = (field, role, fallback) => {
    asArray(d[field]).forEach((item) => {
      const text = textOf(item);
      const matches = rows.filter((row) => {
        const rowKey = techKey(row.name);
        const haystack = techKey(text);
        return rowKey && (haystack.includes(rowKey) || rowKey.includes(haystack) || isSimilar(row.name, text) || isSimilar(row.detail, text));
      });
      if (!matches.length) {
        fallback.push(text);
        return;
      }
      matches.forEach((row) => {
        addUnique(row.roles, role);
        addRefs(row.evidence, refsOf(item));
        const detail = detailOf(item);
        if (detail && !isSimilar(detail, row.detail || row.name)) addUnique(row.supporting_notes, detail);
      });
    });
  };

  mergeSecondary('runtimes', 'Runtime signal', additionalRuntimeNotes);
  mergeSecondary('dependencies', 'Dependency signal', additionalDependencyNotes);

  return {
    rows: rows.map((row) => ({
      name: row.name,
      roles: row.roles,
      detail: row.detail,
      supporting_notes: row.supporting_notes.length ? row.supporting_notes : undefined,
    })),
    additionalRuntimeNotes: uniqueAgainst(additionalRuntimeNotes, rows.map((row) => `${row.name} ${row.detail}`)),
    additionalDependencyNotes: uniqueAgainst(additionalDependencyNotes, rows.map((row) => `${row.name} ${row.detail}`)),
  };
}

function uniqueAgainst(items, covered = []) {
  const seen = [...covered];
  const kept = [];
  asArray(items).forEach((item) => {
    const text = textOf(item);
    if (!text || seen.some((existing) => isSimilar(text, existing))) return;
    kept.push(item);
    seen.push(text);
  });
  return kept;
}

function summaryText(value) {
  const text = cleanPresentationText(value);
  if (!text) return '';
  const stop = text.search(/\bThe most important runtime path is\b/i);
  return stop > 80 ? text.slice(0, stop).trim() : text;
}

function interfaceCount(d) {
  const seen = new Set();
  ['apis', 'routes', 'externally_accessible_interfaces'].forEach((field) => {
    asArray(d[field]).forEach((item) => {
      const value = item && typeof item === 'object'
        ? item.path_or_interface || item.path || item.route || item.interface || item.endpoint || item.url || item.name || labelOf(item)
        : item;
      const key = cleanPresentationText(value).toLowerCase().replace(/`/g, '').replace(/\/+$/, '');
      if (key) seen.add(key);
    });
  });
  return seen.size;
}

function runtimeSignalCount(d) {
  return Math.max(count(d.entry_points), count(d.startup_flow), count(d.runtime_processes));
}

function SummaryNarrative({ d }) {
  const fields = [
    ['purpose', 'Purpose'],
    ['business_functionality', 'Business functionality'],
    ['repository_scope', 'Repository scope'],
  ].filter(([key]) => !isEmpty(d[key]));
  const executive = summaryText(d.executive_summary);

  return (
    <div className="ri-summary">
      {fields.map(([key, label]) => (
        <Field key={key} label={label} value={d[key]} />
      ))}
      {executive && <Field label="Executive summary" value={executive} />}
    </div>
  );
}

function StartupTimeline({ items }) {
  const rows = asArray(items);
  if (!rows.length) return null;
  return (
    <div className="runtime-timeline">
      {rows.map((row, index) => {
        const description = row?.description || row?.summary || row?.detail || textOf(row);
        return (
          <article className="runtime-step" key={`${description}-${index}`}>
            <span className="runtime-step__index">{row?.step || row?.order || index + 1}</span>
            <div>
              <p>{cleanPresentationText(description)}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TechnologyStack({ view }) {
  return (
    <>
      {view.rows.length > 0 && <DataTable items={view.rows} columns={TECH_COLS} />}
      {!isEmpty(view.additionalDependencyNotes) && (
        <Field label="Additional dependency notes" value={view.additionalDependencyNotes} />
      )}
    </>
  );
}

function AssumptionsTable({ d }) {
  const rows = [
    ...asArray(d.assumptions).map((row) => ({ ...(row && typeof row === 'object' ? row : { item: row }), type: 'Assumption' })),
    ...asArray(d.unknowns).map((row) => ({ ...(row && typeof row === 'object' ? row : { item: row }), type: 'Unknown' })),
  ];
  if (!rows.length) return null;
  return <DataTable items={rows} columns={[
    { label: 'Type', keys: ['type'] },
    { label: 'Item', keys: ['item', 'name', 'title'] },
    { label: 'Reason', keys: ['reason', 'description'] },
    { label: 'Status', keys: ['status'] },
  ]} />;
}

function RuntimeOperations({ d, runtimeNotes }) {
  const startupTexts = asArray(d.startup_flow).map(textOf);
  const entryPoints = uniqueAgainst(d.entry_points, startupTexts);
  const processTexts = [...startupTexts, ...entryPoints.map(textOf)];
  const runtimeProcesses = uniqueAgainst([...asArray(runtimeNotes), ...asArray(d.runtime_processes)], processTexts);
  const serviceTexts = [...processTexts, ...runtimeProcesses.map(textOf)];
  const services = uniqueAgainst(d.services, serviceTexts);
  const jobTexts = [...serviceTexts, ...services.map(textOf)];
  const scheduledJobs = uniqueAgainst(d.scheduled_jobs, jobTexts);
  return (
    <>
      <StartupTimeline items={d.startup_flow} />
      <Field label="Entry points" value={entryPoints} />
      <Field label="Runtime processes" value={runtimeProcesses} />
      <Field label="Services" value={services} />
      <Field label="Scheduled jobs" value={scheduledJobs} />
    </>
  );
}

export default function RepositoryIntelligence() {
  const { data, loading, error } = useApi(api.repositoryIntelligence);
  const d = data?.data || {};
  const technologyView = buildTechnologyView(d);
  const interfaces = interfaceCount(d);

  const sections = [
    { id: 'overview', title: 'Application summary',
      render: () => (
        <>
          <Stats items={[
            { label: 'Languages', value: count(d.languages) },
            { label: 'Frameworks', value: count(d.frameworks) },
            { label: 'Runtime signals', value: runtimeSignalCount(d) },
            { label: 'Interfaces', value: interfaces },
          ]} />
          <SummaryNarrative d={d} />
        </>
      ) },
    { id: 'workflows', title: 'Application workflows', hint: 'Feature-level workflows found in the repository.',
      fields: ['primary_workflows'] },
    { id: 'stack', title: 'Technology stack', hint: 'Languages, frameworks, libraries, runtimes and dependency signals merged into one inventory.',
      isVisible: () => technologyView.rows.length > 0 || !isEmpty(technologyView.additionalDependencyNotes),
      render: () => <TechnologyStack view={technologyView} /> },
    { id: 'runtime', title: 'Startup and runtime flow', hint: 'How the application initializes and where runtime behavior begins.',
      isVisible: () => !isEmpty(d.entry_points) || !isEmpty(d.startup_flow) || !isEmpty(d.runtime_processes) || !isEmpty(d.services) || !isEmpty(d.scheduled_jobs) || !isEmpty(technologyView.additionalRuntimeNotes),
      render: () => <RuntimeOperations d={d} runtimeNotes={technologyView.additionalRuntimeNotes} /> },
    { id: 'reasoning', title: 'Review notes', fields: ['reasoning', 'analysis_reasoning'] },
    { id: 'unknowns', title: 'Assumptions & unknowns',
      isVisible: () => !isEmpty(d.assumptions) || !isEmpty(d.unknowns),
      render: () => <AssumptionsTable d={d} /> },
  ];

  return (
    <PageShell
      eyebrow="Codebase review"
      title="Repository intelligence"
      description="What the application does, how it is built, and where security review should start."
      state={{ loading, error, hasData: !!data?.has_data }}
      emptyTitle="No codebase overview yet"
      emptyText="Run the codebase overview stage in Codex Security, then upload its output files. This page shows what will appear."
      sections={sections}
      sectionData={d}
      showHeader={false}
    >
      <Sections d={d} sections={sections} />
    </PageShell>
  );
}
