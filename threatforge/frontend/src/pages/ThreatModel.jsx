import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { Disclosure, Field, PageShell, Sections, Stats } from '../components/Blocks.jsx';
import DataTable from '../components/DataTable.jsx';
import { Val } from '../components/Val.jsx';
import { Diagrams } from '../components/Mermaid.jsx';
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
    ? first(item, ['name', 'title', 'scenario', 'id', 'description']) || labelOf(item)
    : item
) || fallback;

const textOf = (item, keys = ['description', 'summary', 'whyItMatters', 'why_it_matters', 'basis']) => cleanPresentationText(
  item && typeof item === 'object' ? first(item, keys) || labelOf(item) : item
);

const isRelationshipRecord = (item) => {
  if (!item || typeof item !== 'object') return false;
  const id = String(item.relationship_id || item.relationshipId || item.threat_id || item.id || '').toUpperCase();
  return Boolean(
    item.relationship_type ||
    item.relationshipType ||
    item.source_threat_id ||
    item.sourceThreat ||
    item.target_threat_id ||
    item.targetThreat ||
    id.startsWith('TR')
  );
};

function MiniChips({ label, value, tone = '' }) {
  const items = asArray(value).map(labelOf).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className={`tm-chip-row ${tone}`}>
      <span>{label}</span>
      <div className="chips">
        {items.slice(0, 8).map((item) => <span className="chip" key={item}>{item}</span>)}
        {items.length > 8 && <span className="chip">+{items.length - 8} more</span>}
      </div>
    </div>
  );
}

function InlineDetails({ title, children, count, className = '' }) {
  if (isEmpty(children)) return null;
  return (
    <details className={`tm-inline-details ${className}`}>
      <summary>
        <span>{title}</span>
        {count > 0 && <em>{count}</em>}
      </summary>
      <div>{children}</div>
    </details>
  );
}

function AssetRows({ items }) {
  const rows = asArray(items);
  if (!rows.length) return <p className="muted">No assets mapped in this section.</p>;
  return (
    <div className="tm-asset-story-list">
      {rows.map((asset, index) => {
        const objectives = first(asset, ['securityObjectives', 'security_objectives', 'objectives']);
        const evidence = asset?.evidence || asset?.source_references || asset?.basis;
        const reason = textOf(asset, ['description', 'whyItMatters', 'why_it_matters']);
        return (
          <article className="tm-asset-story" key={`${titleOf(asset)}-${index}`}>
            <div className="tm-asset-story__meta">
              {asset?.id && <code>{asset.id}</code>}
            </div>
            <h3>{titleOf(asset, `Asset ${index + 1}`)}</h3>
            {reason && <p>{reason}</p>}
            {(!isEmpty(objectives) || !isEmpty(evidence)) && (
              <div className="tm-asset-story__support">
                {!isEmpty(objectives) && (
                  <div className="tm-asset-story__objectives">
                    {asArray(objectives).map((objective) => <span className="chip" key={labelOf(objective)}>{labelOf(objective)}</span>)}
                  </div>
                )}
                {!isEmpty(evidence) && (
                  <InlineDetails title="Evidence" count={asArray(evidence).length} className="tm-inline-details--evidence">
                    <MiniChips label="Source references" value={evidence} tone="tm-chip-row--evidence" />
                  </InlineDetails>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function SecurityObjectiveTable({ items }) {
  const rows = asArray(items);
  if (!rows.length) return <p className="muted">No security objectives mapped.</p>;
  return (
    <DataTable
      items={rows}
      columns={[
        { label: 'Objective', keys: ['id', 'name', 'title'] },
        { label: 'Description', keys: ['description', 'summary'] },
      ]}
    />
  );
}

function BoundaryTable({ items }) {
  const rows = asArray(items);
  const [open, setOpen] = useState(null);
  if (!rows.length) return <p className="muted">No trust boundaries mapped.</p>;
  return (
    <div className="tm-boundary-table">
      <div className="tm-boundary-table__head">
        <span />
        <span>Boundary</span>
        <span>Description</span>
        <span>Transferred data</span>
        <span>Expected controls</span>
        <span>Observed gaps</span>
      </div>
      {rows.map((row, index) => {
        const evidence = row.evidence || row.source_references;
        const isOpen = open === index;
        return (
          <article className="tm-boundary-row" key={`${titleOf(row)}-${index}`}>
            <button type="button" className={isOpen ? 'expander is-open' : 'expander'} onClick={() => setOpen(isOpen ? null : index)} aria-label="Show boundary evidence">
              <ArrowRight size={14} />
            </button>
            <strong>{titleOf(row, `Boundary ${index + 1}`)}</strong>
            <p>{textOf(row, ['description'])}</p>
            <MiniChips label="Transferred data" value={first(row, ['transferredDataOrAuthority', 'transferred_data_or_authority'])} />
            <MiniChips label="Expected controls" value={first(row, ['expectedControls', 'expected_controls'])} />
            <MiniChips label="Observed gaps" value={first(row, ['observedControlGaps', 'observed_control_gaps'])} />
            {isOpen && (
              <div className="tm-boundary-row__evidence">
                <MiniChips label="Evidence" value={evidence} tone="tm-chip-row--evidence" />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ThreatActorTable({ items }) {
  const rows = asArray(items);
  if (!rows.length) return <p className="muted">No threat actors mapped.</p>;
  return (
    <DataTable
      items={rows}
      columns={[
        {
          label: 'Actor',
          keys: ['name', 'id'],
          render: (row) => (
            <span className="tm-actor-cell">
              {row.id && <code>{row.id}</code>}
              <strong>{titleOf(row, 'Threat actor')}</strong>
            </span>
          ),
        },
        { label: 'Capabilities', keys: ['capabilities'] },
        { label: 'Absent privileges', keys: ['absentPrivileges', 'absent_privileges'] },
        { label: 'Entry points', keys: ['entryPoints', 'entry_points'] },
      ]}
    />
  );
}

function ItemCardGrid({ items, titleKeys, bodyKeys, detailRows, variant = '' }) {
  const rows = asArray(items);
  if (!rows.length) return <p className="muted">No records mapped in this section.</p>;
  return (
    <div className={`tm-card-grid ${variant ? `tm-card-grid--${variant}` : ''}`}>
      {rows.map((item, index) => {
        const detailBlocks = (detailRows || [])
          .map(([label, keys]) => ({ label, value: first(item, keys) }))
          .filter((row) => !isEmpty(row.value));
        const evidence = item?.evidence || item?.source_references || item?.basis;
        return (
          <article className="tm-info-card" key={`${titleOf(item)}-${index}`}>
            <header>
              {item?.id && <code>{item.id}</code>}
              <h3>{titleOf(item, `Item ${index + 1}`)}</h3>
            </header>
            {textOf(item, bodyKeys) && <p>{textOf(item, bodyKeys)}</p>}
            {detailBlocks.length > 0 && (
              <InlineDetails title="Mapped details" count={detailBlocks.length}>
                {detailBlocks.map((row) => <MiniChips key={row.label} label={row.label} value={row.value} />)}
              </InlineDetails>
            )}
            {!isEmpty(evidence) && (
              <InlineDetails title="Evidence" count={asArray(evidence).length}>
                <MiniChips label="Source references" value={evidence} tone="tm-chip-row--evidence" />
              </InlineDetails>
            )}
          </article>
        );
      })}
    </div>
  );
}

function pathOf(t) {
  const nodes = [
    ...asArray(t.entry_point).map(labelOf),
    ...asArray(t.attack_path).map(labelOf),
    ...asArray(t.affected_assets).map(labelOf),
  ].filter(Boolean);
  return nodes.filter((n, i) => n !== nodes[i - 1]);
}

function DetailRow({ label, value, valueKey }) {
  if (isEmpty(value)) return null;
  return (
    <div className="kv__row">
      <dt>{label}</dt>
      <dd><Val v={value} k={valueKey} /></dd>
    </div>
  );
}

function ThreatExplorer({ threats }) {
  if (!threats.length) return <p className="muted">No threats in this upload.</p>;
  return (
    <div className="threat-story-grid threat-story-grid--single">
      {threats.map((t, i) => {
        const path = pathOf(t);
        return (
          <details className="threat-card threat-card--details" key={`${t.threat_id || 'threat'}-${i}`}>
            <summary>
              <div className="threat-card__meta">
                {t.threat_id && <code>{t.threat_id}</code>}
                {t.actor && <span>{labelOf(t.actor)}</span>}
                {t.status && <span>{labelOf(t.status)}</span>}
              </div>
              <h3>{t.scenario || 'Threat scenario'}</h3>
              {t.impact && <p>{labelOf(t.impact)}</p>}
              {path.length > 0 && (
                <div className="threat-card__path">
                  {path.map((n, j, arr) => (
                    <span key={`${n}-${j}`}>
                      <span className="chip">{n}</span>
                      {j < arr.length - 1 && <ArrowRight size={13} aria-hidden="true" />}
                    </span>
                  ))}
                </div>
              )}
              <div className="threat-card__foot">
                {!isEmpty(t.affected_assets) && <span className="tag">Assets: {count(t.affected_assets)}</span>}
                {!isEmpty(t.security_gaps) && <span className="tag tag--warn">Gaps noted</span>}
                {!isEmpty(t.existing_controls) && <span className="tag tag--on">Controls mapped</span>}
              </div>
            </summary>
            <div className="threat-card__detail">
              <dl className="kv">
                <DetailRow label="Full attack path" value={path} />
                <DetailRow label="Affected assets" value={t.affected_assets} />
                <DetailRow label="Affected components" value={t.affected_components} />
                <DetailRow label="Trust boundaries crossed" value={t.trust_boundaries_crossed} />
                <DetailRow label="Preconditions" value={t.preconditions} />
                <DetailRow label="Existing controls" value={t.existing_controls} />
                <DetailRow label="Security gaps" value={t.security_gaps} />
                <DetailRow label="Plausibility rationale" value={t.plausibility_rationale || t.reasoning || t.threat_reasoning || t.analysis_reasoning} />
                <DetailRow label="Source references" value={t.source_references} valueKey="source_references" />
              </dl>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function RelationshipCards({ rels }) {
  if (!rels.length) return <p className="muted">No threat relationships in this upload.</p>;
  return (
    <div className="tm-relationship-grid">
      {rels.map((rel, index) => (
        <article className="tm-relationship-card" key={`${rel.relationship_id || index}`}>
          <header>
            <strong>{rel.source_threat_id || 'Source'} <ArrowRight size={14} /> {rel.target_threat_id || 'Target'}</strong>
            {rel.relationship_type && <span>{String(rel.relationship_type).replace(/_/g, ' ')}</span>}
          </header>
          {rel.description && (
            <div className="tm-relationship-card__reason">
              <span>Reason</span>
              <p>{rel.description}</p>
            </div>
          )}
          <MiniChips label="Shared elements" value={rel.shared_elements} />
          {rel.modeling_effect && <em>{rel.modeling_effect}</em>}
        </article>
      ))}
    </div>
  );
}

function AssumptionTable({ title, items }) {
  const rows = asArray(items);
  const [open, setOpen] = useState(null);
  if (!rows.length) return null;
  return (
    <section className="tm-assumption-group">
      <div className="tm-assumption-group__head">
        <span>{title}</span>
        <em>{rows.length}</em>
      </div>
      <div className="tm-assumption-table">
        <div className="tm-assumption-table__head">
          <span />
          <span>Item</span>
          <span>Description</span>
        </div>
        {rows.map((item, index) => {
          const evidence = item?.evidence || item?.source_references || item?.basis;
          const isOpen = open === index;
          return (
            <article className="tm-assumption-row" key={`${titleOf(item)}-${index}`}>
              <button type="button" className={isOpen ? 'expander is-open' : 'expander'} onClick={() => setOpen(isOpen ? null : index)} aria-label={`Show ${title.toLowerCase()} evidence`}>
                <ArrowRight size={14} />
              </button>
              <strong>
                <code>{item?.id || titleOf(item, `${title} ${index + 1}`)}</code>
                <span>{titleOf(item, `${title} ${index + 1}`)}</span>
              </strong>
              <p>{textOf(item, ['description', 'reason', 'summary'])}</p>
              {isOpen && !isEmpty(evidence) && (
                <div className="tm-assumption-row__evidence">
                  <MiniChips label="Source references" value={evidence} tone="tm-chip-row--evidence" />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AssumptionsUnknowns({ assumptions, unknowns }) {
  return (
    <div className="tm-assumptions">
      <AssumptionTable title="Assumptions" items={assumptions} />
      <AssumptionTable title="Unknowns" items={unknowns} />
    </div>
  );
}

function ThreatOverview({ d, threats, rels, hasCodebaseOverview }) {
  return (
    <div className="tm-overview">
      <Stats items={[
        { label: 'Assets', value: count(d.assets) },
        { label: 'Objectives', value: count(d.security_objectives) },
        { label: 'Sensitive data areas', value: count(d.sensitive_data) },
        ...(!hasCodebaseOverview ? [{ label: 'Entry points', value: count(d.security_sensitive_entry_points) }] : []),
        { label: 'Trust boundaries', value: count(d.trust_boundaries) },
        { label: 'Threat actors', value: count(d.threat_actors) },
        { label: 'Threat scenarios', value: threats.length },
        { label: 'Relationships', value: rels.length },
      ]} />
      <Field label="Application context" value={d.application_context} />
    </div>
  );
}

export default function ThreatModel() {
  const { data, loading, error } = useApi(api.threatModel);
  const { data: status } = useApi(api.status);
  const d = data?.threat_model || {};
  const threats = asArray(data?.threats).filter((threat) => !isRelationshipRecord(threat));
  const rels = data?.threat_relationships || [];
  const hasCodebaseOverview = (status?.stages || []).some((s) => s.key === 'repository-intelligence' && s.has_data);

  const sections = [
    { id: 'overview', title: 'Overview',
      render: () => <ThreatOverview d={d} threats={threats} rels={rels} hasCodebaseOverview={hasCodebaseOverview} /> },
    { id: 'assets', title: 'High-value assets',
      render: () => (
        <>
          <AssetRows items={d.assets} />
          <Field label="Sensitive data areas" value={d.sensitive_data} />
          {!isEmpty(d.reasoning || d.analysis_reasoning) && (
            <Disclosure title="Reasoning">
              <Field label="Reasoning" value={d.reasoning || d.analysis_reasoning} />
            </Disclosure>
          )}
        </>
      ) },
    { id: 'objectives', title: 'Security objectives', isVisible: () => !isEmpty(d.security_objectives),
      render: () => <SecurityObjectiveTable items={d.security_objectives} /> },
    { id: 'business', title: 'Critical business functions', fields: ['critical_business_functions', 'privileged_operations'] },
    ...(!hasCodebaseOverview ? [{ id: 'entry', title: 'Security-sensitive entry points', fields: ['security_sensitive_entry_points'] }] : []),
    { id: 'boundaries', title: 'Boundaries and access',
      render: () => (
        <BoundaryTable items={d.trust_boundaries} />
      ) },
    { id: 'actors', title: 'Threat actors',
      render: () => (
        <>
          <ThreatActorTable items={d.threat_actors} />
          <Field label="Attacker capabilities" value={d.attacker_capabilities} />
        </>
      ) },
    { id: 'threats', title: 'Threat scenarios', hint: 'What can go wrong, who can trigger it, and what may be affected.',
      isVisible: () => threats.length > 0,
      render: () => <ThreatExplorer threats={threats} /> },
    { id: 'relationships', title: 'Threat relationships', isVisible: () => rels.length > 0,
      render: () => <RelationshipCards rels={rels} /> },
    { id: 'weaknesses', title: 'Architectural weaknesses', fields: ['architectural_weaknesses'] },
    { id: 'diagrams', title: 'Threat model diagrams', isVisible: () => !isEmpty(d.diagrams), render: () => <Diagrams items={d.diagrams} /> },
    { id: 'unknowns', title: 'Assumptions & unknowns',
      isVisible: () => !isEmpty(d.assumptions) || !isEmpty(d.unknowns),
      render: () => <AssumptionsUnknowns assumptions={d.assumptions} unknowns={d.unknowns} /> },
  ];

  return (
    <PageShell
      eyebrow="Architecture & threat modeling"
      title="Security context"
      description="Assets, trust boundaries, actors, threats and attack paths."
      state={{ loading, error, hasData: !!data?.has_data }}
      emptyTitle="No threat model yet"
      emptyText="Run the Architecture & Threat Modeling stage in Codex Security, then upload its output. This page shows what will appear."
      sections={sections}
      sectionData={d}
      showHeader={false}
    >
      <Sections d={d} sections={sections} />
    </PageShell>
  );
}
