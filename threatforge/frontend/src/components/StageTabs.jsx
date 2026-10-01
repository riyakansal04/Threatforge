import { useSearchParams } from 'react-router-dom';
import {
  Boxes,
  CheckCircle2,
  Database,
  FileSearch,
  GitBranch,
  ListChecks,
  Radar,
  ScanSearch,
  ShieldCheck,
  Target,
  TrendingUp,
  Wrench,
} from 'lucide-react';

const TAB_ICONS = {
  architecture: Boxes,
  closure: ShieldCheck,
  deep: ScanSearch,
  dependency: Database,
  exploitable: Target,
  module: GitBranch,
  prioritization: TrendingUp,
  regression: FileSearch,
  'repository-intelligence': Radar,
  runtime: CheckCircle2,
  'scan-planning': ListChecks,
  standard: ShieldCheck,
  triage: ListChecks,
  'threat-modeling': Target,
  verification: ShieldCheck,
};

function iconFor(tab) {
  return tab.icon || TAB_ICONS[tab.key] || ListChecks;
}

export default function StageTabs({ tabs, defaultTab }) {
  const [params, setParams] = useSearchParams();
  const activeKey = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab') : (defaultTab || tabs[0]?.key);
  const active = tabs.find((t) => t.key === activeKey) || tabs[0];

  const select = (key) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    setParams(next, { replace: true });
  };

  return (
    <div className="stage-tabs-wrap">
      <div className="stage-tabs" role="tablist">
        {tabs.map((tab) => (
          (() => {
            const Icon = iconFor(tab);
            return (
          <button
            type="button"
            role="tab"
            key={tab.key}
            aria-selected={activeKey === tab.key}
            className={`stage-tab ${activeKey === tab.key ? 'is-active' : ''}`}
            onClick={() => select(tab.key)}
          >
            <span className="stage-tab__icon" aria-hidden="true"><Icon size={22} /></span>
            <span>{tab.label}</span>
          </button>
            );
          })()
        ))}
      </div>
      <div className="stage-tab-panel">
        {active?.render()}
      </div>
    </div>
  );
}
