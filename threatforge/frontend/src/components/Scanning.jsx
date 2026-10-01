import { isValidElement } from 'react';
import { Disclosure, Field, Modal } from './Blocks.jsx';
import { Val, Refs } from './Val.jsx';
import { cleanPresentationText, humanizeEnumValue, isEmpty, titleCase } from '../lib/format.js';
import { SCAN_LABELS, nameOf, sevClass, sevOf, str } from '../lib/scanning.js';

const DIST_COLORS = ['#37e4b2', '#38bdf8', '#f2b84b', '#ff7568', '#a78bfa', '#7dd3fc'];

function colorFor(label, index) {
  const sev = sevClass(label);
  if (sev === 'critical') return '#ff7568';
  if (sev === 'high') return '#f2924b';
  if (sev === 'medium') return '#f2b84b';
  if (sev === 'low') return '#7dd3fc';
  if (sev === 'info') return '#94a3b8';
  return DIST_COLORS[index % DIST_COLORS.length];
}

function donutGradient(items, total) {
  let cursor = 0;
  return items.map((item, index) => {
    const start = cursor;
    const size = total ? (item.count / total) * 100 : 0;
    cursor += size;
    return `${colorFor(item.label, index)} ${start}% ${cursor}%`;
  }).join(', ');
}

export function SevChip({ value }) {
  const s = String(value || '');
  if (!s) return <span className="muted">-</span>;
  return <span className={`sev sev--${sevClass(s)}`}>{humanizeEnumValue(s)}</span>;
}

export function Dist({ title, items, unit = 'items' }) {
  if (!items?.length) return null;
  const max = Math.max(...items.map((i) => i.count), 1);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const unitLabel = total === 1 ? unit.replace(/s$/, '') : unit;
  return (
    <article className={`dist-card ${items.length > 6 ? 'dist-card--wide' : ''}`}>
      <div className="dist-card__head">
        <h3>{title}</h3>
        <span>{total} {unitLabel}</span>
      </div>
      <div className="dist-card__viz">
        <div
          className="dist-donut"
          style={{ background: `conic-gradient(${donutGradient(items, total)})` }}
          aria-label={`${title} chart`}
        >
          <span>
            <strong>{total}</strong>
            <small>Total</small>
          </span>
        </div>
        <div className="bars" aria-label={`${title} distribution`}>
          {items.map((i, index) => (
            <div className="bar" key={i.label}>
              <span className="bar__dot" style={{ background: colorFor(i.label, index) }} />
              <span className="bar__label" title={humanizeEnumValue(i.label)}>{humanizeEnumValue(i.label)}</span>
              <span className="bar__track">
                <span className={`bar__fill bar__fill--${sevClass(i.label)}`} style={{ width: `${(i.count / max) * 100}%`, background: colorFor(i.label, index) }} />
              </span>
              <span className="bar__n">{i.count}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

/** cols: [{label, get(row)}] - columns without any value are hidden */
export function MiniTable({ cols, rows, onOpen }) {
  if (!rows.length) return null;
  const shown = cols.filter((c) => rows.some((r) => !isEmpty(c.get(r))));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{shown.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={onOpen ? 'clickable' : ''} onClick={() => onOpen && onOpen(r.f || r)}>
              {shown.map((c) => {
                const value = c.get(r);
                return <td key={c.label}>{isValidElement(value) ? value : <Val v={value} compact />}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FindingsTable({ items, onOpen, showScan = true }) {
  if (!items.length) return <p className="muted">No findings reported.</p>;
  return (
    <div className="finding-story-list">
      {items.map((f) => {
        const path = pathNodes(f.attack_path);
        const preview = path;
        const evidenceCount = (f.evidence_items || []).length || (f.source_references || []).length || (f.evidence ? 1 : 0);
        const title = cleanPresentationText(str(nameOf(f)) || 'Finding');
        const supportingText = cleanPresentationText(str(f.description) || str(f.impact) || str(f.root_cause));
        const category = str(f.category);
        const confidence = str(f.confidence);
        const cwe = str(f.cwe);
        const classification = str(f.classification);
        return (
          <button type="button" className="finding-story" key={f.id} onClick={() => onOpen(f)}>
            <span className="finding-story__rail" aria-hidden="true" />
            <span className="finding-story__main">
              <span className="finding-story__meta">
                <SevChip value={sevOf(f)} />
                {category && <span className="tag">{cleanPresentationText(category)}</span>}
                {confidence && <span className="chip">Confidence: {humanizeEnumValue(confidence)}</span>}
                {cwe && <span className="chip">{cleanPresentationText(cwe)}</span>}
                {showScan && <span className="chip">{SCAN_LABELS[f.scan_type] || f.scan_type || 'Scan report'}</span>}
              </span>
              <strong>{title}</strong>
              {supportingText && <span className="finding-story__summary">{supportingText}</span>}
              {preview.length > 0 && (
                <span className="finding-story__path" aria-label="Attack path preview">
                  {preview.map((node, index) => (
                    <span className="finding-story__step" key={`${node}-${index}`}>{node}</span>
                  ))}
                </span>
              )}
            </span>
            <span className="finding-story__aside">
              <span>
                <small>Affected area</small>
                <b><Val v={f.affected_area ?? f.affected_dependency} compact /></b>
              </span>
              <span>
                <small>Evidence</small>
                <b>{evidenceCount || '-'}</b>
              </span>
              {classification && (
                <span>
                  <small>Review signal</small>
                  <b>{humanizeEnumValue(classification)}</b>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const TRACE_ORDER = [
  'attacker_entry_point', 'attacker_controlled_input_or_action', 'application_flow', 'security_weakness',
  'authentication_authorization_boundary', 'trust_boundary', 'sensitive_asset', 'privileged_operation',
  'attack_conditions',
];

export function AttackTrace({ trace }) {
  const keys = [...TRACE_ORDER, ...Object.keys(trace).filter((k) => !TRACE_ORDER.includes(k) && k !== 'extra')]
    .filter((k) => !isEmpty(trace[k]));
  return (
    <dl className="kv">
      {keys.map((k) => (
        <div className="kv__row" key={k}>
          <dt>{titleCase(k)}</dt>
          <dd><Val v={trace[k]} /></dd>
        </div>
      ))}
      {!isEmpty(trace.extra) && <div className="kv__row"><dt>Other</dt><dd><Val v={trace.extra} /></dd></div>}
    </dl>
  );
}

export function AttackPathView({ findings, onOpen }) {
  const list = findings.filter((f) => f.attack_path_trace);
  if (!list.length) return <p className="muted">No attack-path trace was reported in this scan.</p>;
  return list.map((f) => (
    <details className="threat" key={f.id} open>
      <summary>
        <SevChip value={sevOf(f)} /> <span>{nameOf(f)}</span>
        <button type="button" className="btn btn--sm" onClick={(e) => { e.preventDefault(); onOpen(f); }}>Open finding</button>
      </summary>
      <div className="threat__body"><AttackTrace trace={f.attack_path_trace} /></div>
    </details>
  ));
}

export function DependencyView({ findings, onOpen }) {
  const rows = findings.filter((f) => f.dependency || f.affected_dependency).map((f) => ({ f, d: f.dependency || {} }));
  if (!rows.length) return <p className="muted">No dependency information was reported in this scan.</p>;
  const cols = [
    { label: 'Dependency', get: ({ f, d }) => d.dependency_name || f.affected_dependency },
    { label: 'Version', get: ({ d }) => d.dependency_version },
    { label: 'Direct / transitive', get: ({ d }) => d.dependency_type },
    { label: 'Resolution', get: ({ d }) => d.resolution },
    { label: 'Security identifier', get: ({ f, d }) => d.security_identifier || f.security_identifier },
    { label: 'Severity', get: ({ f }) => sevOf(f) },
    { label: 'Confidence', get: ({ f }) => f.confidence },
    { label: 'Vulnerable functionality', get: ({ d }) => d.affected_functionality },
    { label: 'Application usage', get: ({ d }) => d.application_usage },
    { label: 'Reachability / relevance', get: ({ d }) => d.application_reachability },
    { label: 'Affected components', get: ({ f, d }) => d.affected_components || f.affected_area },
  ];
  return <MiniTable cols={cols} rows={rows} onOpen={onOpen} />;
}

export function RuntimeView({ findings, onOpen }) {
  const rows = findings
    .filter((f) => f.runtime_validation || f.runtime_target || f.observed_behavior)
    .map((f) => ({ f, d: f.runtime_validation || {} }));
  if (!rows.length) return <p className="muted">No runtime validation details were reported in this scan.</p>;
  const cls = {};
  rows.forEach(({ f, d }) => { const c = str(f.classification || d.validation_status); if (c) cls[c] = (cls[c] || 0) + 1; });
  const cols = [
    { label: 'Runtime target', get: ({ f, d }) => f.runtime_target || d.runtime_target },
    { label: 'Environment', get: ({ d }) => d.environment },
    { label: 'Endpoint / interface', get: ({ d }) => d.endpoint_or_interface },
    { label: 'Expected behavior', get: ({ f, d }) => f.expected_behavior || d.expected_behavior },
    { label: 'Observed behavior', get: ({ f, d }) => f.observed_behavior || d.observed_behavior },
    { label: 'Validation result', get: ({ f, d }) => f.classification || d.validation_status },
    { label: 'Source finding', get: ({ d }) => d.source_finding_reference },
    { label: 'Attack path reference', get: ({ d }) => d.attack_path_reference },
    { label: 'Code location', get: ({ f }) => f.code_location },
  ];
  return (
    <>
      {Object.keys(cls).length > 0 && (
        <div className="chips">{Object.entries(cls).map(([k, n]) => <span className="chip" key={k}>{k}: {n}</span>)}</div>
      )}
      <MiniTable cols={cols} rows={rows} onOpen={onOpen} />
    </>
  );
}

function pathNodes(value) {
  if (isEmpty(value)) return [];
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  return String(value)
    .split(/\s*(?:->|=>|;|\n)\s*/g)
    .map((item) => item.trim().replace(/[.;]\s*$/, ''))
    .filter(Boolean);
}

function AttackPathFlow({ value }) {
  const nodes = pathNodes(value);
  if (!nodes.length) return null;
  return (
    <div className="field">
      <h3 className="field__label">Attack path</h3>
      <div className="attack-path-flow">
        {nodes.map((node, index) => (
          <div className="attack-path-flow__node" key={`${node}-${index}`}>
            <span>{index + 1}</span>
            <strong>{node}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceTrail({ items = [] }) {
  const rows = items
    .map((item) => ({
      location: str(item.location),
      description: str(item.description),
      origin: str(item.origin),
    }))
    .filter((item) => item.location || item.description || item.origin);
  if (!rows.length) return null;
  return (
    <div className="field">
      <h3 className="field__label">Evidence</h3>
      <div className="evidence-trail">
        {rows.map((item, index) => (
          <article className="evidence-trail__item" key={`${item.location || item.origin || 'evidence'}-${index}`}>
            <span className="evidence-trail__index">{index + 1}</span>
            <div>
              {item.location && <code>{item.location}</code>}
              {item.description && <p>{item.description}</p>}
              {item.origin && <small>{item.origin.replace(/_/g, ' ')}</small>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function FindingDetail({ f, onClose, onOpenArtifact }) {
  const opt = (label, key) => (isEmpty(f[key]) ? null : <Field label={label} value={f[key]} />);
  const items = f.evidence_items || [];
  return (
    <Modal title={nameOf(f)} onClose={onClose}>
      <div className="stack-sm">
        <div className="chips">
          <SevChip value={sevOf(f)} />
          {f.classification && <span className="tag tag--on">{humanizeEnumValue(str(f.classification))}</span>}
          {f.confidence && <span className="chip">Confidence: {humanizeEnumValue(str(f.confidence))}</span>}
          {f.cwe && <span className="chip">{str(f.cwe)}</span>}
          <span className="chip">{SCAN_LABELS[f.scan_type] || f.scan_type || 'Scan report'}</span>
        </div>

        {opt('Description', 'description')}
        <Field label="Category" value={f.category} />
        <Field label="Affected area" value={f.affected_area} />
        {opt('Affected dependency', 'affected_dependency')}
        {opt('Security identifier', 'security_identifier')}
        <Field label="Code location" value={f.code_location} />
        <Field label="Root cause" value={f.root_cause} />
        <Field label="Impact" value={f.impact} />
        <AttackPathFlow value={f.attack_path} />
        {f.attack_path_trace && <div className="field"><h3 className="field__label">Attack-path trace</h3><AttackTrace trace={f.attack_path_trace} /></div>}
        {f.dependency && <Field label="Dependency details" value={f.dependency} />}
        {opt('Runtime target', 'runtime_target')}
        {opt('Expected behavior', 'expected_behavior')}
        {opt('Observed behavior', 'observed_behavior')}
        {f.runtime_validation && <Field label="Runtime validation" value={f.runtime_validation} />}
        {opt('Runtime evidence', 'runtime_evidence')}
        {opt('Reasoning', 'reasoning')}
        {opt('Analysis reasoning', 'analysis_reasoning')}
        <Field label="Evidence" value={f.evidence} />
        {isEmpty(f.evidence) && <EvidenceTrail items={items} />}
        {!isEmpty(f.source_references) && <div className="field"><h3 className="field__label">Source references</h3><Refs refs={f.source_references} /></div>}
        <Field label="Recommended remediation" value={f.recommended_remediation} />
        {(!isEmpty(f.source_file) || f.source_artifact_id) && (
          <div className="field">
            <h3 className="field__label">Source report</h3>
            <div className="actions">
              {f.source_file && <code>{f.source_file}</code>}
              {f.source_artifact_id && <button type="button" className="btn btn--sm" onClick={() => onOpenArtifact(f.source_artifact_id)}>Open raw report</button>}
            </div>
          </div>
        )}
        {(!isEmpty(f.finding_id) || !isEmpty(f.source_scan_ids) || !isEmpty(f.source_finding_ids)) && (
          <Disclosure title="Technical traceability">
            {opt('Finding reference', 'finding_id')}
            {opt('Related report references', 'source_scan_ids')}
            {opt('Related finding references', 'source_finding_ids')}
          </Disclosure>
        )}
        {!isEmpty(f.attributes) && (
          <Disclosure title="Technical scanner attributes">
            <Field label="Additional attributes" value={f.attributes} />
          </Disclosure>
        )}
      </div>
    </Modal>
  );
}
