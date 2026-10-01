import { ArrowRight } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { Disclosure, PageShell, Sections, Stats, EvidenceBlock } from '../components/Blocks.jsx';
import DataTable from '../components/DataTable.jsx';
import { Val } from '../components/Val.jsx';
import { Diagrams } from '../components/Mermaid.jsx';
import { COLS } from '../lib/columns.js';
import { asArray, count, isEmpty, labelOf } from '../lib/format.js';

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
                <DetailRow label="Reasoning" value={t.reasoning || t.threat_reasoning || t.analysis_reasoning} />
                <DetailRow label="Source references" value={t.source_references} valueKey="source_references" />
              </dl>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export default function ThreatModel() {
  const { data, loading, error } = useApi(api.threatModel);
  const { data: status } = useApi(api.status);
  const d = data?.threat_model || {};
  const threats = data?.threats || [];
  const rels = data?.threat_relationships || [];
  const hasCodebaseOverview = (status?.stages || []).some((s) => s.key === 'repository-intelligence' && s.has_data);

  const sections = [
    { id: 'overview', title: 'Overview', hint: 'Counts come only from the uploaded data.',
      render: () => (
        <Stats items={[
          { label: 'Assets', value: count(d.assets) },
          { label: 'Sensitive data areas', value: count(d.sensitive_data) },
          ...(!hasCodebaseOverview ? [{ label: 'Entry points', value: count(d.security_sensitive_entry_points) }] : []),
          { label: 'Trust boundaries', value: count(d.trust_boundaries) },
          { label: 'Threat actors', value: count(d.threat_actors) },
          { label: 'Threats', value: threats.length },
        ]} />
      ) },
    { id: 'assets', title: 'High-value assets', fields: ['assets', 'sensitive_data', 'reasoning', 'analysis_reasoning'] },
    { id: 'business', title: 'Critical business functions', fields: ['critical_business_functions', 'privileged_operations'] },
    ...(!hasCodebaseOverview ? [{ id: 'entry', title: 'Security-sensitive entry points', fields: ['security_sensitive_entry_points'] }] : []),
    { id: 'boundaries', title: 'Boundaries and access', fields: ['trust_boundaries', 'internal_external_trust_relationships', 'authentication_authorization_boundaries'] },
    { id: 'actors', title: 'Threat actors', fields: ['threat_actors', 'attacker_capabilities'] },
    { id: 'threats', title: 'Threat scenarios', hint: 'What can go wrong, who can trigger it, and what may be affected.',
      isVisible: () => threats.length > 0,
      render: () => (
        <>
          <ThreatExplorer threats={threats} />
          <Disclosure title="Open complete extracted threat table" meta={`${threats.length} record${threats.length === 1 ? '' : 's'}`}>
            <DataTable items={threats} columns={COLS.threats} />
          </Disclosure>
        </>
      ) },
    { id: 'relationships', title: 'Threat relationships', isVisible: () => rels.length > 0, render: () => <DataTable items={rels} columns={COLS.threat_relationships} /> },
    { id: 'weaknesses', title: 'Architectural weaknesses', fields: ['architectural_weaknesses'] },
    { id: 'diagrams', title: 'Threat model diagrams', isVisible: () => !isEmpty(d.diagrams), render: () => <Diagrams items={d.diagrams} /> },
    { id: 'evidence', title: 'Evidence', isVisible: () => !isEmpty(d.source_references), render: () => <EvidenceBlock refs={d.source_references} /> },
    { id: 'unknowns', title: 'Assumptions & unknowns', fields: ['assumptions', 'unknowns'] },
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
    >
      <Sections d={d} sections={sections} />
    </PageShell>
  );
}
