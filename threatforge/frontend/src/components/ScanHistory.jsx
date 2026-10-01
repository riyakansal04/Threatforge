import { Link } from 'react-router-dom';
import { fmtDate, isEmpty, labelOf } from '../lib/format.js';
import { SCAN_LABELS, compactValue, str } from '../lib/scanning.js';

const textLabel = (value) => {
  if (isEmpty(value)) return '';
  return str(value) || compactValue(value) || labelOf(value);
};

export function scanTitle(scan) {
  if (!scan) return 'Scan report';
  const type = SCAN_LABELS[scan.scan_type] || scan.scan_type;
  const target = textLabel(scan.target || scan.repository_reference);
  return [type, target].filter(Boolean).join(' - ') || `${type || 'Security'} report`;
}

export function ScanScopeSelector({ scans = [], value = '', onChange }) {
  if (!scans.length) return null;
  return (
    <div className="scan-scope">
      <label className="scan-scope__label" htmlFor="scan-scope">Selected report</label>
      <select id="scan-scope" className="input scan-scope__select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {scans.map((scan) => (
          <option key={scan.id} value={scan.id}>{scanTitle(scan)} - {fmtDate(scan.created_at)}</option>
        ))}
      </select>
    </div>
  );
}

export function ScanHistoryTable({ scans = [], selectedId = '', onSelect }) {
  if (!scans.length) return <p className="muted">No scans yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Report</th><th>Type</th><th>Target</th><th>Repository</th><th>Findings</th>
            <th>Scope stated</th><th>Artifacts</th><th>Uploaded</th><th />
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => {
            const isSelected = String(scan.id) === String(selectedId || '');
            return (
              <tr key={scan.id} className={isSelected ? 'is-selected' : ''}>
                <td>
                  <Link className="link" to={`/scanning/overview?scan_id=${scan.id}`}>{scanTitle(scan)}</Link>
                </td>
                <td><span className="tag">{SCAN_LABELS[scan.scan_type] || scan.scan_type}</span></td>
                <td>{textLabel(scan.target) || <span className="muted">-</span>}</td>
                <td>{textLabel(scan.repository_reference) || <span className="muted">-</span>}</td>
                <td>{scan.finding_count ?? 0}</td>
                <td>{scan.has_coverage ? 'Yes' : <span className="muted">No</span>}</td>
                <td>{scan.artifact_count ?? 0}</td>
                <td>{fmtDate(scan.created_at)}</td>
                <td>
                  <button type="button" className="btn btn--sm" disabled={isSelected} onClick={() => onSelect?.(String(scan.id))}>
                    {isSelected ? 'Viewing' : 'View dashboard'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
