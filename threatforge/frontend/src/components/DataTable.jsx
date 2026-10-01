import React, { Fragment, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Val } from './Val.jsx';
import { asArray, isEmpty, labelOf, titleCase } from '../lib/format.js';

const HIDDEN = new Set([
  'extra',
  'raw',
  'raw_record',
  'raw_metadata',
  'metadata',
  'attributes',
  'properties',
  '_approval_decision',
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
  'physicalLocation',
  'physical_location',
  'locations',
  'location',
  'partialFingerprints',
  'defaultConfiguration',
  'default_configuration',
]);
const REF_KEYS = ['source_references', 'evidence_references'];
const isRenderableKey = (k, v) => !HIDDEN.has(k) && !isEmpty(v);
const colClass = (label) => `table__cell--${String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

const FIELD_GROUPS = [
  ['location', 'locations', 'code_location', 'physicalLocation', 'physical_location'],
  ['finding_id', 'logical_finding_id', 'consolidated_finding_id', 'id'],
  ['title', 'name', 'scenario', 'summary'],
  ['classification', 'status', 'validation_state', 'result'],
  ['source_findings', 'source_finding_ids', 'source_finding_references', 'source_count'],
  ['root_cause', 'common_root_cause', 'root_cause_group_id'],
];

const groupFor = (key) => FIELD_GROUPS.find((group) => group.includes(key)) || [key];

const normalize = (items) =>
  asArray(items).map((i) =>
    i && typeof i === 'object' && !Array.isArray(i) ? i : { name: typeof i === 'string' ? i : JSON.stringify(i) }
  );

function autoColumns(rows) {
  const freq = new Map();
  const keys = new Set();

  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (HIDDEN.has(k) || REF_KEYS.includes(k) || isEmpty(r[k])) return;
      keys.add(k);
      freq.set(k, (freq.get(k) || 0) + 1);
    });
  });

  return [...keys].sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0)).slice(0, 6).map((k) => ({ label: titleCase(k), keys: [k] }));
}

function pick(row, keys) {
  const candidates = Array.isArray(keys) ? keys : [keys];
  for (const k of candidates) {
    if (!k) continue;
    if (row && !isEmpty(row[k])) return [k, row[k]];
  }
  return [null, undefined];
}

function CompactArrayValue({ value, max = 8 }) {
  const [expanded, setExpanded] = useState(false);
  const allItems = value.map(labelOf).filter(Boolean);
  const items = expanded ? allItems : allItems.slice(0, max);
  if (!items.length) return <Val v={value} compact />;
  return (
    <span className="chips">
      {items.map((item) => <span className="chip" key={item}>{item}</span>)}
      {allItems.length > max && (
        <button type="button" className="chip chip--button" onClick={() => setExpanded((on) => !on)}>
          {expanded ? 'Show less' : `+${allItems.length - max} more`}
        </button>
      )}
    </span>
  );
}

export default function DataTable({ items, columns }) {
  const rows = useMemo(() => normalize(items), [items]);
  const [open, setOpen] = useState(null);

  const cols = useMemo(() => {
    const safeColumns = (columns || []).map((col) => ({ ...col, keys: Array.isArray(col.keys) ? col.keys : [col.keys] }));
    let c = safeColumns.filter((col) => col.render || rows.some((r) => !isEmpty(pick(r, col.keys)[1])));
    if (!c.length) c = autoColumns(rows);
    if (rows.some((r) => REF_KEYS.some((k) => !isEmpty(r[k])))) c = [...c, { label: 'Evidence', keys: REF_KEYS }];
    return c;
  }, [rows, columns]);

  const visibleKeysFor = (row) =>
    new Set(cols.flatMap((c) => {
      const [k] = pick(row, c.keys);
      if (!k) return [];
      if (REF_KEYS.includes(k)) return REF_KEYS;
      return groupFor(k);
    }));

  const detailsFor = (row) => {
    const visible = visibleKeysFor(row);
    return Object.fromEntries(
      Object.entries(row).filter(([k, v]) => isRenderableKey(k, v) && !visible.has(k))
    );
  };
  const rowDetails = useMemo(() => rows.map((row) => detailsFor(row)), [rows, cols]);
  const hasExpandableRows = rowDetails.some((details) => Object.keys(details).length > 0);

  const renderDetailValue = (value, key) => {
    if (typeof value !== 'object' || value == null) return <Val v={value} k={key} compact />;
    if (Array.isArray(value)) {
      return <CompactArrayValue value={value} />;
    }
    return <Val v={value} k={key} compact />;
  };

  const DetailGrid = ({ details }) => {
    const entries = Object.entries(details).slice(0, 12);
    const more = Math.max(0, Object.keys(details).length - entries.length);
    return (
      <div className="table-detail-grid">
        {entries.map(([key, value]) => (
          <div className="table-detail-item" key={key}>
            <span>{titleCase(key)}</span>
            <strong>{renderDetailValue(value, key)}</strong>
          </div>
        ))}
        {more > 0 && <div className="table-detail-item table-detail-item--muted">Additional technical fields are hidden from this view.</div>}
      </div>
    );
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {hasExpandableRows && <th style={{ width: 34 }} />}
            {cols.map((c) => <th className={colClass(c.label)} key={c.label}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const details = rowDetails[i] || {};
            const canExpand = Object.keys(details).length > 0;
            return (
              <Fragment key={`r${i}`}>
              <tr className={canExpand ? 'clickable' : ''} onClick={() => canExpand && setOpen(open === i ? null : i)}>
                {hasExpandableRows && (
                  <td>
                    {canExpand ? (
                      <button type="button" className={open === i ? 'expander is-open' : 'expander'}
                        onClick={(e) => { e.stopPropagation(); setOpen(open === i ? null : i); }} aria-label="Show more details">
                        <ChevronRight size={14} />
                      </button>
                    ) : <span className="expander-placeholder" aria-hidden="true" />}
                  </td>
                )}
                {cols.map((c) => {
                  const [k, v] = pick(row, c.keys);
                  return <td className={colClass(c.label)} key={`${i}-${c.label}-${k || 'empty'}`}>{c.render ? c.render(row) : <Val v={v} k={k} compact />}</td>;
                })}
              </tr>
              {open === i && canExpand && (
                <tr className="row-detail">
                  <td colSpan={cols.length + (hasExpandableRows ? 1 : 0)}><DetailGrid details={details} /></td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
