export const SCAN_LABELS = {
  standard: 'Standard',
  deep: 'Deep',
  module: 'Module',
  exploitable: 'Exploitable',
  supply_chain: 'Supply-chain / dependency',
  runtime: 'Runtime / dynamic',
};

export const SCAN_TYPES = ['standard', 'deep', 'module', 'exploitable', 'supply_chain', 'runtime'];

export const SCAN_STAGE_LABELS = {
  'standard-scan': 'Standard scan',
  'deep-scan': 'Deep scan',
  'module-scan': 'Module scan',
  'exploitable-scan': 'Exploitable scan',
  'dependency-scan': 'Supply-chain / dependency scan',
  'runtime-validation': 'Runtime / dynamic validation',
};

import { cleanPresentationText, isEmpty } from './format.js';

export const str = (v) =>
  v == null ? '' : Array.isArray(v) ? v.map(str).filter(Boolean).join(', ') : typeof v === 'object' ? '' : String(v);

export const shortId = (value) => {
  const s = String(value || '');
  if (!s) return '';
  if (s.startsWith('SCAN-')) return s;
  return s.length > 12 ? `${s.slice(0, 8)}...${s.slice(-4)}` : s;
};

export const compactValue = (value) => {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(compactValue).filter(Boolean).slice(0, 3).join(', ');
  const preferred = ['name', 'title', 'target', 'target_type', 'target_kind', 'module', 'component', 'scope', 'summary', 'repository'];
  for (const key of preferred) {
    const v = value[key];
    if (v != null && typeof v !== 'object' && String(v).trim()) return String(v);
  }
  return Object.entries(value)
    .filter(([, v]) => v != null && typeof v !== 'object' && String(v).trim())
    .slice(0, 2)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(', ');
};

export const sevOf = (f) => f.severity || f.attributes?.sarif_level || '';
export const nameOf = (f) => f.title || f.finding_id || str(f.affected_dependency) || f.category || 'Finding';

export function sevClass(s) {
  const k = String(s || '').toLowerCase();
  if (k.includes('moderate')) return 'medium';
  return ['critical', 'high', 'medium', 'low', 'info'].find((x) => k.includes(x)) || 'none';
}

const SCOPE_ONLY_RE = /\b(authentication and authorization|apis? and interfaces|business-critical|security controls and trust boundaries|external integrations|dependencies and configuration|target-specific risks|assessment scope|coverage scope)\b/i;
const FINDING_TEXT_RE = /\b(vulnerab|injection|xss|csrf|deserial|auth|bypass|exposure|disclosure|leak|secret|credential|token|cookie|command|path traversal|ssrf|xxe|misconfig|weak|risk|exploit|cwe-|cve-)\b/i;

const textOf = (...values) => values.map((value) => cleanPresentationText(str(value))).filter(Boolean).join(' ');
const hasList = (value) => Array.isArray(value) && value.length > 0;

export function isDisplayableFinding(f = {}) {
  if (!f || typeof f !== 'object') return false;
  const title = cleanPresentationText(str(f.title || f.finding_id || ''));
  const summary = textOf(
    title,
    f.description,
    f.category,
    f.root_cause,
    f.impact,
    f.recommended_remediation,
    f.observed_behavior,
    f.expected_behavior,
  );
  const hasSeverity = sevClass(sevOf(f)) !== 'none';
  const hasSecurityId = !isEmpty(f.cwe) || !isEmpty(f.security_identifier);
  const hasFindingId = !isEmpty(f.finding_id);
  const hasFindingBody = [
    f.description,
    f.root_cause,
    f.impact,
    f.attack_path,
    f.recommended_remediation,
    f.observed_behavior,
    f.expected_behavior,
    f.runtime_validation,
    f.dependency,
  ].some((value) => !isEmpty(value));
  const hasAffectedTarget = !isEmpty(f.affected_area) || !isEmpty(f.affected_dependency) || !isEmpty(f.runtime_target) || !isEmpty(f.code_location);
  const hasReviewSignal = !isEmpty(f.classification) || !isEmpty(f.confidence);
  const hasEvidence = hasList(f.evidence_items) || hasList(f.source_references) || !isEmpty(f.evidence);
  const looksLikeScopeOnly = !hasSeverity && !hasSecurityId && !hasFindingBody && !hasAffectedTarget && SCOPE_ONLY_RE.test(summary);
  if (looksLikeScopeOnly) return false;
  if (hasSecurityId || hasSeverity) return hasFindingId || hasFindingBody || hasAffectedTarget || FINDING_TEXT_RE.test(summary);
  if (hasFindingBody && (hasAffectedTarget || hasReviewSignal || hasEvidence || FINDING_TEXT_RE.test(summary))) return true;
  if (hasFindingId && (hasReviewSignal || hasEvidence || hasAffectedTarget || FINDING_TEXT_RE.test(summary))) return true;
  return false;
}
