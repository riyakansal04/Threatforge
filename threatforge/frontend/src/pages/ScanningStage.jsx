import { Link } from 'react-router-dom';
import { ArrowLeft, FileUp } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { Stats } from '../components/Blocks.jsx';
import { ScanHistoryTable } from '../components/ScanHistory.jsx';
import StageTabs from '../components/StageTabs.jsx';
import { SCAN_LABELS, SCAN_TYPES } from '../lib/scanning.js';

const SCAN_TAB_META = {
  standard: { key: 'standard', title: 'Standard Security Scan', text: 'Broad first pass across the codebase for common weaknesses.' },
  deep: { key: 'deep', title: 'Deep Security Scan', text: 'Slower, higher-coverage analysis for harder-to-reach issues.' },
  module: { key: 'module', title: 'Module Security Scan', text: 'Focused review of a specific component or module.' },
  exploitable: { key: 'exploitable', title: 'Exploitable Security Scan', text: 'Findings validated as practically exploitable.' },
  supply_chain: { key: 'supply_chain', title: 'Supply-Chain / Dependency Scan', text: 'Third-party and dependency risk.' },
  runtime: { key: 'runtime', title: 'Runtime / Dynamic Validation', text: 'Behavior observed while the application is running.' },
};

function ScanTypePanel({ scanType, overview }) {
  const meta = SCAN_TAB_META[scanType];
  const rows = (overview.scan_history || []).filter((s) => s.scan_type === scanType);
  const findingCount = rows.reduce((sum, s) => sum + (Number(s.finding_count) || 0), 0);
  const label = SCAN_LABELS[scanType] || meta.title;

  if (!rows.length) {
    return (
      <div className="stack">
        <p className="muted">Not uploaded yet. Run a {label.toLowerCase()} in Codex Security, then upload its report here.</p>
        <Link to="/upload" className="btn btn--primary" style={{ width: 'fit-content' }}>
          <FileUp size={15} aria-hidden="true" />
          Upload reports
        </Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <Stats items={[
        { label: 'Reports uploaded', value: rows.length },
        { label: 'Findings reported', value: findingCount },
      ]} />
      <ScanHistoryTable scans={rows} />
      <Link className="btn btn--primary" to={`/scanning/findings?scan_type=${encodeURIComponent(label)}`} style={{ width: 'fit-content' }}>
        View findings
      </Link>
    </div>
  );
}

export default function ScanningStage() {
  const { data, loading, error } = useApi(api.scanOverview);
  const overview = data || {};

  const tabs = SCAN_TYPES.map((scanType) => ({
    key: scanType,
    label: SCAN_TAB_META[scanType].title,
    render: () => <ScanTypePanel scanType={scanType} overview={overview} />,
  }));

  return (
    <div className="stack">
      <div className="page-head">
        <div className="eyebrow">Stage 02 &middot; Scanning</div>
        <h1>Discover Security Findings</h1>
        <p>Six scan types, each uploaded and reviewed independently.</p>
        <Link className="link flow-back" to="/">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to ThreatForge workflow
        </Link>
      </div>

      {loading && <div className="banner">Loading...</div>}
      {error && (
        <div className="banner banner--danger">
          <span>Could not load scan data: {error}.</span>
        </div>
      )}
      {!loading && !error && <StageTabs tabs={tabs} defaultTab="standard" />}
    </div>
  );
}
