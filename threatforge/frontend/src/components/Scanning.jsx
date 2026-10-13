import { isValidElement } from 'react';
import { Disclosure, Field, Modal } from './Blocks.jsx';
import { Val, Refs } from './Val.jsx';
import { asArray, cleanPresentationText, humanizeEnumValue, isEmpty, titleCase } from '../lib/format.js';
import { SCAN_LABELS, compactValue, nameOf, sevClass, sevOf, str } from '../lib/scanning.js';

const DIST_COLORS = ['#37e4b2', '#38bdf8', '#f2b84b', '#ff8a7a', '#a78bfa', '#22d3ee', '#c4e36b', '#f472b6'];
const DIST_GRADIENTS = [
  ['#37e4b2', '#31d7ff'],
  ['#38bdf8', '#a78bfa'],
  ['#f2b84b', '#ff8a7a'],
  ['#ff8a7a', '#f472b6'],
  ['#a78bfa', '#38bdf8'],
  ['#22d3ee', '#37e4b2'],
  ['#c4e36b', '#37e4b2'],
  ['#f472b6', '#a78bfa'],
];
const MUTED_DIST_COLOR = '#42526a';
const MUTED_DIST_GRADIENT = ['#26344a', '#42526a'];

function colorPairFor(label, index, title = '', count = 1) {
  if (!Number(count)) return MUTED_DIST_GRADIENT;
  const sev = sevClass(label);
  const scope = String(title || '').toLowerCase();
  const value = String(label || '').toLowerCase();
  const levelPair = () => {
    if (sev === 'critical' || value.includes('critical')) return ['#ff2d75', '#ff7a3d'];
    if (sev === 'high' || value.includes('high')) return ['#ff7a3d', '#ffbe5c'];
    if (sev === 'medium' || value.includes('medium')) return ['#ffd166', '#c4e36b'];
    if (sev === 'low' || value.includes('low')) return ['#31d7ff', '#37e4b2'];
    if (sev === 'info' || value.includes('info')) return ['#8fb7ff', '#a78bfa'];
    if (value.includes('unknown')) return ['#7b8aa8', '#42526a'];
    return null;
  };

  if (scope.includes('severity') || scope.includes('risk')) {
    return levelPair() || DIST_GRADIENTS[index % DIST_GRADIENTS.length];
  }

  if (scope.includes('confidence')) {
    return levelPair() || DIST_GRADIENTS[index % DIST_GRADIENTS.length];
  }

  if (scope.includes('classification') || scope.includes('status')) {
    if (value.includes('confirm') || value.includes('complete') || value.includes('pass')) return ['#37e4b2', '#31d7ff'];
    if (value.includes('false') || value.includes('reject') || value.includes('fail')) return ['#ff5f6d', '#ff9a5c'];
    if (value.includes('partial') || value.includes('defer') || value.includes('review')) return ['#f6c85f', '#ff8a7a'];
    if (value.includes('validat') || value.includes('investigat')) return ['#a78bfa', '#38bdf8'];
  }

  const level = levelPair();
  if (level) return level;
  return DIST_GRADIENTS[index % DIST_GRADIENTS.length];
}

function colorFor(label, index, title = '', count = 1) {
  return colorPairFor(label, index, title, count)[0] || MUTED_DIST_COLOR;
}

function barGradientFor(label, index, title = '', count = 1) {
  const [start, end] = colorPairFor(label, index, title, count);
  return `linear-gradient(90deg, ${start}, ${end})`;
}

function dotGradientFor(label, index, title = '', count = 1) {
  const [start, end] = colorPairFor(label, index, title, count);
  return `radial-gradient(circle at 34% 30%, #ffffff 0%, ${end} 18%, ${start} 72%, ${end} 100%)`;
}

function donutGradient(items, total, title) {
  if (!total) return `${MUTED_DIST_GRADIENT[0]} 0%, ${MUTED_DIST_GRADIENT[1]} 100%`;
  let cursor = 0;
  return items.map((item, index) => {
    const start = cursor;
    const size = (item.count / total) * 100;
    cursor += size;
    if (!size) return '';
    const [first, second] = colorPairFor(item.label, index, title, item.count);
    return `${first} ${start}%, ${second} ${cursor}%`;
  }).filter(Boolean).join(', ');
}

function activeGlowColor(items, title) {
  const strongest = [...(items || [])]
    .filter((item) => Number(item.count) > 0)
    .sort((a, b) => b.count - a.count)[0];
  const index = items.findIndex((item) => item === strongest);
  return strongest ? colorFor(strongest.label, Math.max(index, 0), title, strongest.count) : DIST_COLORS[0];
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
          style={{ '--chart-glow': activeGlowColor(items, title), background: `conic-gradient(${donutGradient(items, total, title)})` }}
          aria-label={`${title} chart`}
        >
          <span>
            <strong>{total}</strong>
            <small>Total</small>
          </span>
        </div>
        <div className="bars" aria-label={`${title} distribution`}>
          {items.map((i, index) => (
            <div className={`bar ${i.count ? '' : 'bar--empty'}`} style={{ '--bar-glow': colorFor(i.label, index, title, i.count) }} key={i.label}>
              <span className="bar__dot" style={{ background: dotGradientFor(i.label, index, title, i.count) }} />
              <span className="bar__label" title={humanizeEnumValue(i.label)}>{humanizeEnumValue(i.label)}</span>
              <span className="bar__track">
                <span className={`bar__fill bar__fill--${sevClass(i.label)}`} style={{ width: `${(i.count / max) * 100}%`, background: barGradientFor(i.label, index, title, i.count) }} />
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
        const supportingText = cleanPresentationText(
          str(f.description) || compactValue(f.root_cause) || compactValue(f.validation) || str(f.impact),
        );
        const category = str(f.category);
        const confidence = str(f.confidence);
        const cwe = str(f.cwe);
        const classification = str(f.classification);
        const related = [...asArray(f.related_threats), ...asArray(f.related_scan_focus)].slice(0, 4);
        const confirmationReason = cleanPresentationText(str(f.confirmation_reason));
        return (
          <button type="button" className="finding-story" key={f.id} onClick={() => onOpen(f)}>
            <span className="finding-story__rail" aria-hidden="true" />
            <span className="finding-story__main">
              <span className="finding-story__meta">
                <SevChip value={sevOf(f)} />
                {category && <span className="tag">{cleanPresentationText(category)}</span>}
                {confidence && <span className="chip">Confidence: {humanizeEnumValue(confidence)}</span>}
                {cwe && <span className="chip">{cleanPresentationText(cwe)}</span>}
                {f.rule_id && <span className="chip">{cleanPresentationText(str(f.rule_id))}</span>}
                {showScan && <span className="chip">{SCAN_LABELS[f.scan_type] || f.scan_type || 'Scan report'}</span>}
              </span>
              <strong>{title}</strong>
              {supportingText && <span className="finding-story__summary">{supportingText}</span>}
              {confirmationReason && (
                <span className="finding-story__reason">
                  <small>Why confirmed</small>
                  {confirmationReason}
                </span>
              )}
              {related.length > 0 && (
                <span className="finding-story__path finding-story__path--compact" aria-label="Related threat context">
                  {related.map((node, index) => (
                    <span className="finding-story__step" key={`${node}-${index}`}>{str(node)}</span>
                  ))}
                </span>
              )}
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
  if (Array.isArray(value)) return value.map((item) => cleanPresentationText(compactValue(item) || str(item))).filter(Boolean);
  if (typeof value === 'object') {
    const nodes = [
      value.entry_point,
      value.entry,
      value.source,
      value.input,
      value.dataflow?.summary,
      value.data_flow?.summary,
      value.flow?.summary,
      value.reachability?.summary,
      value.summary,
      ...asArray(value.prerequisites),
      ...asArray(value.conditions),
      ...asArray(value.steps),
      ...asArray(value.path),
    ];
    return nodes
      .map((item) => cleanPresentationText(compactValue(item) || str(item)))
      .filter(Boolean);
  }
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

function CodeEvidence({ items = [] }) {
  const rows = asArray(items).filter((item) => !isEmpty(item));
  if (!rows.length) return null;
  return (
    <div className="field">
      <h3 className="field__label">Code evidence</h3>
      <div className="code-evidence-list">
        {rows.map((item, index) => {
          const location = str(item.location) || [item.path, item.start_line ? `:${item.start_line}${item.end_line && item.end_line !== item.start_line ? `-${item.end_line}` : ''}` : ''].filter(Boolean).join('');
          const label = cleanPresentationText(str(item.label || item.id || `Evidence ${index + 1}`));
          return (
            <article className="code-evidence-card" key={`${location || label}-${index}`}>
              <header>
                <strong>{label}</strong>
                {location && <code>{location}</code>}
              </header>
              {item.explanation && <p>{cleanPresentationText(str(item.explanation))}</p>}
              {item.code && <pre><code>{String(item.code)}</code></pre>}
            </article>
          );
        })}
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
        {opt('Rule', 'rule_id')}
        <Field label="Category" value={f.category} />
        {opt('Why confirmed', 'confirmation_reason')}
        <Field label="Affected area" value={f.affected_area} />
        {opt('Entry points', 'entry_points')}
        {opt('Related threats', 'related_threats')}
        {opt('Related scan focus', 'related_scan_focus')}
        {opt('Affected dependency', 'affected_dependency')}
        {opt('Security identifier', 'security_identifier')}
        <Field label="Code location" value={f.code_location} />
        <Field label="Root cause" value={f.root_cause} />
        <Field label="Validation" value={f.validation} />
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
        <CodeEvidence items={items} />
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
