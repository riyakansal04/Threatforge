import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { PageShell, Sections, Stats } from '../components/Blocks.jsx';
import DataTable from '../components/DataTable.jsx';
import { COLS } from '../lib/columns.js';
import { asArray, cleanPresentationText, count, labelOf } from '../lib/format.js';

function signature(value) {
  return cleanPresentationText(labelOf(value) || value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueItems(items, seen) {
  return asArray(items).filter((item) => {
    const key = signature(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowsFor(label, items, seen) {
  return uniqueItems(items, seen).map((item) => ({ area: label, item }));
}

function PlanningTable({ d }) {
  const seen = new Set();
  const rows = [
    ...rowsFor('Security-critical component', d.security_critical_components, seen),
    ...rowsFor('Privileged operation', d.privileged_operations, seen),
    ...rowsFor('High-impact operation', d.high_impact_business_operations, seen),
    ...rowsFor('Threat-linked component', d.threat_path_components, seen),
    ...rowsFor('Security-critical dependency', d.security_critical_dependencies, seen),
  ];
  return <DataTable items={rows} columns={[{ label: 'Planning area', keys: ['area'] }, { label: 'What needs attention', keys: ['item'] }]} />;
}

function openQuestionRows(d) {
  const rows = new Map();
  const add = (source, items) => {
    asArray(items).forEach((item) => {
      const key = signature(item);
      if (!key) return;
      if (!rows.has(key)) rows.set(key, { question: item, source: [] });
      const row = rows.get(key);
      if (!row.source.includes(source)) row.source.push(source);
    });
  };
  add('Limited visibility', d.limited_visibility_areas);
  add('Unresolved behavior', d.unresolved_behavior);
  return [...rows.values()].map((row) => ({ ...row, source: row.source.join(', ') }));
}

function OpenQuestionsTable({ d }) {
  return (
    <DataTable
      items={openQuestionRows(d)}
      columns={[{ label: 'Open question', keys: ['question'] }, { label: 'Why it matters', keys: ['source'] }]}
    />
  );
}

export default function SecurityReviewPlan() {
  const baseline = useApi(api.securityBaseline);
  const plan = useApi(api.scanPlanning);
  const d = baseline.data?.security_baseline || {};
  const focus = plan.data?.scan_focus || baseline.data?.scan_focus || [];
  const conv = plan.data?.threat_convergence || baseline.data?.threat_convergence || [];
  const loading = baseline.loading || plan.loading;
  const error = baseline.error || plan.error;
  const hasData = !!baseline.data?.has_data || !!plan.data?.has_data;
  const byType = {};
  focus.forEach((item) => { const key = item.scan_type || 'Unspecified'; byType[key] = (byType[key] || 0) + 1; });

  const planningCount =
    count(d.security_critical_components) +
    count(d.privileged_operations) +
    count(d.high_impact_business_operations) +
    count(d.threat_path_components) +
    count(d.security_critical_dependencies);
  const openQuestionCount = openQuestionRows(d).length;

  const sections = [
    { id: 'overview', title: 'Plan summary', hint: 'Planning-only information. Architecture, APIs, routes, authentication and entry points stay on their own pages.',
      isVisible: () => hasData,
      render: () => (
        <Stats items={[
          { label: 'Review priorities', value: planningCount },
          { label: 'Recommended scans', value: focus.length },
          { label: 'Convergence points', value: conv.length },
          { label: 'Open questions', value: openQuestionCount },
          ...Object.entries(byType).map(([label, value]) => ({ label, value })),
        ]} />
      ) },
    { id: 'priorities', title: 'Review priorities', hint: 'The surfaces that deserve attention next, without repeating the architecture inventory.',
      isVisible: () => planningCount > 0,
      render: () => <PlanningTable d={d} /> },
    { id: 'unknowns', title: 'Open questions and limited visibility',
      isVisible: () => openQuestionCount > 0,
      render: () => <OpenQuestionsTable d={d} /> },
    { id: 'scan-targets', title: 'Recommended scan targets', hint: 'Targets, security context, threat context and rationale.',
      isVisible: () => focus.length > 0,
      render: () => <DataTable items={focus} columns={COLS.scan_focus} /> },
    { id: 'convergence', title: 'Threat convergence', hint: 'Where multiple threat paths point to the same review target.',
      isVisible: () => conv.length > 0,
      render: () => <DataTable items={conv} columns={COLS.threat_convergence} /> },
  ];

  return (
    <PageShell
      eyebrow="Security planning"
      title="Security assessment"
      description="What should be reviewed next, why it matters, and which scans target it."
      state={{ loading, error, hasData }}
      emptyTitle="No assessment roadmap yet"
      emptyText="Run the Security Baseline & Scan Planning stage in Codex Security, then upload its output."
      sections={sections}
      sectionData={{}}
    >
      <Sections d={{}} sections={sections} />
    </PageShell>
  );
}
