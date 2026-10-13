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

export default function StageTabs({ tabs, defaultTab, overview }) {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const activeKey = tabs.some((t) => t.key === requestedTab) ? requestedTab : '';
  const active = tabs.find((t) => t.key === activeKey);

  const select = (key) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    next.delete('section');
    setParams(next, { replace: true });
  };

  return (
    <div className="stage-tabs-wrap">
      <div className="stage-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!activeKey}
          className={`stage-tab ${!activeKey ? 'is-active' : ''}`}
          onClick={() => {
            const next = new URLSearchParams(params);
            next.delete('tab');
            next.delete('section');
            setParams(next, { replace: true });
          }}
        >
          <span className="stage-tab__icon" aria-hidden="true"><ListChecks size={22} /></span>
          <span>Overview</span>
        </button>
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
      {active ? (
        <div className="stage-tab-panel">
          {active.render()}
        </div>
      ) : overview ? (
        <div className="stage-tab-overview">
          {overview}
        </div>
      ) : (
        <div className="stage-tab-overview">
          {tabs.map((tab, index) => {
            const Icon = iconFor(tab);
            return (
              <button type="button" className="stage-overview-card" key={tab.key} onClick={() => select(tab.key)}>
                <span className="stage-overview-card__num">{String(index + 1).padStart(2, '0')}</span>
                <span className="stage-overview-card__icon" aria-hidden="true"><Icon size={24} /></span>
                <strong>{tab.label}</strong>
                <small>{tab.description || 'Open this section when you need its focused details.'}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
