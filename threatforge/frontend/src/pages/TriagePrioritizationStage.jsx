import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, ListChecks, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import { OverviewDashboard } from '../components/OverviewVisuals.jsx';
import StageTabs from '../components/StageTabs.jsx';
import LifecycleStage from './LifecycleStage.jsx';

const TABS = [
  {
    key: 'triage',
    label: 'Finding Triage',
    description: 'Review logical findings, false positives, duplicates and reviewer approval decisions.',
    render: () => <LifecycleStage key="lifecycle-triage" stageKey="triage" title="Finding triage" view="overview" showHeader={false} />,
  },
];

function countStageMetric(statuses, stageKey, metricKey) {
  const stage = (statuses || []).find((row) => row.key === stageKey);
  return Number(stage?.counts?.[metricKey]) || 0;
}

const loadTriageStage = () => api.lifecycleStage('triage');
const normalizeMetricKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const metricNumber = (value) => {
  if (typeof value === 'number') return value;
  const match = String(value ?? '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

function classificationMetric(summary, names) {
  const wanted = new Set(names.map(normalizeMetricKey));
  const rows = Array.isArray(summary)
    ? summary
    : Object.entries(summary || {}).map(([name, value]) => ({ name, value }));
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const key = normalizeMetricKey(row.name || row.label || row.key || '');
    if (wanted.has(key)) return metricNumber(row.value ?? row.count ?? row.total);
    for (const [name, value] of Object.entries(row)) {
      if (wanted.has(normalizeMetricKey(name))) return metricNumber(value);
    }
  }
  return undefined;
}

function TriageOverviewTile({ icon: Icon, label, value, note, tone }) {
  return (
    <article className={`triage-overview-tile triage-overview-tile--${tone}`}>
      <span className="triage-overview-tile__icon" aria-hidden="true"><Icon size={20} /></span>
      <strong>{value}</strong>
      <span>{label}</span>
      {note && <em>{note}</em>}
    </article>
  );
}

function TriageOverview() {
  const { data: statusData } = useApi(api.status, 'status');
  const { data: triageData } = useApi(loadTriageStage, 'lifecycle:triage');
  const statuses = statusData?.stages || [];
  const triageStage = (statuses || []).find((row) => row.key === 'triage');
  const triageRecords = triageData?.records || {};
  const triageSummary = triageData?.data || {};
  const decisions = countStageMetric(statuses, 'triage', 'triage_decisions') || (triageRecords.triage_decisions || []).length;
  const links = countStageMetric(statuses, 'triage', 'finding_relationships') || (triageRecords.finding_relationships || []).length;
  const reviewed = classificationMetric(triageSummary.classification_summary, ['findings_reviewed', 'reviewed']) ?? decisions;
  const confirmed = classificationMetric(triageSummary.classification_summary, ['confirmed']) ?? decisions;
  const falsePositives = classificationMetric(triageSummary.classification_summary, ['false_positive', 'false_positives'])
    ?? countStageMetric(statuses, 'triage', 'false_positives');
  const approved = countStageMetric(statuses, 'triage', 'approved_for_priority');
  const rejected = countStageMetric(statuses, 'triage', 'rejected_for_priority');
  const pending = countStageMetric(statuses, 'triage', 'pending_human_approval') || Math.max(decisions - approved - rejected, 0);
  const readyForNextStage = approved;
  const mapped = Number(triageStage?.counts?.triage_decisions || 0) + Number(triageStage?.counts?.finding_relationships || 0);

  return (
    <OverviewDashboard>
      <article className="triage-overview-board">
        <header className="triage-overview-board__head">
          <div>
            <span>Decision overview</span>
            <h2>Triage approval gate</h2>
            <p>AI triage provides the reasoning, relationships, and false-positive analysis; human approval governs which findings can move into prioritization.</p>
          </div>
          <strong>{mapped || decisions} mapped</strong>
        </header>

        <div className="triage-overview-board__grid">
          <TriageOverviewTile icon={ListChecks} label="Findings reviewed" value={reviewed} note={`${decisions} triage decisions`} tone="info" />
          <TriageOverviewTile icon={CheckCircle2} label="Confirmed findings" value={confirmed} note={`${readyForNextStage} approved for priority`} tone="good" />
          <TriageOverviewTile icon={ShieldAlert} label="False positives" value={falsePositives} note="Filtered before priority" tone="warn" />
          <TriageOverviewTile icon={Clock3} label="Left for human approval" value={pending} note="Not allowed into priority yet" tone="pending" />
          <TriageOverviewTile icon={XCircle} label="Rejected by reviewer" value={rejected} note="Blocked from next stage" tone="bad" />
        </div>
      </article>
      {!decisions && !links && <p className="muted">No triage records have been mapped yet.</p>}
    </OverviewDashboard>
  );
}

export default function TriagePrioritizationStage() {
  const [params] = useSearchParams();
  if (params.get('tab') === 'prioritization') {
    return <Navigate to="/findings-cases/priority" replace />;
  }

  return (
    <div className="stack">
      <div className="page-head stage-page-head">
        <div className="eyebrow">Stage 04 &middot; Finding Triage</div>
        <h1>Validate findings before they enter the priority queue</h1>
        <p>Review evidence support, reachability, duplicate relationships, uncertainty, and approval decisions before prioritization.</p>
        <Link className="link flow-back flow-back--icon" to="/" aria-label="Back to workflow" title="Back to workflow">
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
      </div>
      <StageTabs tabs={TABS} defaultTab="triage" overview={<TriageOverview />} />
    </div>
  );
}
