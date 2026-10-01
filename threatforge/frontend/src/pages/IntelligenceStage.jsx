import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StageTabs from '../components/StageTabs.jsx';
import RepositoryIntelligence from './RepositoryIntelligence.jsx';
import Architecture from './Architecture.jsx';
import ThreatModel from './ThreatModel.jsx';
import SecurityReviewPlan from './SecurityReviewPlan.jsx';

const TABS = [
  { key: 'repository-intelligence', label: 'Repository Intelligence', render: () => <RepositoryIntelligence /> },
  { key: 'architecture', label: 'Architecture', render: () => <Architecture /> },
  { key: 'threat-modeling', label: 'Threat Modeling', render: () => <ThreatModel /> },
  { key: 'scan-planning', label: 'Scan Planning', render: () => <SecurityReviewPlan /> },
];

export default function IntelligenceStage() {
  return (
    <div className="stack">
      <div className="page-head">
        <div className="eyebrow">Stage 01 &middot; Pre-scan intelligence</div>
        <h1>Repository intelligence, architecture and security assessment</h1>
        <p>Start with repository intelligence, bring architecture and threat modeling into view, then prepare the scan assessment that drives the six scan types.</p>
        <Link className="link flow-back" to="/">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to ThreatForge workflow
        </Link>
      </div>
      <StageTabs tabs={TABS} defaultTab="repository-intelligence" />
    </div>
  );
}
