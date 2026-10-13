import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import StageTabs from '../components/StageTabs.jsx';
import { OverviewDashboard, SignalShowcase } from '../components/OverviewVisuals.jsx';
import RepositoryIntelligence from './RepositoryIntelligence.jsx';
import Architecture from './Architecture.jsx';
import { asArray, cleanPresentationText, count, labelOf } from '../lib/format.js';

const TABS = [
  {
    key: 'repository-intelligence',
    label: 'Repository Intelligence',
    description: 'Application purpose, technology stack, runtime entries, interfaces and source evidence.',
    render: () => <RepositoryIntelligence />,
  },
  {
    key: 'architecture',
    label: 'Architecture',
    description: 'Components, relationships, data movement, integrations and execution boundaries.',
    render: () => <Architecture />,
  },
];

function IntelligenceOverview() {
  const { data } = useApi(api.repositoryIntelligence);
  const d = data?.data || {};
  const uniqueCount = (fields, pickValue) => {
    const seen = new Set();
    fields.forEach((field) => {
      asArray(d[field]).forEach((item) => {
        const raw = pickValue ? pickValue(item, field) : labelOf(item);
        const key = cleanPresentationText(raw).toLowerCase().replace(/`/g, '').replace(/\/+$/, '');
        if (key) seen.add(key);
      });
    });
    return seen.size;
  };
  const interfaces = (() => {
    return uniqueCount(['apis', 'routes', 'controllers', 'handlers', 'externally_accessible_interfaces'], (item) => {
        const value = item && typeof item === 'object'
          ? item.path_or_interface || item.path || item.route || item.interface || item.endpoint || item.url || item.name || labelOf(item)
          : item;
        return value;
    });
  })();
  const externalTouchpoints = (() => {
    return uniqueCount(['integrations', 'external_services', 'webhooks'], (item) => {
        const value = item && typeof item === 'object' ? item.name || item.service || item.integration || labelOf(item) : item;
        return value;
    });
  })();
  const runtimeSignals = Math.max(count(d.entry_points), count(d.startup_flow), count(d.runtime_processes));
  const metrics = [
    ['Components', count(d.components), 'tone-1'],
    ['API points', interfaces, 'tone-2'],
    ['Runtime signals', runtimeSignals, 'tone-3'],
    ['Execution flows', count(d.execution_flows), 'tone-4'],
    ['Data stores', count(d.data_stores), 'tone-5'],
    ['Data models', count(d.data_models), 'tone-1'],
    ['Data flows', count(d.data_flows), 'tone-2'],
    ['Authentication', count(d.authentication), 'tone-3'],
    ['Authorization', count(d.authorization), 'tone-4'],
    ['External touchpoints', externalTouchpoints, 'tone-5'],
    ['Configuration', count(d.configuration), 'tone-1'],
    ['Build structure', count(d.build_structure), 'tone-2'],
    ['Test structure', count(d.test_structure), 'tone-3'],
    ['CI/CD structure', count(d.ci_cd_structure), 'tone-4'],
    ['Assumptions', count(d.assumptions), 'tone-5'],
    ['Unknowns', count(d.unknowns), 'tone-1'],
    ['Diagrams', count(d.diagrams), 'tone-2'],
  ];

  return (
    <OverviewDashboard>
      <SignalShowcase title="Mapped Intelligence" items={metrics} maxItems={8} />
      {!metrics.some(([, value]) => value > 0) && <p className="muted">No intelligence signals have been mapped yet.</p>}
    </OverviewDashboard>
  );
}

export default function IntelligenceStage() {
  return (
    <div className="stack">
      <div className="page-head stage-page-head">
        <div className="eyebrow">Stage 01 &middot; Pre-scan intelligence</div>
        <h1>Repository intelligence and architecture context</h1>
        <p>Start with what the application does, how it is built, where it runs, and which interfaces shape the review.</p>
        <Link className="link flow-back flow-back--icon" to="/" aria-label="Back to workflow" title="Back to workflow">
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
      </div>
      <StageTabs tabs={TABS} defaultTab="repository-intelligence" overview={<IntelligenceOverview />} />
    </div>
  );
}
