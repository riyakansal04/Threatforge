import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LifecycleStage from './LifecycleStage.jsx';

export default function PrioritizationStage() {
  return (
    <div className="stack">
      <div className="page-head stage-page-head">
        <div className="eyebrow">Stage 05 &middot; Prioritization</div>
        <h1>Rank findings and prepare Jira handoff</h1>
        <p>Turn triaged findings into a risk-aware priority queue, then create Jira work items before remediation begins.</p>
        <Link className="link flow-back flow-back--icon" to="/" aria-label="Back to workflow" title="Back to workflow">
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
      </div>
      <LifecycleStage
        key="lifecycle-prioritization"
        stageKey="prioritization"
        extraStageKeys={['triage']}
        title="Risk-based prioritization"
        showHeader={false}
      />
    </div>
  );
}
