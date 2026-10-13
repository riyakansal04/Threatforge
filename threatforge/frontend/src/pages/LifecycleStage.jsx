import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { Disclosure, PageShell, Panel, Stats } from '../components/Blocks.jsx';
import ApprovalControl from '../components/ApprovalControl.jsx';
import DataTable from '../components/DataTable.jsx';
import { asArray, cleanPresentationText, count, humanizeEnumValue, isEmpty, labelOf, titleCase } from '../lib/format.js';
import { isDisplayableFinding } from '../lib/scanning.js';

const DESCRIPTIONS = {
  triage: 'Validate findings, deduplicate repeated signals, and decide what still needs proof.',
  prioritization: 'Rank triaged findings into a risk-aware queue and prepare Jira handoff.',
  investigation: 'Confirm root cause, affected paths, required controls and the recommended remediation direction.',
  remediation: 'Review generated code patches, validation notes and human approval before implementation.',
  'fix-verification': 'Verify the specific remediated finding with focused evidence.',
  regression: 'Check related paths and confirm the fix did not introduce a nearby weakness.',
  closure: 'Decide whether the evidence is sufficient to close the security case.',
};

const PRIMARY_RECORDS = {
  triage: ['triage_decisions', 'finding_relationships'],
  prioritization: ['priority_queue'],
  investigation: ['remediations'],
  remediation: ['remediations'],
  'fix-verification': ['targeted_verifications'],
  regression: ['regression_verifications'],
  closure: ['closure_assessments'],
};

const SUMMARY_FIELDS = {
  triage: ['triage_method', 'classification_summary', 'deduplication_summary', 'validation_required', 'false_positives', 'coverage', 'limitations'],
  prioritization: ['priority_method', 'priority_considerations', 'classification_summary', 'remediation_queue_summary', 'follow_up_queue', 'capacity_and_work_plan'],
  investigation: ['investigation_summary', 'root_cause_summary', 'remediation_requirements', 'proposed_remediation_summary', 'fix_summary', 'implementation_summary', 'validation_summary', 'security_improvement_summary', 'residual_risks'],
  remediation: ['fix_summary', 'implementation_summary', 'authorization_summary', 'validation_summary', 'security_improvement_summary', 'residual_risks'],
  'fix-verification': ['scope', 'determinations', 'validation_summary', 'classification_summary'],
  regression: ['determination_summary', 'classification_summary', 'linked_findings_summary', 'related_paths_checked', 'regression_summary'],
  closure: ['classification_summary', 'closure_determinations', 'decision_summary', 'evidence_sufficiency_summary', 'remaining_requirements'],
};

const SUMMARY_LABELS = {
  triage_method: 'Triage method',
  classification_summary: 'Decision outcome',
  deduplication_summary: 'Deduplication result',
  validation_required: 'Needs validation',
  false_positives: 'False positives',
  decision_notes: 'Decision notes',
  priority_method: 'Priority method',
  priority_considerations: 'Priority drivers',
  remediation_queue_summary: 'Remediation queue',
  follow_up_queue: 'Follow-up queue',
  capacity_and_work_plan: 'Work plan',
  target_finding: 'Target finding',
  investigation_summary: 'Remediation analysis',
  root_cause_summary: 'Root cause',
  remediation_requirements: 'Fix requirements',
  proposed_remediation_summary: 'Fix direction',
  fix_summary: 'Fix summary',
  implementation_summary: 'Implementation',
  authorization_summary: 'Approval state',
  validation_summary: 'Validation',
  security_improvement_summary: 'Security improvement',
  residual_risks: 'Residual risk',
  scope: 'Scope',
  determinations: 'Determination',
  related_paths_checked: 'Related paths checked',
  regression_summary: 'Regression result',
  closure_summary: 'Closure summary',
  decision_summary: 'Closure decision',
  evidence_sufficiency_summary: 'Evidence sufficiency',
  remaining_requirements: 'Remaining requirements',
  coverage: 'Review scope',
  limitations: 'Limitations',
};

const FIELD_LABELS = {
  decision_basis: 'Decision basis',
  dedup_basis: 'Deduplication basis',
  runtime_validation: 'Runtime validation',
  evidence_supported: 'Evidence supported',
  requires_validation: 'Requires validation',
  already_addressed: 'Already addressed',
  false_positive: 'False positive',
  name: 'Outcome',
  value: 'Count',
  classification: 'Classification',
  priority: 'Priority',
  status: 'Status',
  result: 'Result',
  finding_id: 'Finding',
  source_findings: 'Source findings',
  root_cause_group_id: 'Root cause group',
  common_root_cause: 'Common root cause',
};

const RECORD_COLUMNS = {
  consolidated_findings: [
    { label: 'Finding ID', keys: ['finding_id', 'logical_finding_id', 'consolidated_finding_id', 'id'] },
    { label: 'Title', keys: ['title', 'name', 'scenario', 'summary'] },
    { label: 'Severity', keys: ['severity'] },
    { label: 'Status', keys: ['classification', 'status', 'validation_state'] },
    { label: 'Source findings', keys: ['source_findings', 'source_finding_ids', 'source_count'] },
    { label: 'Common root cause', keys: ['common_root_cause', 'root_cause', 'root_cause_group_id'] },
  ],
  triage_decisions: [
    { label: 'Finding', keys: ['finding_id', 'title'] },
    { label: 'Verdict', keys: ['classification'] },
    { label: 'Rank', keys: ['exploitability_stack_rank'] },
    { label: 'Severity', keys: ['severity'] },
    { label: 'Confidence', keys: ['confidence'] },
    { label: 'Reachability', keys: ['reachability'] },
    { label: 'Duplicate of', keys: ['duplicate_of'] },
    { label: 'Needs evidence', keys: ['required_additional_evidence', 'validation_required', 'requires_validation'] },
  ],
  finding_relationships: [
    { label: 'From', keys: ['source_finding_id'] },
    { label: 'To', keys: ['target_finding_id'] },
    { label: 'Relationship', keys: ['relationship_type'] },
    { label: 'Root cause group', keys: ['root_cause_group_id'] },
    { label: 'Summary', keys: ['description'] },
  ],
  priority_queue: [
    { label: 'Finding', keys: ['finding_id', 'title'] },
    { label: 'Priority', keys: ['priority'] },
    { label: 'Severity', keys: ['severity'] },
    { label: 'Exploitability', keys: ['exploitability', 'confidence'] },
    { label: 'Asset / area', keys: ['affected_asset', 'affected_area'] },
    { label: 'Work plan', keys: ['work_plan', 'target_period', 'queue_position'] },
  ],
  remediations: [
    { label: 'Finding', keys: ['finding_id', 'title'] },
    { label: 'Status', keys: ['status', 'implementation_status'] },
    { label: 'Root cause', keys: ['root_cause'] },
    { label: 'Fix direction', keys: ['recommendation', 'proposed_remediation'] },
    { label: 'Validation', keys: ['security_validation', 'functional_validation'] },
    { label: 'Risk notes', keys: ['risk_notes', 'residual_risk'] },
  ],
  targeted_verifications: [
    { label: 'Finding', keys: ['finding_id', 'title'] },
    { label: 'Result', keys: ['result'] },
    { label: 'Target', keys: ['target', 'affected_area'] },
    { label: 'Original weakness', keys: ['root_cause', 'original_condition'] },
    { label: 'Implemented fix', keys: ['post_remediation_condition', 'remediation_details'] },
    { label: 'Technical conclusion', keys: ['validation_note', 'security_improvement'] },
    { label: 'Evidence', keys: ['evidence', 'fixed_evidence', 'validation_results'] },
    { label: 'Closure readiness', keys: ['closure_recommendation'] },
    { label: 'Limitations', keys: ['limitations'] },
  ],
  regression_verifications: [
    { label: 'Finding', keys: ['finding_id', 'title'] },
    { label: 'Classification', keys: ['classification', 'determination'] },
    { label: 'Regression status', keys: ['regression_status'] },
    { label: 'Related paths', keys: ['related_paths', 'related_components', 'related_interfaces'] },
    { label: 'Candidates', keys: ['regression_candidates', 'same_weakness_instances', 'new_or_regression_issues'] },
    { label: 'Linked findings', keys: ['linked_findings', 'linked_finding_ids'] },
  ],
  closure_assessments: [
    { label: 'Finding', keys: ['finding_id', 'title'] },
    { label: 'Decision', keys: ['closure_decision', 'classification'] },
    { label: 'Basis', keys: ['closure_reasoning', 'closure_reason'] },
    { label: 'Weakness addressed', keys: ['weakness_addressed'] },
    { label: 'References', keys: ['verification_reference', 'regression_reference'] },
    { label: 'Remaining requirements', keys: ['remaining_requirements'] },
  ],
};

const RECORD_TITLES = {
  triage_decisions: 'Triage decisions',
  finding_relationships: 'Finding relationships',
  priority_queue: 'Priority queue',
  remediations: 'Remediation records',
  targeted_verifications: 'Fix verification results',
  regression_verifications: 'Regression checks',
  closure_assessments: 'Closure assessments',
};

const TECHNICAL_KEYS = new Set([
  'artifacts',
  'diagrams',
  'manifest',
  'metadata',
  'raw',
  'raw_record',
  'raw_metadata',
  'attributes',
  'rule',
  'rule_id',
  'rule_metadata',
  'driver',
  'driver_metadata',
  'tool',
  'tool_metadata',
  'invocations',
  'execution',
  'execution_details',
  'working_directory',
  'workdir',
  'output_directory',
  'output_dir',
  'source_file',
  'source_artifact_id',
  'extra',
]);

const SUMMARY_HIDDEN_KEYS = new Set([
  ...TECHNICAL_KEYS,
  'context_inputs',
  'scan_results_reviewed',
  'source_references',
  'evidence_references',
  '_item_key',
]);

const RECORD_DETAIL_HIDDEN_KEYS = new Set([
  ...SUMMARY_HIDDEN_KEYS,
  'id',
  'triage_id',
  'priority_id',
  'remediation_id',
  'verification_id',
  'closure_id',
  '_item_key',
]);

const REMEDIATION_STATUS_OPTIONS = [
  { value: 'not_applied', label: 'Not applied' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'verified', label: 'Verified' },
  { value: 'accepted_risk', label: 'Accepted risk' },
];

const RECORD_DESCRIPTIONS = {
  triage_decisions: ['technical_conclusion', 'decision_reasoning', 'correlation_reasoning', 'reported_weakness', 'implementation_support', 'classification'],
  finding_relationships: ['description', 'reason', 'summary'],
  priority_queue: ['priority_reasoning', 'work_plan', 'capacity_context'],
  remediations: ['proposed_remediation', 'recommendation', 'fix_summary', 'implementation_summary', 'root_cause'],
  targeted_verifications: ['validation_summary', 'comparison_summary', 'validation_note', 'result', 'attack_path_status', 'security_improvement'],
  regression_verifications: ['regression_summary', 'determination_summary', 'determination', 'classification', 'regression_status'],
  closure_assessments: ['decision_summary', 'closure_summary', 'closure_reasoning', 'closure_decision', 'evidence_sufficient', 'remaining_requirements'],
};

const RECORD_FALLBACK_TITLES = {
  priority_queue: 'Priority item',
  remediations: 'Remediation item',
  targeted_verifications: 'Verification result',
  regression_verifications: 'Regression check',
  closure_assessments: 'Closure decision',
};

const RECORD_IDENTITY_KEYS = {
  triage_decisions: ['finding_id', 'title', 'classification', 'exploitability_stack_rank', 'reported_weakness', 'duplicate_of', 'root_cause_group_id', 'consolidated_finding_id', 'source_finding_ids'],
  finding_relationships: ['source_finding_id', 'target_finding_id', 'relationship_type'],
  priority_queue: ['finding_id', 'priority_id', 'title', 'severity', 'confidence', 'exploitability', 'affected_asset', 'exposure', 'priority', 'target_period', 'queue_position', 'work_plan', 'owner'],
  remediations: ['finding_id', 'remediation_id', 'title', 'root_cause', 'recommendation', 'proposed_remediation', 'status', 'implementation_status', 'changed_files'],
  targeted_verifications: ['finding_id', 'verification_id', 'title', 'target', 'affected_area', 'result', 'original_condition', 'post_remediation_condition', 'security_improvement', 'root_cause_addressed', 'validation_checks', 'validation_results', 'evidence'],
  regression_verifications: ['finding_id', 'regression_check_id', 'verification_id', 'title', 'classification', 'determination', 'regression_status', 'related_paths', 'regression_candidates', 'related_components', 'related_interfaces', 'linked_findings', 'linked_finding_ids', 'evidence'],
  closure_assessments: ['finding_id', 'closure_id', 'title', 'closure_decision', 'classification', 'closure_reasoning', 'weakness_addressed', 'evidence_sufficient', 'remaining_requirements', 'verification_reference', 'regression_reference', 'evidence'],
};

const text = (value) => cleanPresentationText(labelOf(value));
const first = (...values) => values.find((value) => !isEmpty(value));
const SECURITY_FINDING_RE = /\b(vulnerab|injection|execution|deserial|bypass|exposure|disclosure|leak|secret|credential|token|cookie|command|sql|xss|csrf|ssrf|xxe|crypto|forger|hardening|cwe-|cve-)\b/i;

function humanLabel(key) {
  const clean = String(key || '').trim();
  const mapped = SUMMARY_LABELS[clean] || FIELD_LABELS[clean];
  if (mapped) return mapped;
  return clean
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, 'ID')
    .replace(/\bCwe\b/g, 'CWE')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bJwt\b/g, 'JWT')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bXss\b/g, 'XSS')
    .replace(/\bOs\b/g, 'OS');
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function valueText(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (Array.isArray(value)) {
    return value
      .map((item) => valueText(item))
      .filter(Boolean)
      .join('; ');
  }
  if (value && typeof value === 'object') {
    if (isNameValueObject(value)) {
      const label = humanLabel(value.name);
      const body = valueText(value.value);
      return [label, body].filter(Boolean).join(': ');
    }
    const direct = first(
      value.title,
      value.summary,
      value.description,
      value.decision,
      value.classification,
      value.result,
      value.status,
      value.name,
      value.value,
      value.id
    );
    if (!isEmpty(direct)) return valueText(direct);
    const pairs = Object.entries(value)
      .filter(([key, item]) => !SUMMARY_HIDDEN_KEYS.has(key) && !isEmpty(item))
      .slice(0, 4)
      .map(([key, item]) => `${humanLabel(key)}: ${valueText(item)}`)
      .filter(Boolean);
    return pairs.join('; ');
  }
  const clean = cleanPresentationText(value);
  if (/^true$/i.test(clean)) return 'Yes';
  if (/^false$/i.test(clean)) return 'No';
  return humanizeEnumValue(clean);
}

function isPrimitive(value) {
  return value == null || typeof value !== 'object';
}

function isBareCounter(value) {
  return /^\d+$/.test(valueText(value));
}

function isNarrative(value) {
  const clean = valueText(value);
  return clean.length > 90 || clean.split(/\s+/).length > 12 || /[.;:]\s/.test(clean);
}

function sameText(a, b) {
  return valueText(a).toLowerCase() === valueText(b).toLowerCase();
}

function isNameValueObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).filter((key) => !isEmpty(value[key]));
  return keys.includes('name') && keys.includes('value') && keys.length <= 4;
}

function parseLabeledText(value) {
  const raw = valueText(value);
  if (!raw) return [];
  return raw
    .split(/;\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^([A-Za-z][A-Za-z0-9 _/-]{1,48}):\s*(.+)$/);
      if (!match) return { label: '', value: valueText(part) };
      const key = normalizeKey(match[1]);
      return { label: humanLabel(key), value: valueText(match[2]) };
    })
    .filter((part) => part.label || !isBareCounter(part.value));
}

function objectPairs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  if (isNameValueObject(value)) {
    return [{ label: humanLabel(value.name), value: valueText(value.value) }];
  }
  return Object.entries(value)
    .filter(([key, item]) => !SUMMARY_HIDDEN_KEYS.has(key) && !isEmpty(item))
    .map(([key, item]) => ({ label: humanLabel(key), value: item }))
    .filter(({ value }) => typeof value !== 'string' || !isBareCounter(value));
}

function rawObjectLikeText(value) {
  return /^\s*[\[{]/.test(valueText(value));
}

function isNegativeFlag(value) {
  return /^(no|false|not provided|none|n\/a)$/i.test(valueText(value));
}

function shouldHideSummaryPair(label, value) {
  const key = normalizeKey(label);
  if (
    /provided_by_user|user_provided|manual|uploaded_by_user|capacity_provided|capacity_available/.test(key) &&
    isNegativeFlag(value)
  ) return true;
  if (/^id$|metadata|manifest|raw|output_directory|working_directory/.test(key)) return true;
  if (/^review_scope$|(^|_)batch$|parallel_validation|validation_batch/.test(key)) return true;
  return false;
}

function cleanSummaryPairs(value) {
  return objectPairs(value)
    .filter((pair) => !shouldHideSummaryPair(pair.label, pair.value))
    .filter((pair) => !rawObjectLikeText(pair.label));
}

function isStructuredSummaryField(key) {
  return /work_plan|queue_summary|follow_up_queue|remediation_queue|capacity/i.test(String(key || ''));
}

function structuredSummaryRows(value) {
  const rows = asArray(value)
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
  const nameValuePairs = rows
    .filter(isNameValueObject)
    .flatMap((item) => cleanSummaryPairs(item));
  const cards = rows
    .filter((item) => !isNameValueObject(item))
    .map((item, index) => ({
      title: summaryCardTitle(item, index),
      pairs: cleanSummaryPairs(item),
    }))
    .filter((item) => item.pairs.length);

  return [
    ...(nameValuePairs.length ? [{ title: 'Summary', pairs: nameValuePairs }] : []),
    ...cards,
  ];
}

function summaryCardTitle(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || isNameValueObject(value)) return '';
  const preferred = first(
    value.title,
    value.summary_title,
    value.name,
    value.plan_type,
    value.queue,
    value.phase,
    value.priority,
    value.status,
    value.target_period
  );
  const title = valueText(preferred);
  if (title && !rawObjectLikeText(title)) return title;

  const keys = Object.entries(value)
    .filter(([key, item]) => !shouldHideSummaryPair(humanLabel(key), item) && !isEmpty(item))
    .map(([key]) => normalizeKey(key));
  if (keys.some((key) => /batch|track|queue/.test(key))) return 'Planned work';
  if (keys.some((key) => /note|reason|rationale|summary/.test(key))) return 'Notes';
  return index === 0 ? 'Details' : '';
}

function SummaryPairValue({ value }) {
  if (isPrimitive(value)) return <b>{valueText(value)}</b>;
  if (Array.isArray(value)) return <CompactList items={value} max={4} />;
  return <SummaryValue value={value} max={3} />;
}

function StructuredSummaryList({ rows, max = 5 }) {
  const [expanded, setExpanded] = useState(false);
  const cleanRowsList = structuredSummaryRows(rows);
  const shownRows = expanded ? cleanRowsList : cleanRowsList.slice(0, max);
  if (!cleanRowsList.length) return <p className="muted">No reviewer-facing details reported.</p>;
  return (
    <div className="summary-card-list">
      {shownRows.map((card, index) => (
        <article className="summary-mini-card" key={`${card.title || 'item'}-${index}`}>
          {card.title && <strong>{card.title}</strong>}
          {!!card.pairs.length && (
            <div className="summary-mini-card__pairs">
              {card.pairs.map((pair) => (
                <span key={`${pair.label}-${text(pair.value)}`}>
                  <em>{pair.label}</em>
                  <SummaryPairValue value={pair.value} />
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
      {cleanRowsList.length > max && (
        <button type="button" className="summary-more" onClick={() => setExpanded((on) => !on)}>
          {expanded ? 'Show less' : `+${cleanRowsList.length - max} more`}
        </button>
      )}
    </div>
  );
}

function metricCountValue(value) {
  if (typeof value === 'number') return value;
  const clean = valueText(value).replace(/,/g, '').trim();
  if (/^-?\d+(\.\d+)?$/.test(clean)) return Number(clean);
  return clean;
}

function metricIsZero(value) {
  const normalized = metricCountValue(value);
  return typeof normalized === 'number' && normalized === 0;
}

function classificationMetricEntries(value, options = {}) {
  const { includeZero = false } = options;
  const rows = Array.isArray(value) ? value : [value];
  const metrics = [];

  for (const row of rows) {
    if (isEmpty(row)) continue;

    if (isPrimitive(row)) {
      for (const part of parseLabeledText(row)) {
        metrics.push({
          key: normalizeKey(part.label || part.value),
          label: part.label || valueText(part.value),
          value: part.value,
        });
      }
      continue;
    }

    if (isNameValueObject(row)) {
      const key = normalizeKey(row.name);
      metrics.push({
        key,
        rawLabel: String(row.name || key),
        label: humanLabel(row.name || key),
        value: row.value,
      });
      continue;
    }

    for (const [key, item] of Object.entries(row)) {
      if (isEmpty(item) || SUMMARY_HIDDEN_KEYS.has(key)) continue;
      if (isNameValueObject(item)) {
        const raw = String(item.name || key);
        metrics.push({
          key: normalizeKey(raw),
          rawLabel: raw,
          label: humanLabel(raw),
          value: item.value,
        });
      } else if (isPrimitive(item)) {
        metrics.push({
          key: normalizeKey(key),
          rawLabel: key,
          label: humanLabel(key),
          value: item,
        });
      }
    }
  }

  const seen = new Set();
  return metrics
    .map((metric) => ({
      ...metric,
      value: metricCountValue(metric.value),
      rawLabel: metric.rawLabel || metric.key,
    }))
    .filter((metric) => !isEmpty(metric.value) && (includeZero || !metricIsZero(metric.value)))
    .filter((metric) => {
      const dedupeKey = `${metric.key}:${valueText(metric.value).toLowerCase()}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
}

function classificationMetricValue(value, names) {
  const wanted = new Set(names.map(normalizeKey));
  const match = classificationMetricEntries(value, { includeZero: true }).find((metric) => wanted.has(metric.key));
  return match ? match.value : undefined;
}

function statusDetailItems(value, duplicateLabels = []) {
  const duplicateKeys = new Set(duplicateLabels.flatMap((item) => [
    valueText(item).toLowerCase(),
    normalizeKey(item).replace(/_/g, ' '),
  ]));
  return uniqueTexts(asArray(value))
    .filter((item) => !isBareCounter(item))
    .filter((item) => {
      const clean = valueText(item).toLowerCase();
      const normalized = normalizeKey(item).replace(/_/g, ' ');
      return !duplicateKeys.has(clean) && !duplicateKeys.has(normalized);
    });
}

function hasDistinctStatusDetails(value, duplicateLabels = []) {
  return statusDetailItems(value, duplicateLabels).length > 0;
}

function validationDetailCount(context = {}) {
  return statusDetailItems(context.validation_required, [
    'Requires validation',
    'requires_validation',
    'Further validation required',
    'further_validation_required',
    'Needs validation',
  ]).length;
}

function isValidationMetric(metric) {
  const label = normalizeKey(`${metric.key || ''} ${metric.rawLabel || ''} ${metric.label || ''}`);
  return /(^|_)validation(_|$)/.test(label);
}

function visibleClassificationMetrics(value, context = {}) {
  const detailCount = validationDetailCount(context);
  return classificationMetricEntries(value)
    .filter((metric) => !isValidationMetric(metric) || detailCount > 0)
    .map((metric) => (isValidationMetric(metric) ? { ...metric, value: detailCount } : metric));
}

function ClassificationSummary({ value, context }) {
  const metrics = visibleClassificationMetrics(value, context);
  if (!metrics.length) return <p className="muted">No active decision buckets reported.</p>;
  return (
    <div className="outcome-metrics">
      {metrics.map((metric) => (
        <article className="outcome-metric" key={`${metric.key}-${metric.value}`}>
          <strong>{metric.label}</strong>
          <span>{metric.rawLabel}</span>
          <b>{valueText(metric.value)}</b>
        </article>
      ))}
    </div>
  );
}

function SummaryBody({ fieldKey, value, context }) {
  if (fieldKey === 'classification_summary') return <ClassificationSummary value={value} context={context} />;
  if (fieldKey === 'false_positives') return <LimitationCards value={value} empty="No false-positive notes reported." />;
  if (isStructuredSummaryField(fieldKey) && Array.isArray(value)) {
    return <StructuredSummaryList rows={value} />;
  }
  if (Array.isArray(value) && value.filter((item) => !isEmpty(item)).every(isNameValueObject)) {
    return <ClassificationSummary value={value} context={context} />;
  }
  return <SummaryValue value={value} />;
}

function summaryTextFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const preferred = [
    value.title,
    value.summary,
    value.description,
    value.reason,
    value.decision_reasoning,
    value.priority_reasoning,
    value.proposed_remediation,
    value.recommendation,
    value.result,
    value.classification,
    value.status,
  ].find((item) => !isEmpty(item));
  return preferred ? valueText(labelOf(preferred)) : '';
}

function uniqueTexts(values) {
  const seen = new Set();
  return values
    .map((item) => (isPrimitive(item) ? valueText(item) : summaryTextFromObject(item) || text(item)))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function hasSummaryContent(value) {
  if (isEmpty(value)) return false;
  if (isPrimitive(value)) return parseLabeledText(value).length > 0;
  if (Array.isArray(value)) {
    const rows = value.filter((item) => !isEmpty(item));
    if (!rows.length) return false;
    if (rows.every(isPrimitive)) return uniqueTexts(rows).some((item) => !isBareCounter(item));
    if (rows.every(isNameValueObject)) return classificationMetricEntries(rows).length > 0;
    return true;
  }
  return objectPairs(value).length > 0;
}

function hasSummaryFieldContent(key, value, context = {}) {
  if (!hasSummaryContent(value)) return false;
  if (key === 'classification_summary') return visibleClassificationMetrics(value, context).length > 0;
  if (isStructuredSummaryField(key) && Array.isArray(value)) return structuredSummaryRows(value).length > 0;
  if (Array.isArray(value) && value.filter((item) => !isEmpty(item)).every(isNameValueObject)) {
    return visibleClassificationMetrics(value, context).length > 0;
  }
  return true;
}

function SummaryValue({ value, max = 5 }) {
  const [expanded, setExpanded] = useState(false);
  if (isEmpty(value)) return <p className="muted">No details reported.</p>;

  if (isPrimitive(value)) {
    const parts = parseLabeledText(value);
    if (!parts.length) return <p className="muted">No reviewer-facing details reported.</p>;
    if (parts.length === 1 && !parts[0].label) return <p className="summary-copy">{parts[0].value}</p>;
    return (
      <div className="summary-notes">
        {parts.slice(0, max).map((part, index) => (
          <div className="summary-note" key={`${part.label}-${part.value}-${index}`}>
            {part.label && <span>{part.label}</span>}
            <p>{part.value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    const rows = value.filter((item) => !isEmpty(item));
    if (!rows.length) return <p className="muted">No details reported.</p>;

    if (rows.every(isPrimitive)) {
      const items = uniqueTexts(rows).filter((item) => !isBareCounter(item));
      const shown = expanded ? items : items.slice(0, max);
      if (!items.length) return <p className="muted">No reviewer-facing details reported.</p>;
      return (
        <div className="summary-notes">
          {shown.map((item) => <p className="summary-copy" key={item}>{item}</p>)}
          {items.length > max && (
            <button type="button" className="summary-more" onClick={() => setExpanded((on) => !on)}>
              {expanded ? 'Show less' : `+${items.length - max} more`}
            </button>
          )}
        </div>
      );
    }

    if (rows.every(isNameValueObject)) {
      return <ClassificationSummary value={rows} />;
    }

    return <StructuredSummaryList rows={rows} max={max} />;
  }

  const pairs = cleanSummaryPairs(value);
  if (!pairs.length) return <p className="muted">No reviewer-facing details reported.</p>;
  if (pairs.every((pair) => isPrimitive(pair.value))) {
    if (pairs.some((pair) => isBareCounter(pair.value) || /^(yes|no)$/i.test(valueText(pair.value)))) {
      return (
        <div className="summary-metrics">
          {pairs.slice(0, max).map((pair) => (
            <span className="summary-metric" key={`${pair.label}-${pair.value}`}>
              <b>{valueText(pair.value)}</b>
              <em>{pair.label}</em>
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="summary-notes">
        {pairs.slice(0, max).map((pair) => (
          <div className="summary-note" key={`${pair.label}-${pair.value}`}>
            <span>{pair.label}</span>
            <p>{valueText(pair.value)}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="summary-card-list">
      {pairs.slice(0, max).map((pair) => (
        <article className="summary-mini-card" key={pair.label}>
          <strong>{pair.label}</strong>
          <SummaryPairValue value={pair.value} />
        </article>
      ))}
    </div>
  );
}

function sourceRefsFromRow(row) {
  const values = [
    row.source_findings,
    row.source_finding_ids,
    row.source_finding_references,
    row.source_scan_ids,
    row.related_finding_ids,
  ].flatMap((value) => asArray(value));
  return values.map(text).filter(Boolean);
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = text(value).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recordMergeKey(value, index = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return `${text(value).toLowerCase()}:${index}`;
  const id = first(
    value._item_key,
    value.finding_id,
    value.logical_finding_id,
    value.consolidated_finding_id,
    value.priority_id,
    value.triage_id,
    value.remediation_id,
    value.verification_id,
    value.regression_check_id,
    value.closure_id,
    value.id
  );
  if (!isEmpty(id)) return valueText(id).toLowerCase();
  return JSON.stringify(value);
}

function mergeUniqueRows(a = [], b = []) {
  const seen = new Set();
  return [...asArray(a), ...asArray(b)].filter((item, index) => {
    if (isEmpty(item)) return false;
    const key = recordMergeKey(item, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeStageValue(a, b) {
  if (isEmpty(a)) return b;
  if (isEmpty(b)) return a;
  if (Array.isArray(a) || Array.isArray(b)) return mergeUniqueRows(asArray(a), asArray(b));
  if (typeof a === 'object' && typeof b === 'object') return { ...b, ...a };
  return a;
}

function mergeStageData(a = {}, b = {}) {
  const out = { ...a };
  Object.entries(b || {}).forEach(([key, value]) => {
    out[key] = mergeStageValue(out[key], value);
  });
  return out;
}

function mergeRecordSets(a = {}, b = {}) {
  const out = { ...a };
  Object.entries(b || {}).forEach(([key, rows]) => {
    out[key] = mergeUniqueRows(out[key], rows);
  });
  return out;
}

function mergeArtifacts(a = [], b = []) {
  const out = [...asArray(a)];
  const seen = new Set(out.map((item) => item?.id || `${item?.filename}-${item?.sha256}`));
  asArray(b).forEach((item) => {
    const key = item?.id || `${item?.filename}-${item?.sha256}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  });
  return out;
}

function mergeLifecyclePayloads(payloads = []) {
  const [firstPayload, ...rest] = payloads.filter(Boolean);
  if (!firstPayload) return null;
  return rest.reduce((acc, item) => ({
    ...acc,
    has_data: Boolean(acc.has_data || item.has_data),
    updated_at: acc.updated_at || item.updated_at,
    data: mergeStageData(acc.data || {}, item.data || {}),
    records: mergeRecordSets(acc.records || {}, item.records || {}),
    artifacts: mergeArtifacts(acc.artifacts || [], item.artifacts || []),
  }), firstPayload);
}

function cleanRows(rows) {
  return asArray(rows)
    .filter((row) => !isEmpty(row))
    .map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return { title: text(row) };
      return Object.fromEntries(Object.entries(row).filter(([key]) => !TECHNICAL_KEYS.has(key)));
    });
}

function recordIdentityScore(row, recordKey) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return 0;
  const keys = RECORD_IDENTITY_KEYS[recordKey] || [];
  return keys.reduce((score, key) => score + (isEmpty(row[key]) ? 0 : 1), 0);
}

function isWorkflowRecord(row, recordKey) {
  const score = recordIdentityScore(row, recordKey);
  if (recordKey === 'priority_queue') return score >= 2 || !isEmpty(row.finding_id) || !isEmpty(row.priority_id);
  return score > 0;
}

function workflowRows(records = {}, recordKey) {
  return cleanRows(records?.[recordKey]).filter((row) => isWorkflowRecord(row, recordKey));
}

function isLogicalFindingRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const title = text(first(row.title, row.name, row.scenario, row.summary));
  const id = text(first(row.finding_id, row.logical_finding_id, row.consolidated_finding_id, row.id));
  const hasSecurityContext = [
    row.severity,
    row.classification,
    row.status,
    row.validation_state,
    row.root_cause,
    row.common_root_cause,
    row.root_cause_group_id,
    row.source_findings,
    row.source_finding_ids,
    row.cwe,
    row.impact,
    row.affected_area,
    row.recommendation,
    row.proposed_remediation,
  ].some((value) => !isEmpty(value));
  return Boolean((title || id) && (hasSecurityContext || SECURITY_FINDING_RE.test(`${title} ${id}`) || isDisplayableFinding(row)));
}

function consolidatedRows(d, records) {
  const explicit = asArray(d.consolidated_findings);
  const rows = explicit.length ? explicit : asArray(records.findings);
  return cleanRows(rows).filter(isLogicalFindingRow).map((row, index) => ({
    finding_id: first(row.finding_id, row.logical_finding_id, row.consolidated_finding_id, row.id, `LF-${index + 1}`),
    title: first(row.title, row.name, row.scenario, row.summary, text(row)),
    severity: row.severity,
    classification: first(row.classification, row.status, row.validation_state),
    source_findings: first(row.source_findings, row.source_finding_ids, row.source_count),
    common_root_cause: first(row.common_root_cause, row.root_cause, row.root_cause_group_id),
    ...row,
  }));
}

function sourceFindingCount(d, records, logicalRows) {
  const ids = unique([
    ...logicalRows.flatMap(sourceRefsFromRow),
    ...asArray(records.triage_decisions).flatMap(sourceRefsFromRow),
    ...asArray(records.finding_relationships).flatMap((row) => [row.source_finding_id, row.target_finding_id]),
  ]);
  return ids.length || count(d.scan_results_reviewed) || count(d.context_inputs) || count(records.findings);
}

function CompactList({ items, empty = 'No items reported.', max = 6 }) {
  const [expanded, setExpanded] = useState(false);
  const rows = unique(asArray(items).map(text).filter(Boolean)).filter((item) => !isBareCounter(item));
  if (!rows.length) return <p className="muted">{empty}</p>;
  const shown = expanded ? rows : rows.slice(0, max);
  return (
    <div className="compact-list">
      {shown.map((item) => <span key={item}>{item}</span>)}
      {rows.length > max && (
        <button type="button" className="compact-list__more" onClick={() => setExpanded((on) => !on)}>
          {expanded ? 'Show less' : `+${rows.length - max} more`}
        </button>
      )}
    </div>
  );
}

function SummaryFields({ d, stageKey }) {
  const fields = (SUMMARY_FIELDS[stageKey] || [])
    .map((key) => [key, d[key]])
    .filter(([key, value]) => hasSummaryFieldContent(key, value, d));
  if (!fields.length) return null;
  return (
    <div className="summary-field-grid">
      {fields.map(([key, value]) => (
        <article className="summary-field" key={key}>
          <span>{SUMMARY_LABELS[key] || titleCase(key)}</span>
          <div className="summary-field__value"><SummaryBody fieldKey={key} value={value} context={d} /></div>
        </article>
      ))}
    </div>
  );
}

function SummaryCards({ entries, context }) {
  const fields = (entries || []).filter(([key, value]) => hasSummaryFieldContent(key, value, context));
  if (!fields.length) return null;
  return (
    <div className="summary-field-grid">
      {fields.map(([key, value]) => (
        <article className="summary-field" key={key}>
          <span>{SUMMARY_LABELS[key] || titleCase(key)}</span>
          <div className="summary-field__value"><SummaryBody fieldKey={key} value={value} context={context} /></div>
        </article>
      ))}
    </div>
  );
}

function isSpecificTriageDecision(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  return [
    row.finding_id,
    row.title,
    row.classification,
    row.exploitability_stack_rank,
    row.severity,
    row.confidence,
    row.reported_weakness,
    row.duplicate_of,
    row.root_cause_group_id,
    row.consolidated_finding_id,
    row.source_finding_ids,
    row.affected_code_paths,
    row.affected_components,
    row.entry_points,
    row.implementation_support,
    row.reachability,
    row.root_cause_analysis,
    row.validation_assessment,
    row.technical_conclusion,
    row.uncertainty,
    row.required_additional_evidence,
    row.requires_validation,
    row.assessment_supported,
    row.already_addressed,
    row.security_controls,
  ].some((value) => !isEmpty(value));
}

function decisionNoteFromRow(row) {
  return first(
    row.decision_reasoning,
    row.correlation_reasoning,
    isNarrative(row.classification) ? row.classification : '',
    row.reported_weakness,
    row.implementation_support
  );
}

function triageOutcomeEntries(d, summaryRows) {
  const notes = uniqueTexts(summaryRows.map(decisionNoteFromRow).filter(Boolean));
  const entries = [
    ['deduplication_summary', d.deduplication_summary],
  ];
  if (hasDistinctStatusDetails(d.validation_required, ['Requires validation', 'requires_validation'])) {
    entries.push(['validation_required', d.validation_required]);
  }
  if (hasDistinctStatusDetails(d.false_positives, ['False positive', 'false_positive'])) {
    entries.push(['false_positives', d.false_positives]);
  }
  entries.push(['decision_notes', notes]);
  return entries;
}

function LimitationCards({ value, empty = 'No limitations reported.' }) {
  const rows = uniqueTexts(asArray(value)).filter((item) => !isBareCounter(item));
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <div className="limitation-cards">
      {rows.map((item, index) => (
        <article className="limitation-card" key={item}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <p>{item}</p>
        </article>
      ))}
    </div>
  );
}

function EvidenceAndLimitations({ d }) {
  const refs = asArray(d.source_references);
  const hasLimitations = hasSummaryContent(d.limitations);
  if (!refs.length && !hasLimitations) return null;
  return (
    <Panel id="evidence-limitations" title="Evidence and limitations" hint="Only the supporting context needed to interpret this stage. Full raw artifacts stay in Traceability.">
      <div className="evidence-limitations-stack">
        {hasLimitations && (
          <article className="summary-field summary-field--limitations">
            <span>Analysis limitations</span>
            <div className="summary-field__value"><LimitationCards value={d.limitations} /></div>
          </article>
        )}
        {refs.length > 0 && (
          <article className="summary-field summary-field--evidence-trailing">
            <span>Important evidence</span>
            <CompactList items={refs.map(labelOf)} max={8} />
          </article>
        )}
      </div>
    </Panel>
  );
}

function pickRecordValue(row, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    if (!isEmpty(row?.[key])) return row[key];
  }
  return undefined;
}

function fallbackRecordTitle(row, recordKey, index) {
  const classification = valueText(row.classification);
  const relationship = valueText(row.relationship_type);
  if (recordKey === 'triage_decisions') {
    if (!isEmpty(row.duplicate_of) || /duplicate|dedup/i.test(classification)) return 'Duplicate decision';
    if (!isEmpty(row.requires_validation) || /requires? validation|validation required|candidate/i.test(classification)) return 'Validation required';
    if (/false positive|invalid/i.test(classification)) return 'False positive decision';
    if (/confirm|valid/i.test(classification)) return 'Confirmed finding';
    return `Decision note ${index + 1}`;
  }
  if (recordKey === 'finding_relationships') {
    const source = text(row.source_finding_id);
    const target = text(row.target_finding_id);
    if (source || target) return [source, target].filter(Boolean).join(' -> ');
    if (/duplicate|dedup/i.test(relationship)) return 'Duplicate relationship';
    if (/separate|distinct/i.test(relationship)) return 'Separate findings';
    return `Relationship note ${index + 1}`;
  }
  return `${RECORD_FALLBACK_TITLES[recordKey] || 'Review item'} ${index + 1}`;
}

function recordPrimary(row, columns, recordKey, index) {
  const id = first(row.finding_id, row.logical_finding_id, row.consolidated_finding_id, row.priority_id, row.triage_id, row.remediation_id, row.verification_id, row.regression_check_id, row.closure_id);
  const title = first(row.title, row.name, row.scenario, row.summary, row.reported_weakness, row.target, pickRecordValue(row, columns?.[0]?.keys));
  return {
    id: text(id),
    title: text(title) || text(id) || fallbackRecordTitle(row, recordKey, index),
  };
}

function recordDescription(row, recordKey) {
  const keys = RECORD_DESCRIPTIONS[recordKey] || ['description', 'summary', 'reason'];
  const value = first(...keys.map((key) => row[key]));
  if (isEmpty(value)) return '';
  if (Array.isArray(value)) return uniqueTexts(value).find((item) => !isBareCounter(item)) || '';
  return valueText(labelOf(value));
}

function recordFacts(row, columns, primary, description) {
  return (columns || [])
    .slice(1)
    .map((column) => ({ label: column.label, value: pickRecordValue(row, column.keys) }))
    .filter((fact) => !isEmpty(fact.value))
    .filter((fact) => !isNarrative(fact.value))
    .filter((fact) => !sameText(fact.value, primary?.title) && !sameText(fact.value, description))
    .slice(0, 5);
}

function recordDetails(row, columns, recordKey) {
  const shown = new Set();
  (columns || []).forEach((column) => {
    const keys = Array.isArray(column.keys) ? column.keys : [column.keys];
    keys.forEach((key) => shown.add(key));
  });
  (RECORD_DESCRIPTIONS[recordKey] || []).forEach((key) => shown.add(key));
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key, value]) => !shown.has(key) && !RECORD_DETAIL_HIDDEN_KEYS.has(key) && !isEmpty(value))
      .slice(0, 8)
  );
}

function normalizedStatus(value) {
  const clean = normalizeKey(value);
  if (!clean) return 'not_applied';
  if (/not.*applied|generated.*not.*applied|none|pending|open|todo/.test(clean)) return 'not_applied';
  if (/verified|validated/.test(clean)) return 'verified';
  if (/done|fixed|complete|implemented|(^|_)applied($|_)/.test(clean)) return 'implemented';
  if (/progress|started|working/.test(clean)) return 'in_progress';
  if (/accept/.test(clean)) return 'accepted_risk';
  return clean;
}

function statusLabel(value) {
  const clean = normalizedStatus(value);
  return REMEDIATION_STATUS_OPTIONS.find((option) => option.value === clean)?.label || valueText(value) || 'Not applied';
}

function statusTone(value) {
  const clean = normalizedStatus(value);
  if (clean === 'implemented' || clean === 'verified') return 'is-good';
  if (clean === 'in_progress') return 'is-working';
  if (clean === 'accepted_risk') return 'is-risk';
  return 'is-open';
}

function updateLocalRow(rows, itemKey, updates = {}) {
  if (!itemKey) return rows;
  return rows.map((row) => (row._item_key === itemKey ? { ...row, ...updates } : row));
}

function RecordCards({ rows, columns, recordKey, stageKey, editableStatus = false }) {
  const [localRows, setLocalRows] = useState(rows);
  const [updatingKey, setUpdatingKey] = useState('');

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const updateStatus = async (row, nextValue) => {
    if (!row?._item_key) return;
    const key = row._item_key;
    setUpdatingKey(key);
    const previousRows = localRows;
    setLocalRows((current) => updateLocalRow(current, key, { status: nextValue, implementation_status: nextValue }));
    try {
      await api.updateLifecycleRecord(stageKey || 'investigation', recordKey, key, {
        status: nextValue,
        implementation_status: nextValue,
      });
    } catch (err) {
      setLocalRows(previousRows);
    } finally {
      setUpdatingKey('');
    }
  };

  if (!localRows.length) return <p className="muted">No review records reported.</p>;
  return (
    <div className="workflow-records">
      {localRows.map((row, index) => {
        const primary = recordPrimary(row, columns, recordKey, index);
        const description = recordDescription(row, recordKey);
        const showStatusEditor = editableStatus && recordKey === 'remediations' && row._item_key;
        const facts = recordFacts(row, columns, primary, description).filter((fact) => !(showStatusEditor && fact.label === 'Status'));
        const details = recordDetails(row, columns, recordKey);
        const rawStatus = first(row.status, row.implementation_status);
        const currentStatus = normalizedStatus(rawStatus);
        const statusOptions = REMEDIATION_STATUS_OPTIONS.some((option) => option.value === currentStatus)
          ? REMEDIATION_STATUS_OPTIONS
          : [{ value: currentStatus, label: valueText(rawStatus) || 'Current status' }, ...REMEDIATION_STATUS_OPTIONS];
        return (
          <article
            className={`workflow-record ${recordKey === 'remediations' ? 'workflow-record--remediation' : ''}`}
            key={row._item_key || `${primary.id || primary.title}-${index}`}
          >
            <div className="workflow-record__main">
              <div className="workflow-record__head">
                {primary.id && <span className="workflow-record__id">{primary.id}</span>}
                <h3>{primary.title}</h3>
                {showStatusEditor && (
                  <label className="status-editor">
                    <span>Status</span>
                    <details className={`status-menu ${statusTone(currentStatus)}`}>
                      <summary>{statusLabel(rawStatus)}</summary>
                      <div className="status-menu__list">
                        {statusOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={option.value === currentStatus ? 'is-selected' : ''}
                            disabled={updatingKey === row._item_key}
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open');
                              updateStatus(row, option.value);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </details>
                  </label>
                )}
              </div>
              {description && <p>{description}</p>}
              {!!facts.length && (
                <div className="workflow-record__facts">
                  {facts.map((fact) => (
                    <span key={`${fact.label}-${text(fact.value)}`}>
                      <em>{fact.label}</em>
                      <b>{isPrimitive(fact.value) ? valueText(fact.value) : text(fact.value)}</b>
                    </span>
                  ))}
                </div>
              )}
              {(recordKey === 'triage_decisions' || recordKey === 'remediations') && row._item_key && (
                <ApprovalControl
                  stageKey={stageKey || (recordKey === 'triage_decisions' ? 'triage' : 'investigation')}
                  recordKey={recordKey}
                  itemKey={row._item_key}
                  value={row.authorization_status}
                  onDecision={(next) => setLocalRows((current) => updateLocalRow(current, row._item_key, { authorization_status: next }))}
                />
              )}
            </div>
            {!isEmpty(details) && (
              <details className="workflow-record__details">
                <summary>View supporting details</summary>
                <SummaryValue value={details} max={6} />
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}

function compactTextItems(value) {
  return unique(asArray(value).map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const path = first(item.path, item.file, item.uri, item.location);
      if (!isEmpty(path)) {
        const start = first(item.start_line, item.startLine, item.line);
        const end = first(item.end_line, item.endLine);
        const range = !isEmpty(start)
          ? `:${valueText(start)}${!isEmpty(end) && valueText(end) !== valueText(start) ? `-${valueText(end)}` : ''}`
          : '';
        return `${valueText(path)}${range}`;
      }
      const id = first(item.finding_id, item.findingId, item.id, item.target, item.to);
      const relation = first(item.relationship, item.relationship_type, item.type, item.description);
      return [valueText(id), valueText(relation)].filter(Boolean).join(': ');
    }
    return valueText(item);
  }).filter(Boolean));
}

function rankValue(row) {
  const raw = valueText(row?.exploitability_stack_rank);
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function TriageMetaPill({ label, value, tone = '' }) {
  if (isEmpty(value)) return null;
  return (
    <span className={`triage-pill ${tone ? `triage-pill--${tone}` : ''}`}>
      <em>{label}</em>
      <b>{valueText(value)}</b>
    </span>
  );
}

function TriageChipGroup({ label, items }) {
  const rows = compactTextItems(items);
  if (!rows.length) return null;
  const isRelatedFindings = normalizeKey(label) === 'related_findings';
  return (
    <div className={`triage-chip-group ${isRelatedFindings ? 'triage-chip-group--wide' : ''}`}>
      <span>{label}</span>
      <div>
        {rows.map((item) => <b key={`${label}-${item}`}>{item}</b>)}
      </div>
    </div>
  );
}

function TriageDetailBlock({ label, value }) {
  if (isEmpty(value)) return null;
  return (
    <article className="triage-detail-block">
      <span>{label}</span>
      <SummaryValue value={value} max={3} />
    </article>
  );
}

function TriageDecisionCards({ rows }) {
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  if (!localRows.length) return <p className="muted">No triage decisions reported.</p>;
  const sorted = [...localRows].sort((a, b) => {
    const ar = rankValue(a);
    const br = rankValue(b);
    if (ar != null && br != null) return ar - br;
    if (ar != null) return -1;
    if (br != null) return 1;
    return valueText(first(a.finding_id, a.title)).localeCompare(valueText(first(b.finding_id, b.title)));
  });

  return (
    <div className="triage-decision-list">
      {sorted.map((row, index) => {
        const primary = recordPrimary(row, RECORD_COLUMNS.triage_decisions, 'triage_decisions', index);
        const rank = rankValue(row);
        const verdict = first(row.classification, row.validation_state, row.assessment_supported);
        const lead = first(row.technical_conclusion, row.decision_reasoning, row.implementation_support);
        const verdictTone = /confirm|valid|supported/i.test(valueText(verdict))
          ? 'good'
          : /review|validation|candidate/i.test(valueText(verdict))
            ? 'working'
            : /false|not|invalid/i.test(valueText(verdict))
              ? 'risk'
              : '';
        const validationLimits = first(row.validation_assessment, row.uncertainty);
        const decisionDetails = [
          ['Evidence to claim', row.implementation_support],
          ['Reachability', row.reachability],
          ['Root cause', row.root_cause_analysis || row.same_underlying_issue],
          ['Validation limits', validationLimits],
        ].filter(([, value]) => !isEmpty(value));
        const relationshipGroups = [
          ['Entry points', row.entry_points],
          ['Components', row.affected_components],
          ['Threat links', row.related_threats],
          ['Scan focus', row.related_scan_focus],
          ['Related findings', row.related_findings],
        ].filter(([, value]) => compactTextItems(value).length);
        const followupDetails = [
          ['Uncertainty', row.validation_assessment ? row.uncertainty : null],
          ['Required additional evidence', row.required_additional_evidence],
          ['False-positive reasoning', row.false_positive_reasoning],
        ].filter(([, value]) => !isEmpty(value));

        return (
          <article className="triage-decision-card" key={row._item_key || `${primary.id || primary.title}-${index}`}>
            <div className="triage-decision-card__body">
              <div className="triage-decision-card__head">
                <div className="triage-decision-card__identity">
                  <div className="triage-decision-card__rank">
                    <span>{rank != null ? `#${rank}` : index + 1}</span>
                    <em>Rank</em>
                  </div>
                  <div>
                    {primary.id && <span className="workflow-record__id">{primary.id}</span>}
                    <h3>{primary.title}</h3>
                  </div>
                </div>
                <div className="triage-decision-card__meta">
                  <TriageMetaPill label="Verdict" value={verdict} tone={verdictTone} />
                  <TriageMetaPill label="Severity" value={row.severity} tone={normalizeKey(row.severity)} />
                  <TriageMetaPill label="Confidence" value={row.confidence} />
                </div>
              </div>

              {lead && <p className="triage-decision-card__lead">{valueText(lead)}</p>}

              {decisionDetails.length > 0 && (
                <section className="triage-card-section">
                  <div className="triage-card-section__head">
                    <span>Decision support</span>
                  </div>
                  <div className="triage-detail-grid">
                    {decisionDetails.map(([label, value]) => <TriageDetailBlock key={label} label={label} value={value} />)}
                  </div>
                </section>
              )}

              {relationshipGroups.length > 0 && (
                <section className="triage-card-section triage-card-section--compact">
                  <div className="triage-card-section__head">
                    <span>Mapped relationships</span>
                  </div>
                  <div className="triage-chip-layout">
                    {relationshipGroups.map(([label, value]) => <TriageChipGroup key={label} label={label} items={value} />)}
                  </div>
                </section>
              )}

              {followupDetails.length > 0 && (
                <section className="triage-card-section triage-card-section--followup">
                  <div className="triage-card-section__head">
                    <span>Reviewer follow-up</span>
                    <em>What remains uncertain or needs proof</em>
                  </div>
                  <div className="triage-followup-grid">
                    {followupDetails.map(([label, value]) => <TriageDetailBlock key={label} label={label} value={value} />)}
                  </div>
                </section>
              )}

              {row._item_key && (
                <ApprovalControl
                  stageKey="triage"
                  recordKey="triage_decisions"
                  itemKey={row._item_key}
                  value={row.authorization_status}
                  onDecision={(next) => setLocalRows((current) => updateLocalRow(current, row._item_key, { authorization_status: next }))}
                />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

const PRIORITY_WEIGHT = {
  critical: 1,
  highest: 1,
  high: 2,
  medium: 3,
  moderate: 3,
  low: 4,
  informational: 5,
  info: 5,
};

function priorityKey(value) {
  const key = normalizeKey(value);
  if (/critical|highest|p0|p1/.test(key)) return 'critical';
  if (/high|p2/.test(key)) return 'high';
  if (/medium|moderate|p3/.test(key)) return 'medium';
  if (/low|p4/.test(key)) return 'low';
  if (/info/.test(key)) return 'informational';
  return key;
}

function priorityWeight(row, index = 0) {
  const key = priorityKey(first(row.priority, row.target_period, row.severity));
  return PRIORITY_WEIGHT[key] || 9 + index;
}

function priorityTone(value) {
  const key = priorityKey(value);
  if (key === 'critical') return 'risk';
  if (key === 'high') return 'high';
  if (key === 'medium') return 'medium';
  if (key === 'low' || key === 'informational') return 'good';
  return '';
}

function priorityCount(rows, value) {
  return rows.filter((row) => priorityKey(row.priority) === value).length;
}

const PRIORITY_CONTEXT_HIDDEN = new Set([
  'scale_used',
  'configured_scale_found',
  'priority_scale_note',
]);

function priorityContextItems(value) {
  return asArray(value)
    .map((item) => {
      if (isNameValueObject(item)) {
        return { key: normalizeKey(item.name), label: humanLabel(item.name), value: item.value };
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const label = first(item.title, item.name, item.label);
        const body = first(item.value, item.summary, item.description, item.note, item.reason);
        return { key: normalizeKey(label), label: humanLabel(label), value: body };
      }
      return { key: normalizeKey(item), label: '', value: item };
    })
    .filter((item) => !isEmpty(item.value))
    .filter((item) => !PRIORITY_CONTEXT_HIDDEN.has(item.key));
}

function PriorityContextCards({ items }) {
  if (!items.length) return null;
  return (
    <div className="priority-context-list">
      {items.map((item, index) => {
        const values = asArray(item.value).map(valueText).filter(Boolean);
        return (
          <article className="priority-context-card" key={`${item.key || item.label || 'context'}-${index}`}>
            {item.label && <span>{item.label}</span>}
            {values.length > 1 ? (
              <ul>
                {values.map((value) => <li key={value}>{value}</li>)}
              </ul>
            ) : (
              <p>{values[0] || valueText(item.value)}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function priorityGateSource(row, records = {}) {
  const decisions = workflowRows(records, 'triage_decisions').filter(isSpecificTriageDecision);
  return matchDecisionForFinding(row, decisions) || row;
}

function priorityApprovalState(row, records = {}) {
  return storedHumanApproval(priorityGateSource(row, records));
}

function approvedPriorityRows(records = {}) {
  return workflowRows(records, 'priority_queue')
    .filter((row) => priorityApprovalState(row, records) === 'approved');
}

function jiraBackedPriorityRows(records = {}) {
  return approvedPriorityRows(records)
    .filter((row) => !isEmpty(row.jira_key));
}

function matchingPriorityForFinding(row, priorityRows = []) {
  const tokens = findingTokens(row);
  if (!tokens.length) return null;
  return priorityRows.find((priority) => {
    const priorityTokens = findingTokens(priority);
    return priorityTokens.some((token) => tokens.includes(token));
  }) || null;
}

function PriorityQueueCards({ rows }) {
  if (!rows.length) return <p className="muted">No prioritized findings reported.</p>;
  const sorted = [...rows].sort((a, b) => {
    const byWeight = priorityWeight(a) - priorityWeight(b);
    if (byWeight) return byWeight;
    return valueText(first(a.finding_id, a.title)).localeCompare(valueText(first(b.finding_id, b.title)));
  });

  return (
    <div className="priority-card-list">
      {sorted.map((row, index) => {
        const primary = recordPrimary(row, RECORD_COLUMNS.priority_queue, 'priority_queue', index);
        const priority = first(row.priority, row.target_period);
        const riskDetails = [
          ['Technical severity', first(row.technical_severity, row.severity)],
          ['Exploitability', row.exploitability],
          ['Exposure', row.exposure],
          ['Impact', row.impact],
        ].filter(([, value]) => !isEmpty(value));
        const contextDetails = [
          ['Threat context', row.threat_model_relevance],
          ['Business context', first(row.business_context, row.business_criticality)],
          ['Compensating controls', row.existing_controls],
          ['Timeframe reason', row.timeframe_reason],
        ].filter(([, value]) => !isEmpty(value));
        const followupDetails = [
          ['Dependencies', row.dependencies],
          ['Uncertainty', row.uncertainty],
          ['Follow-up required', row.follow_up_required],
        ].filter(([, value]) => !isEmpty(value));
        const traceGroups = [
          ['Threat links', row.related_threats],
          ['Scan focus', row.related_scan_focus],
          ['Triage evidence', row.triage_evidence_ids],
          ['Evidence', row.evidence_references],
        ].filter(([, value]) => compactTextItems(value).length);

        return (
          <article className={`priority-card priority-card--${priorityTone(priority) || 'default'}`} key={row._item_key || `${primary.id || primary.title}-${index}`}>
            <div className="priority-card__head">
              <div className="priority-card__identity">
                <div className="priority-card__rank">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <em>Queue</em>
                </div>
                <div>
                  {primary.id && <span className="workflow-record__id">{primary.id}</span>}
                  <h3>{primary.title}</h3>
                </div>
              </div>
              <div className="triage-decision-card__meta">
                <TriageMetaPill label="Priority" value={priority} tone={priorityTone(priority)} />
                <TriageMetaPill label="Severity" value={row.severity || row.original_severity} tone={normalizeKey(row.severity || row.original_severity)} />
                <TriageMetaPill label="Triage" value={row.triage_verdict || row.confidence} tone={/confirm/i.test(valueText(row.triage_verdict || row.confidence)) ? 'good' : ''} />
              </div>
            </div>

            {row.priority_reasoning && <p className="priority-card__rationale">{valueText(row.priority_reasoning)}</p>}

            {riskDetails.length > 0 && (
              <section className="priority-card-section">
                <div className="triage-card-section__head">
                  <span>Risk drivers</span>
                </div>
                <div className="triage-detail-grid">
                  {riskDetails.map(([label, value]) => <TriageDetailBlock key={label} label={label} value={value} />)}
                </div>
              </section>
            )}

            {contextDetails.length > 0 && (
              <section className="priority-card-section priority-card-section--context">
                <div className="triage-card-section__head">
                  <span>Context and controls</span>
                </div>
                <div className="triage-detail-grid">
                  {contextDetails.map(([label, value]) => <TriageDetailBlock key={label} label={label} value={value} />)}
                </div>
              </section>
            )}

            {followupDetails.length > 0 && (
              <section className="priority-card-section priority-card-section--followup">
                <div className="triage-card-section__head">
                  <span>Follow-up before remediation</span>
                </div>
                <div className="triage-followup-grid">
                  {followupDetails.map(([label, value]) => <TriageDetailBlock key={label} label={label} value={value} />)}
                </div>
              </section>
            )}

            {traceGroups.length > 0 && (
              <section className="priority-card-section priority-card-section--trace">
                <div className="triage-card-section__head">
                  <span>Traceability</span>
                </div>
                <div className="triage-chip-layout">
                  {traceGroups.map(([label, value]) => <TriageChipGroup key={label} label={label} items={value} />)}
                </div>
              </section>
            )}
          </article>
        );
      })}
    </div>
  );
}

function PrioritySummary({ d = {}, rows = [], totalRows = rows.length }) {
  const total = rows.length;
  const held = Math.max(totalRows - rows.length, 0);
  const critical = priorityCount(rows, 'critical');
  const high = priorityCount(rows, 'high');
  const contextItems = priorityContextItems(d.priority_considerations);
  return (
    <Panel id="priority-summary" title="Priority summary" hint="Uploaded priorities stay held until the matching triage finding is human-approved.">
      <Stats items={[
        { label: 'Ready for priority', value: total },
        { label: 'Held for approval', value: held },
        { label: 'Critical', value: critical },
        { label: 'High', value: high },
      ]} />
      <PriorityContextCards items={contextItems} />
    </Panel>
  );
}

function PrioritizationWorkflow({ d = {}, records = {} }) {
  const allRows = workflowRows(records, 'priority_queue');
  const rows = approvedPriorityRows(records);
  const hasEvidenceDetails = asArray(d.source_references).length > 0 || hasSummaryContent(d.limitations);
  const detailTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'queue', label: 'Priority queue' },
    { key: 'jira', label: 'Jira ticket' },
    ...(hasEvidenceDetails ? [{ key: 'evidence', label: 'Evidence and limitations' }] : []),
  ];
  const [activeDetail, setActiveDetail] = useState(detailTabs[0].key);
  const activeDetailKey = detailTabs.some((tab) => tab.key === activeDetail) ? activeDetail : detailTabs[0].key;

  return (
    <div className="focused-sections">
      <div className="section-tabs" role="tablist" aria-label="Prioritization detail sections">
        {detailTabs.map((tab) => (
          <button
            type="button"
            role="tab"
            key={tab.key}
            aria-selected={activeDetailKey === tab.key}
            className={`section-tab ${activeDetailKey === tab.key ? 'is-active' : ''}`}
            onClick={() => setActiveDetail(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeDetailKey === 'overview' && (
        <PrioritySummary d={d} rows={rows} totalRows={allRows.length} />
      )}

      {activeDetailKey === 'queue' && (
        <Panel id="priority-queue" title="Prioritized findings" hint="Only human-approved triage findings can enter this queue. Jira handoff follows before remediation starts.">
          <ApprovalGateNotice total={allRows.length} shown={rows.length} stage="Prioritization" />
          {rows.length > 0 ? (
            <PriorityQueueCards rows={rows} />
          ) : (
            <p className="muted">No human-approved triage findings are ready for prioritization yet. Approve findings in Triage first; rejected findings stay held back.</p>
          )}
        </Panel>
      )}

      {activeDetailKey === 'jira' && (
        rows.length > 0 ? (
          <JiraTrackingPanel
            rows={rows}
            stageKey="prioritization"
            recordKey="priority_queue"
            title="Jira ticket handoff"
            hint="Create Jira work items from prioritized findings before remediation starts."
          />
        ) : (
          <Panel id="jira-tracking" title="Jira ticket handoff" hint="Jira work can begin after triage approval and prioritization.">
            <ApprovalGateNotice total={allRows.length} shown={rows.length} stage="Prioritization" />
            <p className="muted">No Jira tickets can be created until at least one triage finding is approved and enters the priority queue.</p>
          </Panel>
        )
      )}

      {activeDetailKey === 'evidence' && <EvidenceAndLimitations d={d} />}
    </div>
  );
}

function stageStats(d, records, stageKey) {
  const refs = count(d.source_references);
  if (stageKey === 'triage') {
    const validationCount = validationDetailCount(d);
    return [
      { label: 'Triage decisions', value: workflowRows(records, 'triage_decisions').length || count(records.triage_decisions) },
      { label: 'Logical findings', value: count(records.findings) || count(d.consolidated_findings) },
      { label: 'Relationships', value: workflowRows(records, 'finding_relationships').length || count(records.finding_relationships) },
      { label: 'Need validation', value: validationCount },
    ];
  }
  if (stageKey === 'prioritization') {
    const allQueue = workflowRows(records, 'priority_queue');
    const queue = approvedPriorityRows(records);
    return [
      { label: 'Ready for priority', value: queue.length },
      { label: 'Held for approval', value: Math.max(allQueue.length - queue.length, 0) },
      { label: 'Critical', value: priorityCount(queue, 'critical') },
      { label: 'Evidence refs', value: refs },
    ];
  }
  if (stageKey === 'investigation' || stageKey === 'remediation') {
    const remediationRows = workflowRows(records, 'remediations');
    const approved = remediationRows.filter((row) => directApprovalState(row) === 'approved').length;
    const rejected = remediationRows.filter((row) => directApprovalState(row) === 'rejected').length;
    return [
      { label: 'Patch proposals', value: remediationRows.length },
      { label: 'Awaiting approval', value: Math.max(remediationRows.length - approved - rejected, 0) },
      { label: 'Approved', value: approved },
      { label: 'Rejected', value: rejected },
    ];
  }
  if (stageKey === 'fix-verification') {
    return [
      { label: 'Verification results', value: workflowRows(records, 'targeted_verifications').length },
      { label: 'Determinations', value: count(d.determinations) },
      { label: 'Scope notes', value: count(d.coverage) },
      { label: 'Evidence refs', value: refs },
    ];
  }
  if (stageKey === 'regression') {
    return [
      { label: 'Regression checks', value: workflowRows(records, 'regression_verifications').length },
      { label: 'Related paths', value: count(d.related_paths_checked) || count(d.checks_performed) },
      { label: 'Linked findings', value: count(d.linked_findings_summary) },
      { label: 'Evidence refs', value: refs },
    ];
  }
  if (stageKey === 'closure') {
    return [
      { label: 'Closure decisions', value: workflowRows(records, 'closure_assessments').length },
      { label: 'Evidence notes', value: count(d.conditional_evidence) || count(d.evidence_sufficiency_summary) },
      { label: 'Remaining requirements', value: count(d.remaining_requirements) },
      { label: 'Evidence refs', value: refs },
    ];
  }
  const primaryCount = (PRIMARY_RECORDS[stageKey] || []).reduce((sum, key) => sum + workflowRows(records, key).length, 0);
  return [
    { label: 'Stage items', value: primaryCount },
    { label: 'Evidence refs', value: refs },
    { label: 'Scope notes', value: count(d.coverage) },
    { label: 'Limitations', value: count(d.limitations) },
  ];
}

function FindingsOverview({ d = {}, records = {} }) {
  const logicalRows = consolidatedRows(d, records);
  const triageRows = cleanRows(records.triage_decisions);
  const decisionRows = triageRows.filter(isSpecificTriageDecision);
  const approvalRows = logicalRows.map((row, index) => ({
    ...row,
    _approval_decision: matchDecisionForFinding(row, decisionRows) || (decisionRows.length === logicalRows.length ? decisionRows[index] : null),
  }));
  const summaryDecisionRows = triageRows.filter((row) => !isSpecificTriageDecision(row));
  const relationshipRows = workflowRows(records, 'finding_relationships');
  const outcomeEntries = triageOutcomeEntries(d, summaryDecisionRows);
  const hasOutcome = outcomeEntries.some(([key, value]) => hasSummaryFieldContent(key, value, d));
  const showOutcomePanel = hasOutcome || (decisionRows.length === 0 && relationshipRows.length > 0);
  const hasEvidenceDetails = asArray(d.source_references).length > 0 || hasSummaryContent(d.limitations);
  const detailTabs = [
    ...(showOutcomePanel ? [{ key: 'outcome', label: 'Review outcome' }] : []),
    ...(decisionRows.length > 0
      ? [{ key: 'decisions', label: 'Triage decisions' }]
      : approvalRows.length > 0
        ? [{ key: 'findings', label: 'Consolidated findings' }]
        : []),
    ...(hasEvidenceDetails ? [{ key: 'evidence', label: 'Evidence and limitations' }] : []),
  ];
  const [activeDetail, setActiveDetail] = useState(detailTabs[0]?.key || 'outcome');
  const activeDetailKey = detailTabs.some((tab) => tab.key === activeDetail) ? activeDetail : detailTabs[0]?.key;
  return (
    <>
      {detailTabs.length > 0 && (
        <div className="focused-sections">
          {detailTabs.length > 1 && (
            <div className="section-tabs" role="tablist" aria-label="Triage detail sections">
              {detailTabs.map((tab) => (
                <button
                  type="button"
                  role="tab"
                  key={tab.key}
                  aria-selected={activeDetailKey === tab.key}
                  className={`section-tab ${activeDetailKey === tab.key ? 'is-active' : ''}`}
                  onClick={() => setActiveDetail(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {activeDetailKey === 'outcome' && showOutcomePanel && (
            <Panel id="triage-outcome" title="Review outcome" hint="Important triage conclusions without repeated raw decision dumps.">
              {hasOutcome && <SummaryCards entries={outcomeEntries} context={d} />}
              {decisionRows.length === 0 && relationshipRows.length > 0 && (
                <Disclosure title="View deduplication map" meta={`${relationshipRows.length} relationship${relationshipRows.length === 1 ? '' : 's'}`}>
                  <RecordCards rows={relationshipRows} columns={RECORD_COLUMNS.finding_relationships} recordKey="finding_relationships" />
                </Disclosure>
              )}
            </Panel>
          )}

          {activeDetailKey === 'findings' && decisionRows.length === 0 && (
            <Panel id="consolidated-findings" title="Consolidated findings" hint="One row per logical security issue, with source findings kept as supporting context.">
              {approvalRows.length > 0
                ? (
                  <DataTable
                    items={approvalRows}
                    columns={[
                      ...RECORD_COLUMNS.consolidated_findings,
                      {
                        label: 'Approval',
                        keys: ['finding_id'],
                        render: (row) => (
                          row._approval_decision?._item_key ? (
                            <ApprovalControl
                              stageKey="triage"
                              recordKey="triage_decisions"
                              itemKey={row._approval_decision._item_key}
                              value={row._approval_decision.authorization_status}
                              onDecision={(next) => {
                                if (typeof window !== 'undefined') {
                                  approvalStorageKeysFor(row).forEach((key) => window.localStorage.setItem(key, next));
                                }
                              }}
                            />
                          ) : (
                            <LocalApprovalControl finding={row} />
                          )
                        ),
                      },
                    ]}
                  />
                )
                : <p className="muted">No consolidated logical findings were reported for this stage.</p>}
            </Panel>
          )}

          {activeDetailKey === 'decisions' && decisionRows.length > 0 && (
            <Panel id="triage-decisions" title="Triage decisions" hint="Per-finding validation, classification and deduplication decisions.">
              <TriageDecisionCards rows={decisionRows} />
            </Panel>
          )}

          {activeDetailKey === 'evidence' && <EvidenceAndLimitations d={d} />}
        </div>
      )}
    </>
  );
}

function normalizedFindingToken(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findingTokens(row = {}) {
  return unique([
    row.finding_id,
    row.original_finding_id,
    row.logical_finding_id,
    row.consolidated_finding_id,
    row.remediation_id,
    row.priority_id,
    row.id,
    row.triage_evidence_ids,
    ...asArray(row.source_findings),
    ...asArray(row.source_finding_ids),
  ]
    .flatMap((value) => text(value).split(/[,;/\s]+/))
    .map(normalizedFindingToken)
    .filter(Boolean));
}

function approvalStorageKeysFor(row = {}) {
  const primary = text(first(row.finding_id, row.original_finding_id, row.logical_finding_id, row.consolidated_finding_id, row.id, row.title));
  return unique([primary, ...findingTokens(row)].filter(Boolean))
    .map((id) => `threatforge.triageApproval.${id}`);
}

function storedHumanApproval(row = {}) {
  if (typeof window === 'undefined') return row.authorization_status || 'pending';
  const values = approvalStorageKeysFor(row).map((key) => window.localStorage.getItem(key)).filter(Boolean);
  if (values.includes('approved')) return 'approved';
  if (values.includes('rejected')) return 'rejected';
  return row.authorization_status || 'pending';
}

function isHumanApproved(row = {}) {
  return storedHumanApproval(row) === 'approved';
}

function directApprovalState(row = {}) {
  const state = normalizeKey(row.authorization_status);
  if (/approved|authorized|accepted/.test(state)) return 'approved';
  if (/rejected|denied|blocked/.test(state)) return 'rejected';
  return 'pending';
}

function ApprovalGateNotice({ total, shown, stage, shownText, heldText }) {
  if (!total) return null;
  const heldMessage = heldText === null
    ? ''
    : heldText || `${total - shown} uploaded report item${total - shown === 1 ? '' : 's'} held back`;
  return (
    <div className="approval-gate-notice">
      <strong>{shown}</strong>
      <span>{shownText || `${stage} item${shown === 1 ? '' : 's'} shown after human approval`}</span>
      {heldMessage && <em>{heldMessage}</em>}
    </div>
  );
}

function matchDecisionForFinding(finding, decisionRows) {
  const tokens = findingTokens(finding);
  if (!tokens.length) return null;
  return decisionRows.find((row) => {
    const rowTokens = findingTokens(row);
    return rowTokens.some((token) => tokens.includes(token));
  }) || null;
}

function LocalApprovalControl({ finding }) {
  const [value, setValue] = useState(() => {
    return storedHumanApproval(finding);
  });
  const decide = (next) => {
    setValue(next);
    if (typeof window !== 'undefined') {
      approvalStorageKeysFor(finding).forEach((key) => window.localStorage.setItem(key, next));
    }
  };
  return (
    <div className={`approval-control ${value === 'approved' ? 'is-good' : value === 'rejected' ? 'is-bad' : 'is-working'}`}>
      <span className="approval-control__state">
        {value === 'approved' ? 'Approved' : value === 'rejected' ? 'Rejected' : 'Awaiting approval'}
      </span>
      <div className="approval-control__actions">
        <button type="button" className="btn btn--sm" onClick={() => decide('approved')}>Approve</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => decide('rejected')}>Reject</button>
      </div>
    </div>
  );
}

function StageRecords({ stageKey, records = {} }) {
  const keys = PRIMARY_RECORDS[stageKey] || [];
  const entries = keys
    .map((key) => [key, workflowRows(records, key)])
    .filter(([, rows]) => rows.length > 0);
  if (!entries.length) return null;
  return (
    <>
      {entries.map(([key, rows]) => (
        <Panel key={key} id={key} title={RECORD_TITLES[key] || titleCase(key)} hint="Compact review view. Open supporting details only when needed.">
          {key === 'priority_queue' ? (
            <>
              {(() => {
                const visibleRows = rows.filter((row) => priorityApprovalState(row, records) === 'approved');
                return visibleRows.length === 0 ? (
                  <>
                    <ApprovalGateNotice total={rows.length} shown={0} stage="Prioritization" />
                    <p className="muted">No human-approved triage findings are ready for prioritization yet.</p>
                  </>
                ) : (
                  <>
                    <ApprovalGateNotice total={rows.length} shown={visibleRows.length} stage="Prioritization" />
                    <RecordCards
                      rows={visibleRows}
                      columns={RECORD_COLUMNS[key]}
                      recordKey={key}
                      stageKey={stageKey}
                    />
                  </>
                );
              })()}
            </>
          ) : (
            <RecordCards
              rows={rows}
              columns={RECORD_COLUMNS[key]}
              recordKey={key}
              stageKey={stageKey}
              editableStatus={key === 'remediations'}
            />
          )}
        </Panel>
      ))}
    </>
  );
}

function splitReportText(value) {
  const clean = valueText(value)
    .replace(/^[,;.\s]+|[,;\s]+$/g, '')
    .trim();
  if (!clean || rawObjectLikeText(clean)) return [];
  const parts = clean
    .split(/;\s+/)
    .map((part) => part.replace(/^[,;.\s]+|[,;\s]+$/g, '').trim())
    .filter(Boolean)
    .filter((part) => !rawObjectLikeText(part) && !isBareCounter(part));
  return parts.length > 1 ? parts : [clean];
}

function remediationReportItems(value) {
  if (isPrimitive(value)) return splitReportText(value);
  if (Array.isArray(value)) {
    return uniqueTexts(value)
      .flatMap(splitReportText)
      .filter(Boolean);
  }
  return cleanSummaryPairs(value)
    .flatMap((pair) => splitReportText(pair.value).map((item) => `${pair.label}: ${item}`))
    .filter(Boolean);
}

function RemediationReportValue({ value, max = 5 }) {
  const [expanded, setExpanded] = useState(false);
  if (isEmpty(value)) return null;

  const items = unique(remediationReportItems(value));
  if (items.length === 1) return <p className="remediation-copy">{items[0]}</p>;
  const shown = expanded ? items : items.slice(0, max);
  if (!items.length) return null;
  return (
    <div className="remediation-lines">
      {shown.map((item) => <div className="remediation-line" key={item}>{item}</div>)}
      {items.length > max && (
        <button type="button" className="summary-more" onClick={() => setExpanded((on) => !on)}>
          {expanded ? 'Show less' : `+${items.length - max} more`}
        </button>
      )}
    </div>
  );
}

function JiraTicketAction({ row, stageKey = 'prioritization', recordKey = 'priority_queue', onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (busy || !row._item_key) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.createJiraIssue(row._item_key, stageKey, recordKey);
      onCreated?.(result?.record || result?.issue || {});
    } catch (err) {
      setError(err.message || 'Could not create Jira ticket.');
    } finally {
      setBusy(false);
    }
  };

  if (row.jira_key) {
    return (
      <div className="jira-stub__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={create} disabled={busy || !row._item_key}>
          {busy ? 'Syncing...' : 'Sync priority'}
        </button>
        <a className="btn btn--sm" href={row.jira_url || '#'} target="_blank" rel="noreferrer">
          Open {row.jira_key}
        </a>
        {error && <small className="jira-stub__error">{error}</small>}
      </div>
    );
  }

  return (
    <div className="jira-stub__actions">
      <button type="button" className="btn btn--primary btn--sm" onClick={create} disabled={busy || !row._item_key}>
        {busy ? 'Creating...' : 'Create Jira ticket'}
      </button>
      {error && <small className="jira-stub__error">{error}</small>}
    </div>
  );
}

function JiraTrackingPanel({
  rows,
  stageKey = 'prioritization',
  recordKey = 'priority_queue',
  title = 'Jira handoff',
  hint = 'Create live Jira work items from prioritized findings before remediation starts.',
}) {
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const updateRow = (updated) => {
    if (!updated?._item_key && !updated?.jira_key) return;
    setLocalRows((current) => current.map((row) => {
      const sameItem = updated._item_key && row._item_key === updated._item_key;
      const sameJira = updated.jira_key && row.jira_key === updated.jira_key;
      return sameItem || sameJira ? { ...row, ...updated } : row;
    }));
  };

  if (!localRows.length) return null;
  return (
    <Panel id="jira-tracking" title={title} hint={hint}>
      <div className="jira-stub-list">
        {localRows.map((row, index) => (
          <div className="jira-stub" key={row._item_key || index}>
            <span className={`jira-stub__badge ${row.jira_key ? 'is-created' : ''}`}>
              {row.jira_key ? 'Created' : 'Ready'}
            </span>
            <div>
              <strong>{text(first(row.title, row.finding_id, row.priority_id, row.remediation_id, `Work item ${index + 1}`))}</strong>
              <small>
                {row.jira_key
                  ? `Linked to ${row.jira_key}${row.jira_priority ? ` with ${row.jira_priority} priority` : ''}`
                  : `Priority ${text(first(row.priority, row.target_period, 'Medium'))} item ${text(first(row.finding_id, row.priority_id, row.remediation_id, `item ${index + 1}`))} is ready for Jira creation.`}
              </small>
            </div>
            <JiraTicketAction row={row} stageKey={stageKey} recordKey={recordKey} onCreated={updateRow} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function pathBaseName(value) {
  const clean = valueText(value).replace(/\\/g, '/');
  return clean.split('/').filter(Boolean).pop() || clean;
}

function looksLikePatchReference(value) {
  const clean = valueText(value);
  if (/\.(patch|diff)$/i.test(clean)) return true;
  if (/(^|[\\/])patch(?:es)?[\\/].+\.(md|markdown)$/i.test(clean)) return true;
  return /^[A-Z]{2,}(?:-[A-Z0-9]+)*-\d+\.(md|markdown)$/i.test(pathBaseName(clean));
}

function looksLikeTestReference(value) {
  const clean = valueText(value);
  return /\.(proposed|py|js|jsx|ts|tsx|java|go|rb|php|cs|rs|sh|ps1)$/i.test(clean)
    && /(^|[\\/])(test|tests|spec|specs)[\\/]|(?:^|[_-])test(?:\.|_|-)|(?:^|[_-])spec(?:\.|_|-)/i.test(clean);
}

function rowValue(row, key) {
  return !isEmpty(row?.[key]) ? row[key] : row?.extra?.[key];
}

function rowTextItems(row, keys) {
  return unique(keys.flatMap((key) => compactTextItems(rowValue(row, key))).filter(Boolean));
}

function patchReferenceInfo(row = {}) {
  const items = [
    rowValue(row, 'patch_reference'),
    rowValue(row, 'patch_file'),
    rowValue(row, 'patch'),
    rowValue(row, 'patch_artifact'),
  ].flatMap((value) => asArray(value)).filter((value) => !isEmpty(value));

  const info = { file: '', affectedFiles: [], changes: [] };
  items.forEach((item) => {
    if (typeof item === 'string') {
      if (looksLikePatchReference(item) && !info.file) info.file = item;
      else info.changes.push(item);
      return;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const file = first(item.file, item.path, item.filename, item.patch_file, item.patch);
    if (!isEmpty(file) && !info.file) info.file = valueText(file);
    info.affectedFiles.push(...compactTextItems(first(
      item.affected_source_files,
      item.affected_files,
      item.changed_files,
      item.modified_files,
    )));
    info.changes.push(...compactTextItems(first(
      item.primary_changes,
      item.patch_changes,
      item.changes,
      item.summary,
    )));
  });
  info.affectedFiles = unique(info.affectedFiles.filter(Boolean));
  info.changes = unique(info.changes.filter(Boolean));
  info.fileName = pathBaseName(info.file);
  return info;
}

function testReferenceInfo(row = {}) {
  const items = [
    rowValue(row, 'test_reference'),
    rowValue(row, 'test_file'),
    rowValue(row, 'test_artifact'),
    rowValue(row, 'remediation_tests'),
  ].flatMap((value) => asArray(value)).filter((value) => !isEmpty(value));

  const info = { file: '', tests: [] };
  items.forEach((item) => {
    if (typeof item === 'string') {
      if (looksLikeTestReference(item) && !info.file) info.file = item;
      else info.tests.push(item);
      return;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const file = first(item.file, item.path, item.filename, item.test_file, item.test);
    if (!isEmpty(file) && !info.file) info.file = valueText(file);
    info.tests.push(...compactTextItems(first(
      item.tests,
      item.test_cases,
      item.validation_tests,
      item.summary,
    )));
  });
  info.tests = unique(info.tests.filter(Boolean));
  info.fileName = pathBaseName(info.file);
  return info;
}

function artifactMatchesPath(artifact, path) {
  if (!artifact || !path) return false;
  const target = pathBaseName(path).toLowerCase();
  const filename = pathBaseName(artifact.filename).toLowerCase();
  return filename === target || valueText(artifact.filename).toLowerCase().endsWith(target);
}

function findPatchArtifact(artifacts = [], info = {}) {
  if (info.file) {
    const exact = artifacts.find((artifact) => artifactMatchesPath(artifact, info.file));
    if (exact) return exact;
  }
  return artifacts.find((artifact) => looksLikePatchReference(valueText(artifact.filename)) || normalizeKey(artifact.kind) === 'patch');
}

function findTestArtifact(artifacts = [], info = {}) {
  if (info.file) {
    const exact = artifacts.find((artifact) => artifactMatchesPath(artifact, info.file));
    if (exact) return exact;
  }
  return artifacts.find((artifact) => looksLikeTestReference(valueText(artifact.filename)));
}

function remediationApprovalCounts(rows) {
  const approved = rows.filter((row) => directApprovalState(row) === 'approved').length;
  const rejected = rows.filter((row) => directApprovalState(row) === 'rejected').length;
  return { approved, rejected, pending: Math.max(rows.length - approved - rejected, 0) };
}

function approvalGateText(state) {
  if (state === 'approved') return 'Approved';
  if (state === 'rejected') return 'Rejected';
  return 'Awaiting approval';
}

function parsePatchProposal(content = '') {
  const lines = String(content || '').split(/\r?\n/);
  const meta = [];
  const blocks = [];
  let section = '';
  let subsection = '';
  let inFence = false;
  let fenceLang = '';
  let code = [];

  lines.forEach((line) => {
    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      if (inFence) {
        blocks.push({
          section: section || subsection || 'Patch content',
          title: subsection || section || 'Code',
          lang: fenceLang,
          code: code.join('\n').replace(/\s+$/g, ''),
        });
        inFence = false;
        fenceLang = '';
        code = [];
      } else {
        inFence = true;
        fenceLang = fence[1] || '';
        code = [];
      }
      return;
    }

    if (inFence) {
      code.push(line);
      return;
    }

    const heading = line.match(/^(#{2,3})\s+(.+?)\s*#*$/);
    if (heading) {
      if (heading[1] === '##') {
        section = heading[2].trim();
        subsection = '';
      } else {
        subsection = heading[2].trim();
      }
      return;
    }

    const pair = line.match(/^([A-Za-z][A-Za-z0-9 /_-]{1,42}):\s*(.+)$/);
    if (pair && !section) {
      meta.push({ label: pair[1].trim(), value: pair[2].trim().replace(/^`|`$/g, '') });
    }
  });

  const replacements = [];
  const diffs = [];
  const tests = [];
  const otherBlocks = [];
  const replacementBySection = new Map();

  const ensureReplacement = (label) => {
    if (!replacementBySection.has(label)) {
      const item = { label };
      replacementBySection.set(label, item);
      replacements.push(item);
    }
    return replacementBySection.get(label);
  };

  blocks.forEach((block) => {
    const sectionKey = normalizeKey(block.section);
    const titleKey = normalizeKey(block.title);
    if (sectionKey.includes('equivalent_unified_diff') || titleKey.includes('unified_diff') || block.lang === 'diff') {
      diffs.push(block);
      return;
    }
    if (sectionKey.includes('remediation_test') || titleKey.includes('remediation_test') || /(^|_)test($|_)/.test(sectionKey)) {
      tests.push(block);
      return;
    }
    if (titleKey === 'replace_this') {
      ensureReplacement(block.section).before = block;
      return;
    }
    if (titleKey === 'with_this') {
      ensureReplacement(block.section).after = block;
      return;
    }
    otherBlocks.push(block);
  });

  return { meta, replacements, diffs, tests, otherBlocks, raw: content };
}

function PatchCodeBlock({ label, block, tone = '' }) {
  if (!block?.code) return null;
  return (
    <div className={`patch-code-block ${tone ? `patch-code-block--${tone}` : ''}`}>
      <span>{label}</span>
      <pre><code>{block.code}</code></pre>
    </div>
  );
}

function PatchInlineSection({ title, children, tone = '' }) {
  return (
    <section className={`patch-inline-section ${tone ? `patch-inline-section--${tone}` : ''}`}>
      <header>
        <span>{title}</span>
      </header>
      {children}
    </section>
  );
}

function PatchTargetSummary({ meta }) {
  const wanted = [
    ['file_path', 'File'],
    ['function_route_component', 'Route / component'],
  ];
  const items = wanted
    .map(([key, label]) => {
      const item = meta.find((entry) => normalizeKey(entry.label) === key);
      return item ? { ...item, label } : null;
    })
    .filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="patch-target-summary">
      {items.map((item) => (
        <span key={`${item.label}-${item.value}`}>
          <b>{item.label}</b>
          <em>{item.value}</em>
        </span>
      ))}
    </div>
  );
}

function PatchProposalView({ content, showEmbeddedTests = false }) {
  const parsed = parsePatchProposal(content);
  const hasStructuredContent = parsed.meta.length || parsed.replacements.length || parsed.diffs.length || parsed.tests.length || parsed.otherBlocks.length;
  if (!hasStructuredContent) {
    return <pre className="patch-preview__diff">{content}</pre>;
  }

  return (
    <div className="patch-proposal">
      <PatchTargetSummary meta={parsed.meta} />

      {parsed.replacements.length > 0 && (
        <div className="patch-change-list">
          <div className="patch-change-list__head">
            <span>{parsed.replacements.length} proposed code change{parsed.replacements.length === 1 ? '' : 's'}</span>
          </div>
          {parsed.replacements.map((item, index) => {
            const title = item.label ? item.label.replace(/^Replacement\b/i, 'Change') : `Change ${index + 1}`;
            return (
              <article className="patch-change" key={`${item.label}-${index}`}>
                <header>
                  <strong>{title}</strong>
                </header>
                <div className={`patch-change__body ${item.before && item.after ? '' : 'patch-change__body--single'}`}>
                  <PatchCodeBlock label="Current code" block={item.before} tone="before" />
                  <PatchCodeBlock label={item.before ? 'Proposed code' : 'Proposed insertion'} block={item.after} tone="after" />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {parsed.otherBlocks.map((block, index) => (
        <article className="patch-change" key={`${block.section}-${block.title}-${index}`}>
          <header><strong>{block.section || block.title}</strong></header>
          <PatchCodeBlock label={block.title || 'Code'} block={block} />
        </article>
      ))}

      {parsed.diffs.length > 0 && (
        <PatchInlineSection title="Full unified diff" tone="diff">
          {parsed.diffs.map((block, index) => <PatchCodeBlock label="Unified diff" block={block} tone="diff" key={`diff-${index}`} />)}
        </PatchInlineSection>
      )}

      {showEmbeddedTests && parsed.tests.length > 0 && (
        <PatchInlineSection title="Patch-note test snippet" tone="test">
          {parsed.tests.map((block, index) => <PatchCodeBlock label="Remediation test snippet" block={block} tone="test" key={`test-${index}`} />)}
        </PatchInlineSection>
      )}
    </div>
  );
}

function PatchDiffPreview({ artifact, reference, testArtifact, testReference }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [testContent, setTestContent] = useState('');
  const [error, setError] = useState('');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;

    setContent('');
    setTestContent('');
    setError('');
    setTestError('');

    if (artifact?.id) {
      api.artifact(artifact.id)
        .then((data) => {
          if (alive) setContent(data.content || '');
        })
        .catch((err) => {
          if (alive) setError(err.message || 'Could not load patch artifact.');
        });
    }

    if (testArtifact?.id) {
      api.artifact(testArtifact.id)
        .then((data) => {
          if (alive) setTestContent(data.content || '');
        })
        .catch((err) => {
          if (alive) setTestError(err.message || 'Could not load test artifact.');
        });
    }

    return () => { alive = false; };
  }, [open, artifact?.id, testArtifact?.id]);

  const patchLabel = artifact?.filename || reference;
  const testLabel = testArtifact?.filename || testReference;

  return (
    <details className="patch-preview" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span>Patch review</span>
        <b title={patchLabel || undefined}>{patchLabel ? pathBaseName(patchLabel) : 'Patch artifact not uploaded'}</b>
      </summary>
      {!artifact && (
        <p className="muted">Upload the referenced patch artifact with the remediation report to render the diff here.</p>
      )}
      {artifact && !content && !error && <p className="muted">Loading patch diff...</p>}
      {error && <p className="muted">{error}</p>}
      {content && <PatchProposalView content={content} showEmbeddedTests />}

      {(testArtifact || testReference) && (
        <PatchInlineSection title="Full proposed test file" tone="test">
          <b className="patch-reference-name" title={testLabel || undefined}>{pathBaseName(testLabel)}</b>
          {testArtifact && !testContent && !testError && <p className="muted">Loading proposed test...</p>}
          {testError && <p className="muted">{testError}</p>}
          {!testArtifact && <p className="muted">Upload the referenced test artifact to render the proposed test here.</p>}
          {testContent && (
            <PatchCodeBlock label="Proposed test file" block={{ code: testContent, lang: pathBaseName(testArtifact?.filename) }} tone="test" />
          )}
        </PatchInlineSection>
      )}
    </details>
  );
}

function RemediationPatchCards({ rows, artifacts = [], stageKey, onApprovalChange }) {
  if (!rows.length) return <p className="muted">No Jira-backed remediation patches are ready yet. Create Jira tickets from approved prioritized findings first.</p>;
  return (
    <div className="remediation-patch-list">
      {rows.map((row, index) => {
        const primary = recordPrimary(row, RECORD_COLUMNS.remediations, 'remediations', index);
        const approval = directApprovalState(row);
        const patchInfo = patchReferenceInfo(row);
        const patchArtifact = findPatchArtifact(artifacts, patchInfo);
        const testInfo = testReferenceInfo(row);
        const testArtifact = findTestArtifact(artifacts, testInfo);
        const affectedFiles = unique([
          ...patchInfo.affectedFiles,
          ...rowTextItems(row, ['affected_code_paths', 'changed_files']),
        ].filter(Boolean));
        const sideEffects = rowTextItems(row, ['side_effects', 'behavior_preservation']);
        const validation = rowTextItems(row, ['security_validation', 'functional_validation', 'related_path_assessment']);

        return (
          <article className={`remediation-patch-card remediation-patch-card--${approval}`} key={row._item_key || `${primary.id || primary.title}-${index}`}>
            <div className="remediation-patch-card__head">
              <div>
                <span className="workflow-record__id">{primary.id || `Patch ${index + 1}`}</span>
                <h3>{primary.title}</h3>
              </div>
              <div className="remediation-patch-card__pills">
                <TriageMetaPill label="Approval" value={approvalGateText(approval)} tone={approval === 'approved' ? 'good' : approval === 'rejected' ? 'bad' : 'medium'} />
                <ApprovalControl
                  stageKey={stageKey}
                  recordKey="remediations"
                  itemKey={row._item_key}
                  value={row.authorization_status}
                  onDecision={(next) => onApprovalChange?.(row._item_key, next)}
                />
              </div>
            </div>

            <div className="remediation-patch-story">
              <TriageDetailBlock label="Root cause" value={row.root_cause} />
              <TriageDetailBlock label="Why this patch" value={first(row.proposed_remediation, row.recommendation, row.change_description)} />
              <TriageDetailBlock label="Expected side effects" value={sideEffects} />
            </div>

            {(affectedFiles.length > 0 || validation.length > 0) && (
              <div className="remediation-patch-grid">
                <TriageChipGroup label="Affected files" items={affectedFiles} />
                <TriageChipGroup label="Validation" items={validation} />
              </div>
            )}

            <PatchDiffPreview artifact={patchArtifact} reference={patchInfo.file} testArtifact={testArtifact} testReference={testInfo.file} />
          </article>
        );
      })}
    </div>
  );
}

function RemediationStage({ d = {}, records = {}, artifacts = [], stageKey }) {
  const allRows = workflowRows(records, 'remediations');
  const jiraReadyPriorityRows = jiraBackedPriorityRows(records);
  const rows = allRows.filter((row) => matchingPriorityForFinding(row, jiraReadyPriorityRows));
  const rowsSignature = rows.map((row, index) => [
    row._item_key || index,
    directApprovalState(row),
    first(row.finding_id, row.logical_finding_id, row.original_finding_id, row.title),
    first(row.patch_file, row.patch_reference, row.proposed_patch, row.test_file),
  ].map((part) => text(part)).join(':')).join('|');
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => {
    setLocalRows(rows);
  }, [rowsSignature]);

  const counts = remediationApprovalCounts(localRows);
  const updateRemediationApproval = useCallback((itemKey, next) => {
    setLocalRows((current) => updateLocalRow(current, itemKey, { authorization_status: next }));
  }, []);
  const summaryRows = [
    ['fix', 'Fix direction', first(d.proposed_remediation_summary, d.fix_summary, d.implementation_summary)],
    ['root-cause', 'Root cause', d.root_cause_summary],
    ['requirements', 'Fix requirements', d.remediation_requirements],
    ['improvement', 'Security improvement', d.security_improvement_summary],
    ['risk', 'Residual risk', d.residual_risks],
  ].filter(([, , value]) => hasSummaryContent(value));
  const detailTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'patches', label: 'Patch approvals' },
  ];
  const [activeDetail, setActiveDetail] = useState(detailTabs[0].key);
  const activeDetailKey = detailTabs.some((tab) => tab.key === activeDetail) ? activeDetail : detailTabs[0].key;

  return (
    <div className="focused-sections">
      <div className="section-tabs" role="tablist" aria-label="Remediation detail sections">
        {detailTabs.map((tab) => (
          <button
            type="button"
            role="tab"
            key={tab.key}
            aria-selected={activeDetailKey === tab.key}
            className={`section-tab ${activeDetailKey === tab.key ? 'is-active' : ''}`}
            onClick={() => setActiveDetail(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeDetailKey === 'overview' && (
        <Panel id="remediation-overview" title="Patch proposal overview" hint="Generated code changes remain proposals until a reviewer approves them.">
          <ApprovalGateNotice
            total={allRows.length}
            shown={localRows.length}
            stage="Remediation"
            shownText={`${localRows.length} patch${localRows.length === 1 ? '' : 'es'} shown after Jira handoff`}
            heldText={null}
          />
          <Stats items={[
            { label: 'Ready patches', value: localRows.length },
            { label: 'Held until Jira', value: Math.max(allRows.length - localRows.length, 0) },
            { label: 'Awaiting approval', value: counts.pending },
            { label: 'Approved', value: counts.approved },
            { label: 'Rejected', value: counts.rejected },
          ]} />
          {summaryRows.length > 0 && (
            <div className="remediation-report">
              {summaryRows.map(([key, label, value]) => (
                <section className="remediation-report__row" key={key}>
                  <h3>{label}</h3>
                  <RemediationReportValue value={value} />
                </section>
              ))}
            </div>
          )}
        </Panel>
      )}

      {activeDetailKey === 'patches' && (
        <Panel id="remediations" title="Patch approvals" hint="Review the proposed code patch, rationale, tests and expected side effects before approving implementation.">
          <RemediationPatchCards rows={localRows} artifacts={artifacts} stageKey={stageKey} onApprovalChange={updateRemediationApproval} />
        </Panel>
      )}
    </div>
  );
}

function compactId(row, index) {
  return text(first(row.finding_id, row.logical_finding_id, row.verification_id, row.regression_check_id, row.closure_id, row.id, `Item ${index + 1}`));
}

function compactTitle(row, fallback, recordKey = '') {
  const direct = first(row.title, row.target, row.name, row.summary, row.finding_id);
  if (!isEmpty(direct)) return text(direct);
  if (recordKey === 'closure_assessments') return 'Closure assessment';
  if (recordKey === 'regression_verifications') return 'Related-path assessment';
  if (recordKey === 'targeted_verifications') return 'Fix verification result';
  return text(fallback);
}

function rowFindingIdentity(row) {
  const explicit = first(row?.finding_id, row?.logical_finding_id, row?.original_finding_id, row?.case_id);
  if (!isEmpty(explicit)) return explicit;
  const closureLikeId = text(row?.closure_id);
  if (/^[A-Z][A-Z0-9-]*-\d+/i.test(closureLikeId)) return closureLikeId;
  return undefined;
}

function findingKey(row, index) {
  return text(first(rowFindingIdentity(row), row.title, row.target, row.verification_id, row.regression_check_id, row.closure_id, `item-${index}`)).toLowerCase();
}

function isPostScanCaseSeed(row, recordKey) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  if (!isEmpty(rowFindingIdentity(row))) return true;
  if (recordKey === 'targeted_verifications') {
    return !isEmpty(row.title) && [
      row.root_cause,
      row.original_condition,
      row.post_remediation_condition,
      row.remediation_details,
      row.security_improvement,
      row.affected_area,
      row.validation_note,
      row.closure_recommendation,
    ].some((value) => !isEmpty(value));
  }
  if (recordKey === 'regression_verifications') {
    return !isEmpty(row.title) && [
      row.determination,
      row.related_paths,
      row.regression_candidates,
      row.linked_findings,
    ].some((value) => !isEmpty(value));
  }
  if (recordKey === 'closure_assessments') {
    return !isEmpty(first(row.title, row.closure_decision, row.classification, row.closure_reasoning, row.remaining_requirements));
  }
  return false;
}

function postScanCases(records = {}) {
  const buckets = new Map();
  const addRows = (key, rows) => {
    workflowRows(records, key).forEach((row, index) => {
      const hasIdentity = !isEmpty(rowFindingIdentity(row));
      if (!isPostScanCaseSeed(row, key)) return;
      const id = findingKey(row, index);
      if (key !== 'targeted_verifications' && !hasIdentity) return;
      if (!buckets.has(id)) {
        buckets.set(id, {
          key: id,
          id: compactId(row, buckets.size),
          title: compactTitle(row, compactId(row, buckets.size), key),
          verify: [],
          regression: [],
          closure: [],
        });
      }
      buckets.get(id)[key === 'targeted_verifications' ? 'verify' : key === 'regression_verifications' ? 'regression' : 'closure'].push(row);
    });
  };
  addRows('targeted_verifications', records.targeted_verifications);
  addRows('regression_verifications', records.regression_verifications);
  addRows('closure_assessments', records.closure_assessments);
  return [...buckets.values()];
}

function actualOutcome(row, keys) {
  return first(...keys.map((key) => row?.[key]));
}

function outcomeTone(value) {
  const clean = valueText(value).toLowerCase();
  if (/^(true|yes)$/.test(clean)) return 'is-good';
  if (/^(false|no)$/.test(clean)) return 'is-bad';
  if (/unable|unknown|not performed|not verified/.test(clean)) return 'is-muted';
  if (/not present|no longer present|not observed|no longer observed/.test(clean)) return 'is-good';
  if (/still|\bpresent\b|introduced|regression issue|failed|open|not fixed|not addressed|weakness remains|remaining vulnerable/.test(clean)) return 'is-bad';
  if (/partial|rework|remaining|blocked|required/.test(clean)) return 'is-risk';
  if (/verified|fixed|closed|sufficient|addressed|no longer|not observed|absent|rejected|broken/.test(clean)) return 'is-good';
  return 'is-working';
}

function outcomeLabel(value, fallback = 'Not reported') {
  const clean = valueText(value);
  if (!clean) return fallback;
  const lower = clean.toLowerCase();
  if (/^(true|yes)$/.test(lower)) return 'Verified Fixed';
  if (/^(false|no)$/.test(lower)) return 'Open';
  if (/not approved|blocked|rework required|needs rework|must be remediated|explicitly accepted/.test(lower)) return 'Rework Required';
  if (/pending verification|requires verification|unable|not performed|unknown|not verified/.test(lower)) return 'Pending Verification';
  if (/\bopen\b|still present|not fixed/.test(lower)) return 'Open';
  if (/approved for closure|closed|closure approved|fix verified/.test(lower)) return 'Closed';
  if (/new.*regression|regression.*introduced/i.test(clean)) return 'Regression Issue Found';
  if (/not present|no longer present|not observed|no longer observed/i.test(clean)) return 'Verified Fixed';
  if (/no longer|verified|fixed|absent|rejected|addressed/i.test(clean)) return 'Verified Fixed';
  if (/still present|present|failed|not fixed/i.test(clean)) return 'Still Present';
  if (/partial|rework/i.test(clean)) return 'Partially Resolved';
  if (/unable|not performed|unknown|not verified/i.test(clean)) return 'Unable to Verify';
  return clean;
}

function conciseOutcomeLabel(value, fallback = 'Recorded') {
  const label = outcomeLabel(value, fallback);
  const clean = valueText(value);
  if (!clean) return fallback;
  return label === clean && clean.length > 56 ? fallback : label;
}

function evidenceItems(row, keys) {
  return unique(keys.flatMap((key) => remediationReportItems(row?.[key] || []))).filter(Boolean);
}

function dataItems(data, keys) {
  return unique(keys.flatMap((key) => remediationReportItems(data?.[key] || []))).filter(Boolean);
}

function dataRefs(data) {
  return unique(asArray(data?.source_references).map(labelOf).map(text).filter(Boolean));
}

function hasAnyDataValue(data, keys) {
  return keys.some((key) => hasSummaryContent(data?.[key]));
}

function BriefValue({ value, empty = 'None reported.' }) {
  return hasSummaryContent(value) ? <RemediationReportValue value={value} /> : <p className="muted">{empty}</p>;
}

function metricValue(value, names) {
  const direct = classificationMetricValue(value, names);
  if (!isEmpty(direct)) return direct;
  const wanted = new Set(names.map(normalizeKey));
  const visit = (node) => {
    if (isEmpty(node)) return undefined;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (!isEmpty(found)) return found;
      }
      return undefined;
    }
    if (node && typeof node === 'object') {
      const directKey = Object.entries(node).find(([key]) => wanted.has(normalizeKey(key)));
      if (directKey) return directKey[1];
      const labeled = first(node.name, node.label, node.key, node.rawLabel);
      if (!isEmpty(labeled) && wanted.has(normalizeKey(labeled))) return first(node.value, node.count, node.total);
      for (const child of Object.values(node)) {
        const found = visit(child);
        if (!isEmpty(found)) return found;
      }
    }
    return undefined;
  };
  return visit(value);
}

function metricNumber(value, names) {
  const raw = metricValue(value, names);
  if (isEmpty(raw)) return undefined;
  const parsed = Number(valueText(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function verificationSummaryStatus(stageData = {}, rows = []) {
  const summary = first(stageData.verification_summary, stageData.classification_summary);
  const total = metricNumber(summary, ['total_findings_verified', 'total findings verified']);
  const fixed = metricNumber(summary, ['verified_fixed', 'verified fixed']);
  const still = metricNumber(summary, ['still_present', 'still present']);
  const partial = metricNumber(summary, ['partially_resolved', 'partially resolved']);
  const unable = metricNumber(summary, ['unable_to_verify', 'unable to verify']);
  if ([total, fixed, still, partial, unable].some((value) => value !== undefined)) {
    if ((still || 0) > 0) return 'Still Present';
    if ((partial || 0) > 0) return 'Partially Resolved';
    if ((unable || 0) > 0) return 'Unable to Verify';
    if ((fixed || 0) > 0 && (total === undefined || fixed === total)) return 'Verified Fixed';
  }
  return actualOutcome(rows[0], ['result', 'classification', 'root_cause_addressed', 'attack_path_status', 'security_control_status'])
    || first(stageData.classification_summary, stageData.determinations);
}

function relatedPathStatus(stageData = {}, rows = []) {
  const summary = stageData.classification_summary;
  const regressionIssue = metricNumber(summary, ['new_or_regression_issue_introduced', 'new or regression issue introduced', 'regression_issue_found']);
  const noWeakness = metricNumber(summary, ['security_weakness_no_longer_observed', 'security weakness no longer observed', 'no_related_issue_observed']);
  const stillPresent = metricNumber(summary, ['same_weakness_still_present', 'same weakness still present', 'still_present']);
  if ([regressionIssue, noWeakness, stillPresent].some((value) => value !== undefined)) {
    if ((regressionIssue || 0) > 0) return 'Regression Issue Found';
    if ((stillPresent || 0) > 0) return 'Still Present';
    if ((noWeakness || 0) > 0) return 'No related issue observed';
  }
  return actualOutcome(rows[0], ['classification', 'determination', 'regression_status', 'attack_path_reachability'])
    || first(stageData.determination_summary, stageData.classification_summary, stageData.regression_summary);
}

function closureStatus(stageData = {}, rows = [], verifyRows = []) {
  const summary = first(stageData.decision_summary, stageData.closure_determinations, stageData.classification_summary, stageData.evidence_sufficiency_summary);
  return actualOutcome(rows[0], ['closure_decision', 'classification', 'closure_recommendation', 'evidence_sufficient'])
    || actualOutcome(verifyRows[0], ['closure_recommendation'])
    || summary;
}

function stageTextItems(data = {}, keys = []) {
  return unique(keys.flatMap((key) => remediationReportItems(data?.[key] || []))).filter(Boolean);
}

function recordTextItems(rows = [], keys = []) {
  return unique(rows.flatMap((row) => keys.flatMap((key) => remediationReportItems(row?.[key] || [])))).filter(Boolean);
}

function verificationExcludedFindings(verifyData = {}) {
  return stageTextItems(verifyData, ['excluded_findings', 'exclusions', 'not_verified_findings']);
}

function verificationRelatedReview(verifyData = {}) {
  return first(
    verifyData.related_path_review,
    verifyData.related_paths_review,
    verifyData.related_path_summary,
    verifyData.regression_summary,
    verifyData.coverage,
  );
}

function workflowStats(records = {}, stageDataByKey = {}) {
  const verifyData = stageDataByKey['fix-verification'] || {};
  const regressionData = stageDataByKey.regression || {};
  const verifyRows = workflowRows(records, 'targeted_verifications');
  const regressionRows = workflowRows(records, 'regression_verifications');
  const summary = first(verifyData.verification_summary, verifyData.classification_summary);
  const total = metricNumber(summary, ['total_findings_verified', 'total findings verified']) ?? verifyRows.length;
  const fixed = metricNumber(summary, ['verified_fixed', 'verified fixed']);
  const still = metricNumber(summary, ['still_present', 'still present']) || 0;
  const partial = metricNumber(summary, ['partially_resolved', 'partially resolved']) || 0;
  const unable = metricNumber(summary, ['unable_to_verify', 'unable to verify']) || 0;
  const remaining = still + partial + unable;
  const refs = unique(Object.values(stageDataByKey).flatMap(dataRefs));
  const limitations = unique(Object.values(stageDataByKey).flatMap((data) => dataItems(data, ['limitations'])));
  const excluded = verificationExcludedFindings(verifyData);
  return [
    { label: 'Findings verified', value: total },
    { label: 'Verified fixed', value: fixed ?? verifyRows.filter((row) => outcomeLabel(actualOutcome(row, ['result', 'classification']), '').toLowerCase().includes('verified')).length },
    { label: 'Remaining', value: remaining },
    { label: 'Not verified', value: excluded.length },
    { label: 'Related-path checks', value: regressionRows.length || count(regressionData.checks_performed) || count(regressionData.classification_summary) },
    { label: 'Evidence refs', value: refs.length },
    { label: 'Limitations', value: limitations.length },
  ].filter((item) => item.value !== undefined && item.value !== '' && !(typeof item.value === 'number' && item.value === 0 && item.label !== 'Remaining'));
}

function limitationGroups(items = []) {
  const groups = [
    { key: 'testing', title: 'Testing boundary', pattern: /test|focused|source review|runtime|executed|payload|scan|validation|verification/i, rows: [] },
    { key: 'environment', title: 'Environment assumptions', pattern: /production|localhost|deployment|dns|network|resolver|internet|isolation|privilege|environment|dependency|version|lockfile/i, rows: [] },
    { key: 'coverage', title: 'Coverage and data gaps', pattern: /unknown|not available|missing|not supplied|scope|coverage|context|sensitivity|regulatory|business/i, rows: [] },
    { key: 'compatibility', title: 'Behavior changes', pattern: /changed|format|invalid|migrat|compat|previously|cookies|output/i, rows: [] },
  ];
  const fallback = { key: 'other', title: 'Other constraints', rows: [] };
  items.forEach((item) => {
    const target = groups.find((group) => group.pattern.test(item)) || fallback;
    target.rows.push(item);
  });
  return [...groups, fallback].filter((group) => group.rows.length);
}

function WorkflowStory({ records = {}, stageDataByKey = {} }) {
  const verifyData = stageDataByKey['fix-verification'] || {};
  const regressionData = stageDataByKey.regression || {};
  const closureData = stageDataByKey.closure || {};
  const verifyRows = workflowRows(records, 'targeted_verifications');
  const regressionRows = workflowRows(records, 'regression_verifications');
  const closureRows = workflowRows(records, 'closure_assessments');
  const relatedReview = verificationRelatedReview(verifyData);
  const regressionOutcome = relatedPathStatus(regressionData, regressionRows) || (hasSummaryContent(relatedReview) ? 'Related-path review recorded' : '');
  const relatedEvidence = unique([
    ...regressionRows.flatMap((row) => evidenceItems(row, ['evidence', 'evidence_references', 'new_or_regression_issues', 'same_weakness_instances', 'coverage'])),
    ...dataItems(regressionData, ['checks_performed', 'coverage']),
    ...stageTextItems(verifyData, ['related_path_review', 'related_paths_review', 'related_path_summary']),
    ...dataRefs(regressionData),
  ]).filter(Boolean);
  const closureOutcome = closureStatus(closureData, closureRows, verifyRows);
  const closureEvidence = unique([
    ...closureRows.flatMap((row) => evidenceItems(row, [
      'closure_reasoning',
      'closure_reason',
      'evidence',
      'evidence_references',
      'evidence_sufficient',
      'weakness_addressed',
      'remaining_requirements',
      'verification_reference',
      'regression_reference',
    ])),
    ...verifyRows.flatMap((row) => evidenceItems(row, ['closure_recommendation'])),
    ...dataItems(closureData, [
      'decision_summary',
      'closure_summary',
      'closure_determinations',
      'evidence_sufficiency_summary',
      'remaining_requirements',
      'conditional_evidence',
    ]),
    ...dataRefs(closureData),
  ]).filter(Boolean);
  const hasClosure = closureRows.length || hasSummaryContent(closureData) || closureEvidence.length;

  return (
    <div className="verification-story">
      <section>
        <span>Check related paths</span>
        <strong className={outcomeTone(regressionOutcome)}>{conciseOutcomeLabel(regressionOutcome, regressionRows.length || hasSummaryContent(relatedReview) ? 'Related-path review recorded' : 'Not reported')}</strong>
        <div className="verification-story__evidence">
          <em>Key evidence</em>
          <BriefValue value={relatedEvidence} empty="No related-path evidence reported." />
        </div>
      </section>
      {hasClosure && (
        <section>
          <span>Closure decision</span>
          <strong className={outcomeTone(closureOutcome)}>{conciseOutcomeLabel(closureOutcome, 'Closure review recorded')}</strong>
          <div className="verification-story__evidence">
            <em>Decision evidence</em>
            <BriefValue value={closureEvidence} empty="No closure evidence reported." />
          </div>
        </section>
      )}
    </div>
  );
}

function EvidenceSummary({ title = 'Key evidence', items = [], max = 4 }) {
  const clean = unique(items).filter(Boolean);
  if (!clean.length) return <p className="muted">None.</p>;
  return (
    <div className="verification-evidence">
      <h4>{title}</h4>
      <div className="remediation-lines">
        {clean.slice(0, max).map((item) => <div className="remediation-line" key={item}>{item}</div>)}
      </div>
      {clean.length > max && (
        <Disclosure title="View remaining evidence" meta={`${clean.length - max} more`}>
          <div className="remediation-lines">
            {clean.slice(max).map((item) => <div className="remediation-line" key={item}>{item}</div>)}
          </div>
        </Disclosure>
      )}
    </div>
  );
}

function VerificationLimitGroups({ items = [] }) {
  const clean = unique(items).filter(Boolean);
  if (!clean.length) return null;
  const groups = limitationGroups(clean);
  return (
    <div className="verification-evidence verification-evidence--limits">
      <h4>Verification limits</h4>
      <div className="verification-limit-board__grid">
        {groups.map((group) => (
          <article className="verification-limit-group" key={group.key}>
            <span>{group.title}</span>
            {group.rows.map((item) => <p key={item}>{item}</p>)}
          </article>
        ))}
      </div>
    </div>
  );
}

function CompactFindingList({ cases, selectedKey, onSelect }) {
  if (!cases.length) return <p className="muted">No verified-fix records reported.</p>;
  return (
    <div className="verification-list">
      {cases.map((item) => {
        return (
          <button
            type="button"
            className={`verification-list__row ${selectedKey === item.key ? 'is-selected' : ''}`}
            onClick={() => onSelect(item.key)}
            key={item.key}
          >
            <span className="verification-list__id">{item.id}</span>
            <span className="verification-list__text">
              <strong>{item.title}</strong>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function VerifyFixDetail({ item, stageData = {} }) {
  const rows = item?.verify || [];
  const hasStageData = hasAnyDataValue(stageData, ['scope', 'verification_summary', 'validation_checks', 'determinations', 'comparison_summary', 'classification_summary', 'conditions_and_evidence', 'coverage', 'limitations', 'excluded_findings']);
  if (!rows.length && !hasStageData) return <p className="muted">No original-fix verification result reported.</p>;
  const primary = rows[0] || {};
  const limitations = [
    ...recordTextItems(rows, ['limitations']),
    ...stageTextItems(stageData, ['limitations']),
  ];
  return (
    <div className="verification-detail">
      <div className="verification-detail__grid">
        <section>
          <h3>Original weakness</h3>
          <BriefValue value={first(primary.root_cause, primary.original_condition)} empty="Not separately reported." />
        </section>
        <section>
          <h3>Implemented fix reviewed</h3>
          <BriefValue value={first(primary.post_remediation_condition, primary.remediation_details, primary.security_improvement, stageData.comparison_summary)} />
        </section>
        <section>
          <h3>Technical conclusion</h3>
          <BriefValue value={first(primary.validation_note, primary.security_improvement, primary.validation_results, stageData.determinations)} />
        </section>
        <section>
          <h3>Validation checks</h3>
          <BriefValue value={first(primary.validation_checks, primary.validation_results, stageData.validation_checks)} empty="No check details reported." />
        </section>
      </div>
      {limitations.length > 0 && <VerificationLimitGroups items={limitations} />}
    </div>
  );
}

function VerifiedFixesWorkflow({ d = {}, records = {}, stageDataByKey = {} }) {
  const workflowData = Object.keys(stageDataByKey).length ? stageDataByKey : { 'fix-verification': d };
  const verifyData = workflowData['fix-verification'] || {};
  const verifyRows = workflowRows(records, 'targeted_verifications');
  const hasStageSummary = Object.values(workflowData).some((data) => hasAnyDataValue(data, [
    'verification_summary',
    'scope',
    'determination_summary',
    'classification_summary',
    'limitations',
  ]));
  const recordCases = postScanCases(records);
  const cases = recordCases.length ? recordCases : (hasStageSummary ? [{
    key: 'phase-4-summary',
    id: 'Phase 4',
    title: 'Verified fix summary',
    summaryOutcome: verificationSummaryStatus(verifyData, verifyRows),
    verify: [],
    regression: [],
    closure: [],
  }] : []);
  const [selectedKey, setSelectedKey] = useState(cases[0]?.key || '');
  const selected = cases.find((item) => item.key === selectedKey) || cases[0];
  const stats = workflowStats(records, workflowData);

  return (
    <div className="verification-workflow">
      <section id="verification-workflow" className="panel">
        <div className="panel__body stack-sm">
          <Stats items={stats} />
          <WorkflowStory records={records} stageDataByKey={workflowData} />

          <div className="verification-layout">
            <div className="verification-layout__head">
              <h3>Findings</h3>
              <span>{cases.length || 'None'}</span>
            </div>
            <CompactFindingList cases={cases} selectedKey={selected?.key} onSelect={setSelectedKey} />
            <main>
              {selected ? (
                <>
                  <div className="verification-selected">
                    <span>{selected.id}</span>
                    <h3>{selected.title}</h3>
                  </div>
                  <VerifyFixDetail item={selected} stageData={verifyData} />
                </>
              ) : (
                <p className="muted">No verified-fix records have been uploaded yet.</p>
              )}
            </main>
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkflowStage({ d = {}, records = {}, stageKey, artifacts = [] }) {
  if (stageKey === 'prioritization') {
    return <PrioritizationWorkflow d={d} records={records} />;
  }

  if (stageKey === 'investigation' || stageKey === 'remediation') {
    return <RemediationStage d={d} records={records} artifacts={artifacts} stageKey={stageKey} />;
  }

  return (
    <>
      <Panel id="stage-summary" title="Stage summary" hint="The decision context for this workflow step.">
        <Stats items={stageStats(d, records, stageKey)} />
        <SummaryFields d={d} stageKey={stageKey} />
      </Panel>

      <StageRecords stageKey={stageKey} records={records} />
      <EvidenceAndLimitations d={d} />
    </>
  );
}

export default function LifecycleStage({ stageKey, title, eyebrow = 'ThreatForge workflow', view = 'stage', extraStageKeys = [], initialWorkflowStep = 'verify', showHeader = true }) {
  const extraStageSignature = extraStageKeys.join('|');
  const fn = useCallback(async () => {
    const keys = [stageKey, ...extraStageKeys].filter(Boolean);
    const payloads = await Promise.all(keys.map((key) => api.lifecycleStage(key)));
    const merged = mergeLifecyclePayloads(payloads);
    if (!merged) return merged;
    return {
      ...merged,
      stageDataByKey: Object.fromEntries(keys.map((key, index) => [key, payloads[index]?.data || {}])),
    };
  }, [stageKey, extraStageSignature]);
  const { data, loading, error, reload } = useApi(fn, `lifecycle:${stageKey}:${extraStageSignature}`);
  const statusFn = useCallback(() => api.status(), []);
  const { data: statusData, loading: statusLoading, error: statusError } = useApi(statusFn, 'status');
  const d = data?.data || {};
  const records = data?.records || {};
  const artifacts = data?.artifacts || [];
  const stageDataByKey = data?.stageDataByKey || {};
  const stageKeys = [stageKey, ...extraStageKeys].filter(Boolean);
  const stageStatuses = (statusData?.stages || []).filter((stage) => stageKeys.includes(stage.key));
  const hasStageOverview = count(d) > 0;
  const stageWasUploaded = hasStageOverview || stageStatuses.some((stage) => Number(stage?.runs || 0) > 0);
  const primaryRecordKeys = view === 'verification-workflow'
    ? ['targeted_verifications', 'regression_verifications', 'closure_assessments']
    : (PRIMARY_RECORDS[stageKey] || []);
  const primaryRows = primaryRecordKeys.reduce((sum, key) => sum + workflowRows(records, key).length, 0);
  const overviewRows = view === 'overview' ? consolidatedRows(d, records).length : 0;
  const hasMappedData = stageWasUploaded && (hasStageOverview || primaryRows > 0 || overviewRows > 0);
  const loadingAny = loading || statusLoading;
  const errorAny = error || statusError;

  return (
    <PageShell
      eyebrow={eyebrow}
      title={title || data?.label || 'Workflow stage'}
      description={view === 'verification-workflow'
        ? 'Remediation moves through one review path: verify the original fix, check related paths, then decide closure.'
        : DESCRIPTIONS[stageKey] || 'Mapped review records and evidence links for the selected codebase.'}
      state={{ loading: loadingAny, error: errorAny, hasData: hasMappedData }}
      emptyTitle={`${title || 'This stage'} has not been uploaded yet`}
      emptyText="Upload the matching output files for this phase. Data from other phases stays on its own page."
      sections={[]}
      sectionData={{}}
      showHeader={showHeader}
    >
      {view === 'overview'
        ? <FindingsOverview d={d} records={records} />
        : view === 'verification-workflow'
          ? <VerifiedFixesWorkflow d={d} records={records} stageDataByKey={stageDataByKey} />
        : <WorkflowStage d={d} records={records} artifacts={artifacts} stageKey={stageKey} />}
    </PageShell>
  );
}
