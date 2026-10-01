import { cleanPresentationText, humanizeEnumValue, isEmpty, splitEvidence, titleCase, labelOf } from '../lib/format.js';

const REF_KEY = /(source_references|evidence_references)$/;

function normalizeThreatId(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/\bT\d+\b/gi);
  return match ? match[0].toUpperCase() : null;
}

function ThreatLink({ value, context }) {
  const id = normalizeThreatId(value);
  if (!id) return <>{String(value)}</>;
  const summary = [context?.scenario, context?.actor, context?.impact, context?.description]
    .filter(Boolean)
    .join(' | ');
  return (
    <button type="button" className="threat-link" title={summary || `Threat ${id}`}>
      {id}
    </button>
  );
}

function SourcePills({ refs }) {
  if (!refs?.length) return null;
  return <span className="source-pills">{refs.map((ref) => <span className="source-pill" key={ref}>{ref}</span>)}</span>;
}

function TextList({ items, context }) {
  return (
    <div className="value-list">
      {items.map((item, i) => {
        const { text, refs } = splitEvidence(item);
        return (
          <div className="value-list__row" key={`${text}-${i}`}>
            {normalizeThreatId(text) ? <ThreatLink value={text} context={context} /> : <span>{cleanPresentationText(text || item)}</span>}
            <SourcePills refs={refs} />
          </div>
        );
      })}
    </div>
  );
}

export function Refs({ refs }) {
  const list = Array.isArray(refs) ? refs : [refs];
  return (
    <ul className="refs">
      {list.map((r, i) => {
        if (typeof r === 'string') return <li key={i}><code>{cleanPresentationText(r)}</code></li>;
        const line = r.line_or_range_if_available ? `:${r.line_or_range_if_available}` : '';
        return (
          <li key={i}>
            <code>{cleanPresentationText(r.file_or_location)}{line}</code>
            {r.description && <span className="muted"> {cleanPresentationText(r.description)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function Val({ v, k, compact = false, context = {} }) {
  if (isEmpty(v)) return <span className="muted">-</span>;
  if (k && REF_KEY.test(k) && Array.isArray(v)) return <Refs refs={v} />;
  if (typeof v !== 'object') {
    if (typeof v === 'string' && normalizeThreatId(v)) return <ThreatLink value={v} context={context} />;
    if (typeof v === 'string') {
      const { text, refs } = splitEvidence(v);
      if (compact || !refs.length) return <>{humanizeEnumValue(text || v)}</>;
      return (
        <span className="value-with-sources">
          <span>{text}</span>
          <SourcePills refs={refs} />
        </span>
      );
    }
    return <>{humanizeEnumValue(v)}</>;
  }

  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== 'object')) {
      const seen = new Set();
      const items = v
        .map((x) => {
          if (typeof x !== 'string') return x;
          return humanizeEnumValue(x);
        })
        .filter((x) => {
          const { text } = typeof x === 'string' ? splitEvidence(x) : { text: x };
          const key = cleanPresentationText(text || x).toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      if (!compact && items.some((x) => String(x).length > 52 || /\bEvidence:\s*/i.test(String(x)))) {
        return <TextList items={items} context={context} />;
      }
      return <span className="chips">{items.map((x, i) => {
        if (typeof x === 'string' && normalizeThreatId(x)) {
          return <ThreatLink key={i} value={x} context={context} />;
        }
        const { text } = typeof x === 'string' ? splitEvidence(x) : { text: x };
        return <span className="chip" key={i}>{humanizeEnumValue(text || x)}</span>;
      })}</span>;
    }
    if (compact) {
      return <span className="chips">{v.map((x, i) => <span className="chip" key={i}>{labelOf(x)}</span>)}</span>;
    }
    return <ul className="mini-list">{v.map((x, i) => <li key={i}><Val v={x} /></li>)}</ul>;
  }

  if (compact) return <>{labelOf(v)}</>;
  return (
    <dl className="kv">
      {Object.entries(v)
        .filter(([, x]) => !isEmpty(x))
        .map(([kk, x]) => (
          <div key={kk} className="kv__row">
            <dt>{titleCase(kk)}</dt>
            <dd><Val v={x} k={kk} context={v} /></dd>
          </div>
        ))}
    </dl>
  );
}
