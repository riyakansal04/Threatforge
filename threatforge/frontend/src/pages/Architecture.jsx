import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { FieldList, PageShell, Sections, Stats } from '../components/Blocks.jsx';
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
      addUnique(row.method, item.method);
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

export default function Architecture() {
  const { data, loading, error } = useApi(api.repositoryIntelligence);
  const d = data?.data || {};
  const interfaces = interfaceCatalog(d);

  const sections = [
    { id: 'overview', title: 'Architecture at a glance', hint: 'The structural map of the selected codebase.',
      render: () => (
        <>
          <Stats items={[
            { label: 'Components', value: count(d.components) },
            { label: 'Interfaces', value: interfaces.length },
            { label: 'Execution flows', value: count(d.execution_flows) },
            { label: 'Data stores', value: count(d.data_stores) },
            { label: 'Integrations', value: count(d.integrations) + count(d.external_services) },
          ]} />
          <FieldList d={d} fields={['architecture_summary', 'architecture_layers', 'architecture_reference']} />
        </>
      ) },
    { id: 'diagram', title: 'Architecture diagram', hint: 'Mermaid diagrams found in the uploaded files, rendered visually.',
      isVisible: () => !isEmpty(d.diagrams),
      render: () => <Diagrams items={d.diagrams} /> },
    { id: 'components', title: 'Component map', fields: ['components', 'component_relationships'] },
    { id: 'interfaces', title: 'Interfaces', hint: 'APIs, routes, controllers and exposed interfaces consolidated into one catalog.',
      isVisible: () => interfaces.length > 0,
      render: () => <DataTable items={interfaces} columns={INTERFACE_COLS} /> },
    { id: 'runtime', title: 'Runtime and execution flows', fields: ['startup_flow', 'runtime_processes', 'execution_flows'] },
    { id: 'data', title: 'Data architecture', fields: ['data_stores', 'data_models', 'data_flows'] },
    { id: 'integrations', title: 'Integrations', fields: ['external_services', 'integrations', 'webhooks'] },
    { id: 'access', title: 'Access mechanisms', fields: ['authentication', 'authorization'] },
    { id: 'delivery', title: 'Delivery and configuration', hint: 'Secret values are never displayed.', fields: ['configuration', 'build_structure', 'test_structure', 'ci_cd_structure'] },
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
    >
      <Sections d={d} sections={sections} />
    </PageShell>
  );
}
