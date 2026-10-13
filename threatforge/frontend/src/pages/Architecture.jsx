import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { Field, FieldList, PageShell, Sections, Stats } from '../components/Blocks.jsx';
import DataTable from '../components/DataTable.jsx';
import { Diagrams } from '../components/Mermaid.jsx';
import { asArray, cleanPresentationText, count, isEmpty, labelOf, splitEvidence } from '../lib/format.js';

const INTERFACE_FIELDS = [
  ['apis', 'API'],
  ['routes', 'Route'],
  ['controllers', 'Controller'],
  ['handlers', 'Handler'],
  ['externally_accessible_interfaces', 'External interface'],
];

const INTERFACE_COLS = [
  { label: 'Interface', keys: ['path_or_interface', 'path', 'route', 'name', 'interface'] },
  { label: 'Method', keys: ['method'] },
  { label: 'Handler', keys: ['handler'] },
  { label: 'Component', keys: ['component', 'component_id'] },
  { label: 'Authentication', keys: ['authentication', 'auth'] },
  { label: 'Source', keys: ['sources', 'kind'] },
  { label: 'Evidence', keys: ['evidence'] },
];

const COMPONENT_COLS = [
  { label: 'Component', keys: ['name', 'title', 'component_id'] },
  { label: 'Type', keys: ['type', 'kind'] },
  { label: 'Responsibility', keys: ['responsibility', 'responsibilities', 'description'] },
  { label: 'Depends on', keys: ['dependencies', 'depends_on'] },
];

const SOURCE_REF_RE = /\b(?:[A-Za-z0-9_.@~+/-]+\.(?:py|js|jsx|ts|tsx|mjs|cjs|md|txt|json|yaml|yml|toml|xml|html|css|scss|sql|java|kt|go|rs|rb|php|cs|cpp|hpp|h|c|sh|ps1|bat|cfg|ini|conf|lock|gradle|properties|env)(?::\d+(?:-\d+)?)?|Dockerfile(?::\d+(?:-\d+)?)?)\b/g;

function addUnique(list, value) {
  asArray(value).forEach((item) => {
    const text = cleanPresentationText(labelOf(item));
    if (text && text !== '-' && !list.some((existing) => existing.toLowerCase() === text.toLowerCase())) list.push(text);
  });
}

function refsOf(item) {
  const refs = [];
  if (typeof item === 'string') addUnique(refs, splitEvidence(item).refs);
  if (item && typeof item === 'object') {
    addUnique(refs, item.source_references);
    addUnique(refs, item.evidence_references);
    addUnique(refs, item.evidence);
    Object.entries(item).forEach(([key, value]) => {
      if (/evidence|reference/i.test(key) && typeof value === 'string') addUnique(refs, splitEvidence(value).refs);
    });
  }
  return refs;
}

function refsInText(value) {
  const text = cleanPresentationText(value);
  const refs = text.match(SOURCE_REF_RE) || [];
  return [...new Set(refs.map((ref) => cleanPresentationText(ref)))];
}

function relationshipSentences(value) {
  const text = cleanPresentationText(value);
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function readableRelationshipText(value) {
  return cleanPresentationText(value)
    .replace(/\s*\((?:[^)]*\b(?:py|js|jsx|ts|tsx|md|json|yaml|yml|txt|xml|sql|Dockerfile)(?::\d+(?:-\d+)?)?[^)]*)\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function relationshipTitle(sentence, fallback) {
  const text = readableRelationshipText(sentence);
  const match = text.match(/^(.{8,90}?)(?:\s+(?:creates|defines|starts|parses|support|supports|read|reads|references|uses|selects|connects|then|is|are)\b|:)/i);
  return cleanPresentationText(match?.[1] || '').replace(/[=,;]\s*$/, '') || fallback;
}

function relationshipCards(value) {
  return asArray(value).flatMap((item, index) => {
    if (item && typeof item === 'object') {
      const title = cleanPresentationText(
        item.relationship ||
        item.name ||
        [item.source || item.from, item.target || item.to].filter(Boolean).join(' -> ') ||
        `Relationship ${index + 1}`
      );
      const description = cleanPresentationText(item.description || item.summary || item.basis || title);
      const confidence = cleanPresentationText(item.confidence || item.status || item.basis);
      return [{
        title,
        description: description === title ? '' : description,
        confidence,
        refs: [...new Set([...refsOf(item), ...refsInText(description), ...refsInText(title)])],
      }];
    }
    return relationshipSentences(item).map((sentence, sentenceIndex) => {
      const cleaned = readableRelationshipText(sentence);
      return {
        title: relationshipTitle(sentence, `Relationship ${sentenceIndex + 1}`),
        description: cleaned,
        refs: refsInText(sentence),
      };
    });
  }).filter((card) => card.description || card.title);
}

function interfaceName(item) {
  const raw = item?.path_or_interface || item?.path || item?.route || item?.interface || item?.endpoint || item?.url || item?.name || labelOf(item);
  return cleanPresentationText(raw).replace(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i, '');
}

function interfaceKey(item) {
  return interfaceName(item).toLowerCase().replace(/\/+$/, '') || JSON.stringify(item).toLowerCase();
}

function interfaceCatalog(d) {
  const rows = new Map();
  INTERFACE_FIELDS.forEach(([key, kind]) => {
    asArray(d[key]).forEach((raw) => {
      const item = (
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? { ...raw, kind }
        : { name: String(raw), kind }
      );
      const id = interfaceKey(item);
      if (!rows.has(id)) {
        rows.set(id, {
          path_or_interface: interfaceName(item),
          method: [],
          handler: [],
          component: [],
          authentication: [],
          authorization: [],
          sources: [],
          evidence: [],
        });
      }
      const row = rows.get(id);
      addUnique(row.sources, kind);
      addUnique(row.method, item.method || item.methods);
      addUnique(row.handler, item.handler);
      addUnique(row.component, item.component || item.component_id);
      addUnique(row.authentication, item.authentication || item.auth);
      addUnique(row.authorization, item.authorization);
      addUnique(row.evidence, refsOf(item));
    });
  });
  return [...rows.values()].map((row) => Object.fromEntries(
    Object.entries(row).filter(([, value]) => !isEmpty(value))
  ));
}

function textOf(value) {
  if (typeof value === 'string') return cleanPresentationText(value);
  if (value && typeof value === 'object') {
    return cleanPresentationText(value.description || value.summary || value.relationship || value.basis || value.name || labelOf(value));
  }
  return cleanPresentationText(value);
}

function stripRefs(row) {
  if (!row || typeof row !== 'object') return row;
  const { source_references, evidence_references, evidence, ...rest } = row;
  return rest;
}

function RuntimeFlowView({ d }) {
  const startup = asArray(d.startup_flow);
  const flows = asArray(d.execution_flows)
    .map(stripRefs)
    .filter((flow) => textOf(flow));

  return (
    <div className="architecture-runtime">
      {!isEmpty(startup) && (
        <div className="architecture-flow-list">
          <h3 className="field__label">Startup flow <span className="count">{startup.length}</span></h3>
          {startup.map((step, index) => (
            <article className="architecture-flow-step" key={`${textOf(step)}-${index}`}>
              <span>{step?.step || index + 1}</span>
              <p>{textOf(step)}</p>
            </article>
          ))}
        </div>
      )}
      {!isEmpty(flows) && (
        <div className="architecture-flow-cards">
          <h3 className="field__label">Runtime relationships <span className="count">{flows.length}</span></h3>
          {flows.map((flow, index) => (
            <article className="architecture-flow-card" key={`${textOf(flow)}-${index}`}>
              <strong>{flow.confidence || flow.relationship || flow.name || `Flow ${index + 1}`}</strong>
              <p>{flow.description || flow.relationship || textOf(flow)}</p>
              {flow.basis && <em>{flow.basis}</em>}
            </article>
          ))}
        </div>
      )}
      <Field label="Runtime processes" value={d.runtime_processes} />
    </div>
  );
}

function ComponentMapView({ d }) {
  const relationships = relationshipCards(d.component_relationships);
  return (
    <div className="architecture-component-map">
      <DataTable items={d.components} columns={COMPONENT_COLS} />
      {!isEmpty(relationships) && (
        <div className="field">
          <h3 className="field__label">Component relationships <span className="count">{relationships.length}</span></h3>
          <div className="relationship-grid">
            {relationships.map((rel, index) => (
              <article className="relationship-card" key={`${rel.title}-${rel.description}-${index}`}>
                <div>
                  <strong>{rel.title}</strong>
                  {rel.description && <p>{rel.description}</p>}
                  {rel.confidence && <em>{rel.confidence}</em>}
                </div>
                {!isEmpty(rel.refs) && (
                  <div className="source-pills">
                    {rel.refs.map((ref) => <span className="source-pill" key={ref}>{ref}</span>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewGroup({ title, items }) {
  const visible = (items || []).filter((item) => !isEmpty(item.value));
  if (!visible.length) return null;
  return (
    <div className="architecture-overview-group">
      <h3 className="field__label">{title}</h3>
      <Stats items={visible} />
    </div>
  );
}

function ArchitectureOverview({ d, interfaces }) {
  const integrations = count(d.integrations) + count(d.external_services) + count(d.webhooks);
  return (
    <div className="architecture-overview">
      <OverviewGroup
        title="System shape"
        items={[
          { label: 'Components', value: count(d.components) },
          { label: 'Interfaces', value: interfaces.length },
          { label: 'Startup steps', value: count(d.startup_flow) },
          { label: 'Execution flows', value: count(d.execution_flows) },
          { label: 'Integrations', value: integrations },
        ]}
      />
      <OverviewGroup
        title="Data architecture"
        items={[
          { label: 'Data stores', value: count(d.data_stores) },
          { label: 'Data models', value: count(d.data_models) },
          { label: 'Data flows', value: count(d.data_flows) },
        ]}
      />
      <OverviewGroup
        title="Access mechanisms"
        items={[
          { label: 'Authentication', value: count(d.authentication) },
          { label: 'Authorization', value: count(d.authorization) },
        ]}
      />
      <FieldList d={d} fields={['architecture_summary', 'architecture_layers', 'architecture_reference']} />
    </div>
  );
}

export default function Architecture() {
  const { data, loading, error } = useApi(api.repositoryIntelligence);
  const d = data?.data || {};
  const interfaces = interfaceCatalog(d);

  const sections = [
    { id: 'overview', title: 'Architecture at a glance', hint: 'The structural map of the selected codebase.',
      render: () => <ArchitectureOverview d={d} interfaces={interfaces} /> },
    { id: 'diagram', title: 'Architecture diagram', hint: 'Mermaid diagrams found in the uploaded files, rendered visually.',
      isVisible: () => !isEmpty(d.diagrams),
      render: () => <Diagrams items={d.diagrams} /> },
    { id: 'components', title: 'Component map',
      isVisible: () => !isEmpty(d.components) || !isEmpty(d.component_relationships),
      render: () => <ComponentMapView d={d} /> },
    { id: 'interfaces', title: 'Interfaces', hint: 'APIs, routes, controllers and exposed interfaces consolidated into one catalog.',
      isVisible: () => interfaces.length > 0,
      render: () => <DataTable items={interfaces} columns={INTERFACE_COLS} /> },
    { id: 'runtime', title: 'Runtime and execution flows',
      isVisible: () => !isEmpty(d.startup_flow) || !isEmpty(d.runtime_processes) || !isEmpty(d.execution_flows),
      render: () => <RuntimeFlowView d={d} /> },
    { id: 'data', title: 'Data architecture', fields: ['data_stores', 'data_models', 'data_flows'] },
    { id: 'integrations', title: 'Integrations', fields: ['external_services', 'integrations', 'webhooks'] },
    { id: 'access', title: 'Access mechanisms', fields: ['authentication', 'authorization'] },
    { id: 'delivery', title: 'Delivery and configuration', fields: ['configuration', 'build_structure', 'test_structure', 'ci_cd_structure'] },
  ];

  return (
    <PageShell
      eyebrow="Codebase review"
      title="Architecture map"
      description="Components, relationships, execution flows and data flows."
      state={{ loading, error, hasData: !!data?.has_data }}
      emptyTitle="No architecture data yet"
      emptyText="This page is filled by the codebase overview stage. Run it, then upload its output."
      sections={sections}
      sectionData={d}
      showHeader={false}
    >
      <Sections d={d} sections={sections} />
    </PageShell>
  );
}
