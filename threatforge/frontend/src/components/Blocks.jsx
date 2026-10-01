import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DataTable from './DataTable.jsx';
import { Val, Refs } from './Val.jsx';
import { asArray, cleanPresentationText, isEmpty, splitEvidence, splitLeadingLabel, titleCase } from '../lib/format.js';
import { COLS, FIELD_LABELS } from '../lib/columns.js';

export function Panel({ id, title, hint, children }) {
  return (
    <section id={id} className="panel">
      <header className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {hint && <p className="panel__hint">{hint}</p>}
      </header>
      <div className="panel__body stack-sm">{children}</div>
    </section>
  );
}

function SourcePills({ refs }) {
  if (!refs?.length) return null;
  return (
    <div className="source-pills">
      {refs.map((ref) => <span className="source-pill" key={ref}>{ref}</span>)}
    </div>
  );
}

function PresentationRow({ value }) {
  const { text, refs } = splitEvidence(value);
  const lead = splitLeadingLabel(text);
  return (
    <article className="info-row">
      <div>
        {lead.label && <span className="info-row__label">{lead.label}</span>}
        <p>{lead.text}</p>
      </div>
      <SourcePills refs={refs} />
    </article>
  );
}

function normalizeTextItems(items) {
  const seen = new Set();
  return asArray(items)
    .map((item) => cleanPresentationText(item))
    .filter(Boolean)
    .filter((item) => {
      const { text } = splitEvidence(item);
      const key = cleanPresentationText(text).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function Items({ items, columns }) {
  const arr = asArray(items);
  const simple = arr.every((x) => typeof x !== 'object');
  if (simple) {
    const textItems = normalizeTextItems(arr);
    if (textItems.some((x) => x.length > 70 || /\bEvidence:\s*/i.test(x) || /^[A-Za-z][A-Za-z0-9 /_-]{1,52}:\s*/.test(x))) {
      return <div className="info-list">{textItems.map((x) => <PresentationRow key={x} value={x} />)}</div>;
    }
    return <div className="chips">{textItems.map((x) => <span className="chip" key={x}>{x}</span>)}</div>;
  }
  return <DataTable items={arr} columns={columns} />;
}

const TEXT_GROUP_LABELS = {
  summary: 'Summary',
  business_functionality: 'Application behavior',
  evidence: 'Source evidence',
  repository_scope: 'Repository scope',
  architecture_summary: 'Architecture summary',
  purpose: 'Purpose',
};

const DETAIL_KEYS = new Set(['detail', 'details', 'workflow', 'flow']);

const normalizeTextKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const cleanTextItem = (value) =>
  cleanPresentationText(value)
    .trim()
    .replace(/\s+workflow$/i, '')
    .replace(/[.;]\s*$/, '');

function semanticGroups(text) {
  const groups = [];
  let current = null;
  const parts = text
    .split(/;\s*/)
    .map((part) => part.trim().replace(/[.;]\s*$/, ''))
    .filter(Boolean);

  parts.forEach((part) => {
    const match = part.match(/^([A-Za-z][A-Za-z0-9 _/-]{1,36}):\s*(.+)$/);
    const key = match ? normalizeTextKey(match[1]) : '';
    if (match && DETAIL_KEYS.has(key) && current && current.key !== 'summary') {
      current.items.push(cleanTextItem(match[2]));
      return;
    }
    if (match && TEXT_GROUP_LABELS[key]) {
      current = { key, label: TEXT_GROUP_LABELS[key], items: [cleanTextItem(match[2])] };
      groups.push(current);
      return;
    }
    if (current && current.key !== 'summary') {
      current.items.push(cleanTextItem(part));
      return;
    }
    groups.push({ key: '', label: '', items: [cleanTextItem(part)] });
    current = null;
  });

  return groups
    .map((group) => ({ ...group, items: normalizeTextItems(group.items.filter(Boolean)) }))
    .filter((group) => group.items.length > 0);
}

function StructuredText({ value }) {
  const text = String(value || '').trim();
  const groups = semanticGroups(text);
  const hasSemanticGroups = groups.some((group) => group.label);

  if (hasSemanticGroups) {
    return (
      <div className="structured-text">
        {groups.map((group, index) => (
          <article
            className={group.key === 'summary' ? 'structured-text__summary' : 'structured-text__group'}
            key={`${group.label || 'text'}-${index}`}
          >
            {group.label && <span>{group.label}</span>}
            {group.items.length === 1 ? (
              <PresentationText value={group.items[0]} />
            ) : (
              <div className={group.key === 'evidence' ? 'source-pills' : 'workflow-pills'}>
                {group.items.map((item) => (
                  <span className={group.key === 'evidence' ? 'source-pill' : 'workflow-pill'} key={item}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    );
  }

  const parts = groups.flatMap((group) => group.items);
  if (parts.length >= 3 && text.length > 180) {
    return <div className="info-list">{normalizeTextItems(parts).map((part) => <PresentationRow key={part} value={part} />)}</div>;
  }

  return <PresentationText value={text} />;
}

function PresentationText({ value }) {
  const { text, refs } = splitEvidence(value);
  return (
    <>
      <p className="prose">{text}</p>
      <SourcePills refs={refs} />
    </>
  );
}

export function Field({ label, value, columns }) {
  if (isEmpty(value)) return null;
  const displayCount = Array.isArray(value)
    ? (value.every((x) => typeof x !== 'object') ? normalizeTextItems(value).length : value.length)
    : 0;
  let body;
  if (typeof value === 'string') body = <StructuredText value={value} />;
  else if (Array.isArray(value)) body = <Items items={value} columns={columns} />;
  else body = <Val v={value} />;
  return (
    <div className="field">
      <h3 className="field__label">
        {label}
        {Array.isArray(value) && displayCount > 0 && <span className="count">{displayCount}</span>}
      </h3>
      {body}
    </div>
  );
}

export function Stats({ items }) {
  const visible = (items || []).filter((i) => !isEmpty(i?.value));
  return (
    <div className="stats">
      {visible.map((i) => (
        <article className="stat" key={i.label}>
          <div className="stat__value">{i.value}</div>
          <div className="stat__label">{i.label}</div>
        </article>
      ))}
    </div>
  );
}

export function LinkCards({ items }) {
  const visible = (items || []).filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="link-card-grid">
      {visible.map(({ to, icon: Icon, title, text, meta }) => (
        <Link className="link-card" to={to} key={`${to}-${title}`}>
          {Icon && <span className="feature__icon"><Icon size={17} aria-hidden="true" /></span>}
          <span>
            <strong>{title}</strong>
            {text && <small>{text}</small>}
          </span>
          {meta && <em>{meta}</em>}
        </Link>
      ))}
    </div>
  );
}

export function Disclosure({ title, children, meta, defaultOpen = false }) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {meta && <em>{meta}</em>}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

export function FieldList({ fields, d }) {
  const nodes = (fields || [])
    .filter((f) => !isEmpty(d[f]))
    .map((f) => <Field key={f} label={FIELD_LABELS[f] || titleCase(f)} value={d[f]} columns={COLS[f]} />);
  return nodes.length ? <>{nodes}</> : null;
}

export function EvidenceBlock({ refs }) {
  return (
    <>
      {isEmpty(refs) ? <p className="muted">No source references in this upload.</p> : <Refs refs={refs} />}
      <Link className="link" to="/evidence">Open source evidence</Link>
    </>
  );
}

export function sectionHasContent(section, d = {}) {
  if (!section) return false;
  if (section.render) return section.isVisible ? section.isVisible() : true;
  return (section.fields || []).some((f) => !isEmpty(d[f]));
}

/** sections: [{id, title, hint, fields?: [], render?: () => node}] */
export function Sections({ d, sections }) {
  const panels = (sections || []).filter((s) => sectionHasContent(s, d));

  return panels.map((s) => {
    if (s.render) {
      return (
        <Panel key={s.id} id={s.id} title={s.title} hint={s.hint}>
          {s.render()}
        </Panel>
      );
    }
    const nodes = (s.fields || [])
      .map((f) => [f, d[f]])
      .filter(([, value]) => !isEmpty(value))
      .map(([f, value]) => <Field key={f} label={FIELD_LABELS[f] || titleCase(f)} value={value} columns={COLS[f]} />);
    if (!nodes.length) return null;
    return (
      <Panel key={s.id} id={s.id} title={s.title} hint={s.hint}>
        {nodes}
      </Panel>
    );
  });
}

export function PageShell({ eyebrow, title, description, state, emptyTitle, emptyText, sections, sectionData, showEmptyContent = false, showWorkflowBack = true, children }) {
  const { loading, error, hasData } = state;
  const navSections = (sections || []).filter((s) => sectionHasContent(s, sectionData));
  const showContent = hasData || showEmptyContent;
  return (
    <div className="stack">
      <div className="page-head">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {showWorkflowBack && (
          <Link className="link flow-back" to="/">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to ThreatForge workflow
          </Link>
        )}
      </div>

      {loading && <div className="banner">Loading...</div>}
      {error && (
        <div className="banner banner--danger">
          <span>Could not load data: {error}. Check that the backend is running on port 8080.</span>
        </div>
      )}
      {!loading && !error && !hasData && (
        <div className="banner banner--warn">
          <div>
            <strong>{emptyTitle}</strong>
            <span>{emptyText}</span>
          </div>
          <Link className="btn btn--primary" to="/upload">Upload reports</Link>
        </div>
      )}

      {hasData && navSections.length > 0 && (
        <nav className="secnav" aria-label="Sections">
          {navSections.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}>
              {s.title}
            </a>
          ))}
        </nav>
      )}

      {!loading && !error && showContent && children}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const modal = (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button type="button" className="btn btn--sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
