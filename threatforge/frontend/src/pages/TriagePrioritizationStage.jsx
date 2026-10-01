import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StageTabs from '../components/StageTabs.jsx';
import LifecycleStage from './LifecycleStage.jsx';

const TABS = [
  {
    key: 'triage',
    label: 'Finding Triage',
    render: () => <LifecycleStage key="lifecycle-triage" stageKey="triage" title="Finding triage" view="overview" />,
  },
  {
    key: 'prioritization',
    label: 'Risk-Based Prioritization',
    render: () => <LifecycleStage key="lifecycle-prioritization" stageKey="prioritization" title="Risk-based prioritization" />,
  },
];

export default function TriagePrioritizationStage() {
  return (
    <div className="stack">
      <div className="page-head">
        <div className="eyebrow">Stage 03-04 &middot; Triage then Prioritization</div>
        <h1>Approve real findings before they enter the priority queue</h1>
        <p>Confirm or reject each finding with a reason, approve the triage decision, then rank only approved findings for remediation.</p>
        <Link className="link flow-back" to="/">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to ThreatForge workflow
        </Link>
      </div>
      <StageTabs tabs={TABS} defaultTab="triage" />
    </div>
  );
}
