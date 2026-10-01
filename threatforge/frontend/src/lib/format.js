export const isEmpty = (v) =>
  v == null ||
  (typeof v === 'string' && !v.trim()) ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

export const titleCase = (k) => String(k).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const cleanPresentationText = (value) =>
  String(value ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/"{2,}|'{2,}/g, '')
    .replace(/^\s*["']|["']\s*$/g, '')
    .replace(/([.!?]){2,}/g, '$1')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

export const humanizeEnumValue = (value) => {
  const text = cleanPresentationText(value);
  if (!text) return '';
  const looksLikeEnum =
    text.length <= 64 &&
    /_/.test(text) &&
    /^[A-Za-z][A-Za-z0-9_-]*$/.test(text);
  if (!looksLikeEnum) return text;
  return text
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bCwe\b/g, 'CWE')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bJwt\b/g, 'JWT')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bXss\b/g, 'XSS')
    .replace(/\bOs\b/g, 'OS');
};

const SOURCE_REF_RE = /\b(?:[A-Za-z0-9_.@~+/-]+\.(?:py|js|jsx|ts|tsx|mjs|cjs|md|txt|json|yaml|yml|toml|xml|html|css|scss|sql|java|kt|go|rs|rb|php|cs|cpp|hpp|h|c|sh|ps1|bat|cfg|ini|conf|lock|gradle|properties|env)(?::\d+(?:-\d+)?)?|Dockerfile(?::\d+(?:-\d+)?)?)\b/g;

function unique(list) {
  const seen = new Set();
  return list.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanupEvidenceBody(value) {
  return cleanPresentationText(value)
    .replace(/\s*,\s*(?=[.;,]|$)/g, '')
    .replace(/\s*;\s*(?=[.;,]|$)/g, '')
    .replace(/\.\s*[,;]\s*/g, '. ')
    .replace(/,\s*[;.]\s*/g, '. ')
    .replace(/;\s*[,.]\s*/g, '; ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;.\s]+|[,;\s]+$/g, '')
    .trim();
}

export function splitEvidence(value) {
  const text = cleanPresentationText(value);
  if (!/\bEvidence:\s*/i.test(text)) return { text, refs: [] };

  const evidenceText = text.split(/\bEvidence:\s*/i).slice(1).join(' ');
  const refs = unique((evidenceText.match(SOURCE_REF_RE) || []).map((item) => cleanPresentationText(item)));
  if (!refs.length) {
    const fallback = text.match(/\bEvidence:\s*(.+)$/i);
    const body = fallback ? cleanupEvidenceBody(text.slice(0, fallback.index)) : text;
    const ref = fallback ? cleanPresentationText(fallback[1]).replace(/[.;]\s*$/, '') : '';
    return { text: body, refs: ref && ref.length < 90 ? [ref] : [] };
  }

  let body = text.replace(/\bEvidence:\s*/gi, '');
  refs.forEach((ref) => {
    body = body.split(ref).join('');
  });
  body = cleanupEvidenceBody(body);
  return { text: body, refs };
}

export function splitLeadingLabel(value) {
  const text = cleanPresentationText(value);
  const match = text.match(/^([A-Za-z][A-Za-z0-9 /_-]{1,52}):\s*(.+)$/);
  if (!match) return { label: '', text };
  return { label: titleCase(match[1]), text: match[2] };
}

const LABEL_KEYS = [
  'name', 'title', 'component_id', 'interface_id', 'store_id', 'flow_id', 'integration_id',
  'control_id', 'threat_id', 'scenario', 'target', 'service', 'path_or_interface', 'id',
  'interface', 'value', 'item', 'file_or_location',
];

export function labelOf(x) {
  if (x == null) return '';
  if (typeof x !== 'object') return cleanPresentationText(x);
  for (const k of LABEL_KEYS) {
    if (!isEmpty(x[k]) && typeof x[k] !== 'object') return cleanPresentationText(x[k]);
  }
  const firstText = Object.values(x).find((v) => typeof v === 'string' && v.trim());
  return firstText ? cleanPresentationText(firstText) : JSON.stringify(x).slice(0, 80);
}

export const asArray = (v) => (Array.isArray(v) ? v : isEmpty(v) ? [] : [v]);
export const count = (v) => (Array.isArray(v) ? v.length : isEmpty(v) ? 0 : 1);

export const fmtDate = (s) => (s ? new Date(s).toLocaleString() : '-');
export const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
