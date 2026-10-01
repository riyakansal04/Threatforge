import { titleCase } from '../lib/format.js';

export default function Counts({ counts }) {
  const lines = [];
  Object.entries(counts || {}).forEach(([k, v]) => {
    if (typeof v === 'number') lines.push(`${titleCase(k)}: ${v}`);
    else if (v && 'added' in v) lines.push(`${titleCase(k)}: ${v.added} new, ${v.already_known} already known`);
    else if (v && 'listed' in v) lines.push(`Manifest: ${v.verified} of ${v.listed} listed files verified`);
  });
  if (!lines.length) return <span className="muted">-</span>;
  return <ul className="bullets">{lines.map((l) => <li key={l}>{l}</li>)}</ul>;
}
