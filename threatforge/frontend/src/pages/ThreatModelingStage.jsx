import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import StageTabs from '../components/StageTabs.jsx';
import { OverviewDashboard, SignalShowcase } from '../components/OverviewVisuals.jsx';
import ThreatModel from './ThreatModel.jsx';
import SecurityReviewPlan from './SecurityReviewPlan.jsx';
import { asArray, count } from '../lib/format.js';

const TABS = [
  {
    key: 'threat-modeling',
    label: 'Threat Modeling',
    description: 'Assets, actors, trust boundaries, threats and attack paths from the reviewed reports.',
    render: () => <ThreatModel />,
  },
  {
    key: 'scan-planning',
    label: 'Security Assessment',
    description: 'Security-critical surfaces, unresolved areas, scan targets and review priorities.',
    render: () => <SecurityReviewPlan />,
  },
];

const isRelationshipRecord = (item) => {
  if (!item || typeof item !== 'object') return false;
  const id = String(item.relationship_id || item.relationshipId || item.threat_id || item.id || '').toUpperCase();
  return Boolean(
    item.relationship_type ||
    item.relationshipType ||
    item.source_threat_id ||
    item.sourceThreat ||
    item.target_threat_id ||
    item.targetThreat ||
    id.startsWith('TR')
  );
};

function ThreatModelingOverview() {
  const { data: threatData } = useApi(api.threatModel);
  const { data: baselineData } = useApi(api.securityBaseline);
  const model = threatData?.threat_model || {};
  const baseline = baselineData?.security_baseline || {};
  const threats = asArray(threatData?.threats).filter((item) => !isRelationshipRecord(item));
  const relationships = asArray(threatData?.threat_relationships);
  const scanFocus = asArray(baselineData?.scan_focus || baseline.scan_focus);
  const capabilities = asArray(baseline.selected_capabilities);
  const objectives = asArray(baseline.assessment_objectives);
  const gaps = asArray(baseline.coverage_gaps);
  const metrics = [
    ['Threat scenarios', threats.length, 'tone-4'],
    ['Trust boundaries', count(model.trust_boundaries), 'tone-2'],
    ['Assets', count(model.assets), 'tone-1'],
    ['Threat actors', count(model.threat_actors), 'tone-3'],
    ['Threat relationships', relationships.length, 'tone-5'],
    ['Scan targets', scanFocus.length, 'tone-2'],
    ['Capabilities', capabilities.length, 'tone-1'],
    ['Assessment objectives', objectives.length, 'tone-3'],
    ['Coverage gaps', gaps.length, 'tone-4'],
  ];

  return (
    <OverviewDashboard>
      <SignalShowcase title="Threat and assessment coverage" items={metrics} maxItems={8} />
      {!metrics.some(([, value]) => value > 0) && <p className="muted">No threat-modeling or security-assessment signals have been mapped yet.</p>}
    </OverviewDashboard>
  );
}

export default function ThreatModelingStage() {
  return (
    <div className="stack">
      <div className="page-head stage-page-head">
        <div className="eyebrow">Stage 02 &middot; Threat modeling</div>
        <h1>Threat model and security assessment</h1>
        <p>Turn architecture context into concrete threats, attack paths, review priorities, and scan targets.</p>
        <Link className="link flow-back flow-back--icon" to="/" aria-label="Back to workflow" title="Back to workflow">
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
      </div>
      <StageTabs tabs={TABS} defaultTab="threat-modeling" overview={<ThreatModelingOverview />} />
    </div>
  );
}
