import { ArrowRight } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { PageShell, Sections, Stats } from '../components/Blocks.jsx';
import DataTable from '../components/DataTable.jsx';
import { Diagrams } from '../components/Mermaid.jsx';
import { Val } from '../components/Val.jsx';
import { COLS } from '../lib/columns.js';
import { asArray, cleanPresentationText, count, isEmpty, labelOf } from '../lib/format.js';

const first = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    if (!isEmpty(obj[key])) return obj[key];
  }
  return '';
};

const titleOf = (item, fallback = 'Item') => cleanPresentationText(
  item && typeof item === 'object'
    ? first(item, ['name', 'title', 'capability', 'question', 'id', 'description']) || labelOf(item)
    : item
) || fallback;

const textOf = (item, keys = ['description', 'summary', 'reason', 'whySelected', 'why_selected', 'whyUncovered', 'why_uncovered']) =>
  cleanPresentationText(item && typeof item === 'object' ? first(item, keys) || labelOf(item) : item);

function MiniChips({ label, value }) {
  const items = asArray(value).map(labelOf).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="sa-chip-row">
      <span>{label}</span>
      <div className="chips">
        {items.slice(0, 10).map((item) => <span className="chip" key={item}>{item}</span>)}
        {items.length > 10 && <span className="chip">+{items.length - 10} more</span>}
      </div>
    </div>
  );
}

function InlineDetails({ title, value }) {
  if (isEmpty(value)) return null;
  return (
    <details className="sa-inline-details">
      <summary>{title}<em>{count(value)}</em></summary>
      <Val v={value} />
    </details>
  );
}

function ScanDetails({ item }) {
  const groups = [
    ['Included scope', item.scope_included],
    ['Excluded scope', item.scope_excluded],
    ['Prerequisites', item.required_prerequisites],
    ['Limitations', item.limitations],
  ].filter(([, value]) => !isEmpty(value));
  if (!groups.length) return null;
  const total = groups.reduce((sum, [, value]) => sum + count(value), 0);
  return (
    <details className="sa-inline-details sa-inline-details--scan">
      <summary>Details<em>{total}</em></summary>
      <div className="sa-scan-detail-grid">
        {groups.map(([label, value]) => (
          <div className="sa-scan-detail-group" key={label}>
            <span>{label}</span>
            <Val v={value} />
          </div>
        ))}
      </div>
    </details>
  );
}

function PlanSummary({ d, focus, conv }) {
  return (
    <div className="sa-summary">
      <Stats items={[
        { label: 'Selected capabilities', value: count(d.selected_capabilities) },
        { label: 'Assessment objectives', value: count(d.assessment_objectives) },
        { label: 'Scan targets', value: focus.length },
        { label: 'Coverage gaps', value: count(d.coverage_gaps) },
        { label: 'Dependencies', value: count(d.dependencies) },
        { label: 'Convergence points', value: conv.length },
      ]} />
      <div className="sa-summary-grid">
        <article className="sa-summary-note">
          <span>Planning goal</span>
          <p>{d.planning_goal}</p>
        </article>
        <article className="sa-summary-note">
          <span>Priority rationale</span>
          <p>{d.overall_priority_rationale}</p>
        </article>
      </div>
    </div>
  );
}

function CapabilityCards({ selected, deferred }) {
  const rows = [
    ...asArray(selected).map((item) => ({ ...item, _state: 'Selected' })),
    ...asArray(deferred).map((item) => ({ ...item, _state: 'Deferred' })),
  ];
  if (!rows.length) return <p className="muted">No assessment capabilities mapped.</p>;
  return (
    <div className="sa-capability-list">
      {rows.map((item, index) => (
        <article className={`sa-capability-row ${item._state === 'Selected' ? 'is-selected' : 'is-deferred'}`} key={`${titleOf(item)}-${index}`}>
          <div className="sa-capability-row__title">
            <span>{item._state}</span>
            <h3>{titleOf(item, `Capability ${index + 1}`)}</h3>
          </div>
          <p>{textOf(item, ['whySelected', 'why_selected', 'reason', 'description'])}</p>
          <div className="sa-capability-row__details">
            <MiniChips label="Primary questions" value={first(item, ['primaryQuestions', 'primary_questions'])} />
            <MiniChips label="Related threats" value={first(item, ['relatedThreats', 'related_threats'])} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ObjectiveTable({ items }) {
  const rows = asArray(items);
  if (!rows.length) return <p className="muted">No assessment objectives mapped.</p>;
  return (
    <div className="sa-table sa-table--objectives">
      <div className="sa-table__head">
        <span>Objective</span>
        <span>Expected result</span>
        <span>Linked threats</span>
        <span>Capability</span>
      </div>
      {rows.map((row, index) => (
        <article className="sa-table__row" key={`${titleOf(row)}-${index}`}>
          <strong>
            {row.id && <code>{row.id}</code>}
            <span>{titleOf(row, `Objective ${index + 1}`)}</span>
          </strong>
          <p>{textOf(row, ['expectedToEstablish', 'expected_to_establish', 'description'])}</p>
          <MiniChips label="Threats" value={first(row, ['linkedThreats', 'linked_threats'])} />
          <span className="sa-muted-pill">{labelOf(first(row, ['recommendedCapability', 'recommended_capability']))}</span>
        </article>
      ))}
    </div>
  );
}

function ScanTargetCards({ items }) {
  const rows = asArray(items);
  if (!rows.length) return <p className="muted">No scan targets mapped.</p>;
  return (
    <div className="sa-scan-list">
      {rows.map((item, index) => (
        <article className="sa-scan-card" key={`${item.scan_id || titleOf(item)}-${index}`}>
          <header>
            <div>
              {item.scan_id && <code>{item.scan_id}</code>}
              <h3>{titleOf(item, `Scan target ${index + 1}`)}</h3>
            </div>
            <span>{labelOf(item.scan_type || 'Scan')}</span>
          </header>
          <p>{textOf(item, ['assessment_objective', 'reason', 'why_this_scope'])}</p>
          <div className="sa-scan-card__target">
            <span>Target</span>
            <strong>{labelOf(item.target)}</strong>
          </div>
          <div className="sa-scan-card__meta">
            <MiniChips label="Related threats" value={item.related_threats || item.threat_context} />
            <MiniChips label="Expected coverage" value={item.expected_coverage} />
          </div>
          <div className="sa-scan-card__details">
            <ScanDetails item={item} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ExecutionPlan({ order, dependencies }) {
  const deps = asArray(dependencies);
  return (
    <div className="sa-execution">
      <MiniChips label="Recommended order" value={order} />
      {deps.length > 0 && (
        <div className="sa-dependency-list">
          {deps.map((dep, index) => (
            <article className="sa-dependency-row" key={`${titleOf(dep)}-${index}`}>
              <strong>{dep.id || `Dependency ${index + 1}`}</strong>
              <p>{textOf(dep, ['description', 'reason'])}</p>
              <div>
                <span>{labelOf(dep.from || 'Input')}</span>
                <ArrowRight size={14} />
                <Val v={dep.to} compact />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverageGapsTable({ items }) {
  const rows = asArray(items);
  if (!rows.length) return <p className="muted">No coverage gaps mapped.</p>;
  return (
    <div className="sa-table sa-table--gaps">
      <div className="sa-table__head">
        <span>Question</span>
        <span>Why uncovered</span>
        <span>Needed input</span>
      </div>
      {rows.map((row, index) => (
        <article className="sa-table__row" key={`${titleOf(row)}-${index}`}>
          <strong>
            {row.id && <code>{row.id}</code>}
            <span>{titleOf(row, `Gap ${index + 1}`)}</span>
          </strong>
          <p>{textOf(row, ['whyUncovered', 'why_uncovered', 'description'])}</p>
          <p>{textOf(row, ['neededInput', 'needed_input'])}</p>
        </article>
      ))}
    </div>
  );
}

function AssumptionTable({ items }) {
  const rows = asArray(items);
  if (!rows.length) return <p className="muted">No planning assumptions mapped.</p>;
  return (
    <div className="sa-table sa-table--assumptions">
      <div className="sa-table__head">
        <span>Assumption</span>
      </div>
      {rows.map((row, index) => (
        <article className="sa-table__row" key={`${labelOf(row)}-${index}`}>
          <p>{labelOf(row)}</p>
        </article>
      ))}
    </div>
  );
}

export default function SecurityReviewPlan() {
  const baseline = useApi(api.securityBaseline);
  const plan = useApi(api.scanPlanning);
  const d = baseline.data?.security_baseline || {};
  const focus = asArray(plan.data?.scan_focus || baseline.data?.scan_focus);
  const conv = asArray(plan.data?.threat_convergence || baseline.data?.threat_convergence);
  const loading = baseline.loading || plan.loading;
  const error = baseline.error || plan.error;
  const hasData = !!baseline.data?.has_data || !!plan.data?.has_data;

  const sections = [
    { id: 'overview', title: 'Plan summary',
      isVisible: () => hasData,
      render: () => <PlanSummary d={d} focus={focus} conv={conv} /> },
    { id: 'capabilities', title: 'Scan capabilities',
      isVisible: () => !isEmpty(d.selected_capabilities) || !isEmpty(d.not_selected_capabilities),
      render: () => <CapabilityCards selected={d.selected_capabilities} deferred={d.not_selected_capabilities} /> },
    { id: 'objectives', title: 'Assessment objectives',
      isVisible: () => !isEmpty(d.assessment_objectives),
      render: () => <ObjectiveTable items={d.assessment_objectives} /> },
    { id: 'scan-targets', title: 'Recommended scan targets',
      isVisible: () => focus.length > 0,
      render: () => <ScanTargetCards items={focus} /> },
    { id: 'execution', title: 'Execution order',
      isVisible: () => !isEmpty(d.execution_order) || !isEmpty(d.dependencies),
      render: () => <ExecutionPlan order={d.execution_order} dependencies={d.dependencies} /> },
    { id: 'diagrams', title: 'Assessment flow diagram',
      isVisible: () => !isEmpty(d.diagrams),
      render: () => <Diagrams items={d.diagrams} /> },
    { id: 'gaps', title: 'Coverage gaps',
      isVisible: () => !isEmpty(d.coverage_gaps),
      render: () => <CoverageGapsTable items={d.coverage_gaps} /> },
    { id: 'assumptions', title: 'Assumptions',
      isVisible: () => !isEmpty(d.assumptions),
      render: () => <AssumptionTable items={d.assumptions} /> },
    { id: 'convergence', title: 'Threat convergence',
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
      showHeader={false}
    >
      <Sections d={{}} sections={sections} />
    </PageShell>
  );
}
