import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bug,
  CheckCircle2,
  Database,
  GitPullRequestArrow,
  ListChecks,
  Play,
  ScanSearch,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import LifecycleFlow from '../components/LifecycleFlow.jsx';
import { StagePreviewCard } from './LifecycleFlowPage.jsx';
import { flowNodes } from '../lib/lifecycle.js';
import { sevClass } from '../lib/scanning.js';

const n = (value) => Number(value) || 0;
const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const keyOf = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const SEVERITY = [
  ['critical', '#ff7568'],
  ['high', '#f2924b'],
  ['medium', '#f2b84b'],
  ['low', '#38bdf8'],
];

const SCAN_TYPES = [
  ['standard', 'Standard'],
  ['deep', 'Deep'],
  ['module', 'Module'],
  ['exploitable', 'Exploitable'],
  ['supply_chain', 'Dependency'],
  ['runtime', 'Runtime'],
];

function donutSegments(items, fallback = true) {
  const total = items.reduce((sum, item) => sum + n(item.value), 0);
  if (!total && fallback) {
    return 'rgba(55,228,178,.22) 0 28%, rgba(56,189,248,.18) 28% 55%, rgba(242,184,75,.15) 55% 78%, rgba(255,117,104,.13) 78% 100%';
  }
  let cursor = 0;
  return items.map((item) => {
    const size = (n(item.value) / total) * 100;
    const start = cursor;
    cursor += size;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(', ');
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function Kpi({ icon: Icon, label, value, hint, tone }) {
  return (
    <article className={`insight-kpi insight-kpi--${tone}`}>
      <span><Icon size={18} aria-hidden="true" /></span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
        <em>{hint}</em>
      </div>
    </article>
  );
}

function findingSeverity(finding) {
  return sevClass(finding?.severity || finding?.attributes?.sarif_level);
}

function findingScan(finding) {
  return keyOf(finding?.scan_type || '');
}

function findingCategory(finding) {
  return String(finding?.category || finding?.cwe || finding?.security_identifier || finding?.affected_area || 'Unclassified').trim();
}

const RISK_WEIGHT = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function deriveModel({ nodes, overview, repo, threatModel, baseline, findings, selectedSeverity, selectedScan }) {
  const mapped = nodes.filter((node) => node.status.hasData).length;
  const repoData = repo?.data || {};
  const tm = threatModel?.threat_model || {};
  const sb = baseline?.security_baseline || {};

  const attackSurface = {
    entry: arr(repoData.entry_points).length,
    api: arr(repoData.apis).length + arr(repoData.routes).length + arr(repoData.externally_accessible_interfaces).length,
    data: arr(repoData.data_stores).length + arr(repoData.data_flows).length,
    integration: arr(repoData.integrations).length + arr(repoData.external_services).length + arr(repoData.webhooks).length,
    privileged: arr(repoData.privileged_functionality).length + arr(repoData.sensitive_processing).length,
  };
  const attackTotal = Object.values(attackSurface).reduce((sum, value) => sum + value, 0);
  const threatPressure = arr(threatModel?.threats).length + arr(tm.threat_actors).length + arr(tm.trust_boundaries).length;
  const scanFocus = arr(baseline?.scan_focus).length + arr(sb.security_sensitive_apis).length + arr(sb.security_critical_components).length;
  const mappedPct = Math.round((mapped / Math.max(nodes.length, 1)) * 100);
  const evidenceDepth = n(overview.scan_count) + nodes.reduce((sum, node) => sum + n(node.status.runs), 0);
  const readiness = clamp(Math.round((mappedPct * 0.45) + Math.min(evidenceDepth * 8, 32) + Math.min(scanFocus * 3, 23)));
  const surfacePressure = clamp(Math.round(Math.min(attackTotal * 6 + threatPressure * 4, 100)));

  const allFindings = arr(findings);
  const byScan = selectedScan === 'all' ? allFindings : allFindings.filter((finding) => findingScan(finding) === selectedScan);
  const filteredFindings = byScan.filter((finding) => selectedSeverity === 'all' || findingSeverity(finding) === selectedSeverity);
  const severity = SEVERITY.map(([key, color]) => ({
    key,
    color,
    value: byScan.filter((finding) => findingSeverity(finding) === key).length,
  }));
  const highRiskFindings = byScan.filter((finding) => ['critical', 'high'].includes(findingSeverity(finding))).length;
  const riskPoints = byScan.reduce((sum, finding) => sum + (RISK_WEIGHT[findingSeverity(finding)] || 1), 0);
  const findingPressure = clamp(Math.round((riskPoints / Math.max(byScan.length * 5, 1)) * 100));
  const approvalPressure = clamp(Math.round((highRiskFindings / Math.max(byScan.length, 1)) * 100));
  const fixPressure = clamp(Math.round(Math.min(scanFocus * 4, 100)));
  const proofCoverage = mappedPct;
  const scanSignals = SCAN_TYPES.map(([key, label]) => {
    const rows = allFindings.filter((finding) => findingScan(finding) === key);
    const scopedRows = selectedSeverity === 'all' ? rows : rows.filter((finding) => findingSeverity(finding) === selectedSeverity);
    return { key, label, findings: scopedRows.length, total: rows.length };
  });
  const riskConcentration = Object.values(filteredFindings.reduce((acc, finding) => {
    const label = findingCategory(finding);
    const key = keyOf(label);
    const severityKey = findingSeverity(finding);
    acc[key] = acc[key] || { key, label, score: 0, count: 0 };
    acc[key].score += RISK_WEIGHT[severityKey] || 1;
    acc[key].count += 1;
    return acc;
  }, {})).sort((a, b) => b.score - a.score).slice(0, 6);
  return {
    mapped,
    mappedPct,
    readiness,
    attackSurface,
    attackTotal,
    threatPressure,
    scanFocus,
    surfacePressure,
    scanSignals,
    severity,
    highRiskFindings,
    riskPoints,
    findingPressure,
    approvalPressure,
    fixPressure,
    proofCoverage,
    riskConcentration,
    filteredFindings,
    selectedSeverity,
    selectedScan,
    reports: n(overview.scan_count),
    scanTypesRun: n(overview.scan_types_run),
  };
}

function AttackSurfaceMap({ model }) {
  const items = [
    ['Entry exposure', model.attackSurface.entry, '#37e4b2'],
    ['API surface', model.attackSurface.api, '#38bdf8'],
    ['Data movement', model.attackSurface.data, '#f2b84b'],
    ['Integrations', model.attackSurface.integration, '#a78bfa'],
    ['Privileged paths', model.attackSurface.privileged, '#ff7568'],
  ];
  const max = Math.max(...items.map(([, value]) => value), 1);
  return (
    <article className="insight-card insight-card--surface">
      <header className="insight-card__head">
        <div>
          <span>ATTACK SURFACE & THREAT INSIGHTS</span>
          <h2>Application Attack Surface</h2>
        </div>
        <Target size={20} aria-hidden="true" />
      </header>
      <div className="surface-orbit" aria-hidden="true">
        <span className="surface-orbit__core"><ShieldCheck size={28} /><b>{model.surfacePressure}</b></span>
        {items.map(([label, value], index) => (
          <i
            key={label}
            className={`surface-orbit__node surface-orbit__node--${index + 1}`}
            style={{ '--size': `${34 + ((value / max) * 26)}px`, '--color': items[index][2] }}
            title={label}
          />
        ))}
      </div>
      <div className="surface-list">
        {items.map(([label, value, color]) => (
          <span key={label}>
            <i style={{ background: color }} />
            <b>{label}</b>
            <em>{value}</em>
          </span>
        ))}
      </div>
    </article>
  );
}

function EvidenceReadiness({ model }) {
  const critical = model.severity.find((item) => item.key === 'critical')?.value || 0;
  const high = model.severity.find((item) => item.key === 'high')?.value || 0;
  return (
    <article className="insight-card insight-card--risk-score">
      <header className="insight-card__head">
        <div>
          <span>RISK FROM CURRENT FINDINGS</span>
          <h2>Security Risk Score</h2>
        </div>
        <Database size={20} aria-hidden="true" />
      </header>
      <div className="risk-score-layout">
        <div className="risk-score-gauge" style={{ '--score': `${model.findingPressure}%` }}>
          <span><strong>{model.findingPressure}</strong><small>Risk score</small></span>
        </div>
        <div className="risk-score-facts">
          <span><b>{critical}</b><em>Critical</em></span>
          <span><b>{high}</b><em>High</em></span>
          <span><b>{model.highRiskFindings}</b><em>Need approval</em></span>
          <span><b>{model.riskPoints}</b><em>Risk points</em></span>
        </div>
      </div>
      <p className="insight-note">Severity-weighted score from the selected findings.</p>
    </article>
  );
}

function SeverityCard({ model, selectedSeverity, onSelectSeverity, selectedScan, onSelectScan }) {
  const total = model.severity.reduce((sum, item) => sum + item.value, 0);
  return (
    <article className="insight-card insight-card--findings">
      <header className="insight-card__head">
        <div>
          <span>Findings by Severity and Scan Type</span>
          <h2>{total ? 'Explore Findings by Severity and Scan Source' : 'No classified findings yet'}</h2>
        </div>
        <Bug size={20} aria-hidden="true" />
      </header>
      <div className="severity-layout">
        <div className="severity-donut" style={{ background: `conic-gradient(${donutSegments(model.severity)})` }}>
          <span><strong>{total}</strong><small>Signals</small></span>
        </div>
        <div className="severity-legend">
          {model.severity.map((item) => (
            <button
              type="button"
              className={selectedSeverity === item.key ? 'is-selected' : ''}
              key={item.key}
              onClick={() => onSelectSeverity(selectedSeverity === item.key ? 'all' : item.key)}
            >
              <i style={{ background: item.color }} />
              <b>{item.key}</b>
              <em>{item.value}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="scan-slicer" aria-label="Scan source filter">
        {model.scanSignals.map((row) => (
          <button
            type="button"
            className={selectedScan === row.key ? 'is-selected' : ''}
            key={row.key}
            onClick={() => onSelectScan(selectedScan === row.key ? 'all' : row.key)}
          >
            <b>{row.label}</b>
            <em>{row.findings}</em>
          </button>
        ))}
      </div>
    </article>
  );
}

function RiskConcentrationGraph({ model }) {
  const max = Math.max(...model.riskConcentration.map((item) => item.score), 1);
  return (
    <article className="insight-card insight-card--wide">
      <header className="insight-card__head">
        <div>
          <span>SECURITY RISK OVERVIEW</span>
          <h2>Top Security Risks</h2>
        </div>
        <TrendingUp size={20} aria-hidden="true" />
      </header>
      {model.riskConcentration.length ? (
        <div className="risk-concentration">
          {model.riskConcentration.map((item, index) => (
            <div className="risk-column" key={item.key} title={item.label}>
              <span>
                <i style={{ height: `${Math.max((item.score / max) * 100, 12)}%`, '--delay': `${index * 70}ms` }} />
              </span>
              <b title={item.label}>{item.label}</b>
              <em>{item.score} risk pts</em>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-visual">
          <Target size={34} />
          <p>Risk concentration will appear when findings match the selected slicers.</p>
        </div>
      )}
    </article>
  );
}

function GovernanceCard({ model }) {
  const readinessItems = [
    ['Evidence loaded', model.reports > 0],
    ['Findings classified', model.filteredFindings.length > 0],
    ['High risk flagged', model.highRiskFindings > 0],
    ['Workflow mapped', model.mapped >= 5],
  ];
  const readyCount = readinessItems.filter(([, ready]) => ready).length;
  const readyPct = Math.round((readyCount / readinessItems.length) * 100);
  return (
    <article className="insight-card insight-card--readiness">
      <header className="insight-card__head">
        <div>
          <span>GOVERNED REVIEW</span>
          <h2>Review Readiness</h2>
        </div>
        <ListChecks size={20} aria-hidden="true" />
      </header>
      <div className="readiness-case">
        <div className="readiness-case__gauge" style={{ '--score': `${readyPct}%` }}>
          <span><strong>{readyPct}</strong><small>% ready</small></span>
        </div>
        <div className="readiness-case__checks">
          {readinessItems.map(([label, ready]) => (
            <span className={ready ? 'is-ready' : ''} key={label}>
              <CheckCircle2 size={15} aria-hidden="true" />
              <b>{label}</b>
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function Hero({ nodes, overview, statusError }) {
  const defaultId = nodes.find((node) => node.state === 'active')?.stage.id || nodes[0]?.stage.id || '';
  const [selectedId, setSelectedId] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [touring, setTouring] = useState(false);
  const [tourStep, setTourStep] = useState(-1);
  const tourTimer = useRef(null);
  const tourInterval = useRef(null);
  const activeId = selectedId || defaultId;
  const preview = nodes.find((node) => node.stage.id === previewId);

  useEffect(() => () => {
    clearTimeout(tourTimer.current);
    clearInterval(tourInterval.current);
  }, []);

  const playFlow = () => {
    if (touring || !nodes.length) return;
    clearTimeout(tourTimer.current);
    clearInterval(tourInterval.current);
    setTouring(true);
    setTourStep(0);
    setPreviewId('');
    tourInterval.current = setInterval(() => {
      setTourStep((current) => {
        if (current >= nodes.length - 1) return current;
        return current + 1;
      });
    }, 900);
    tourTimer.current = setTimeout(() => {
      clearInterval(tourInterval.current);
      setTouring(false);
      setTourStep(-1);
    }, nodes.length * 900 + 450);
  };

  return (
    <section className="home-workflow-hero" aria-labelledby="home-title">
      <div className="home-workflow-hero__head">
        <h1 id="home-title">Find the flaw. Fix the code. Prove it's fixed.</h1>
        <p>
          Transform threat intelligence into governed security decisions, actionable fixes, and verified outcomes.
        </p>
        <button type="button" className="btn btn--primary flow-play-btn" onClick={playFlow} disabled={touring}>
          <Play size={15} aria-hidden="true" />
          {touring ? 'Playing...' : 'Start flow'}
        </button>
      </div>

      {statusError && (
        <div className="banner banner--danger">
          <span>Could not load workflow status: {statusError}. Check that the backend is running.</span>
        </div>
      )}

      {!statusError && (
        <div className="home-workflow-hero__diagram">
          <LifecycleFlow
            nodes={nodes}
            selectedId={activeId}
            openId={previewId}
            onSelect={setSelectedId}
            onPreview={setPreviewId}
            isPlaying={touring}
            playIndex={tourStep}
          />
          <StagePreviewCard node={preview} overview={overview} onClose={() => setPreviewId('')} />
        </div>
      )}
    </section>
  );
}

function AssuranceStrip() {
  const cards = [
    ['You are in Control', 'Review and approve every critical step.'],
    ['Backed by Evidence', 'Every finding linked to its evidence.'],
    ['Audit-ready', 'Track every finding, fix, and verification.'],
  ];
  return (
    <section className="assurance-strip" aria-label="ThreatForge assurances">
      {cards.map(([title, copy]) => (
        <article className="assurance-card" key={title}>
          <strong>{title}</strong>
          <span>{copy}</span>
        </article>
      ))}
    </section>
  );
}

export default function Home() {
  const { data: statusData, error: statusError } = useApi(api.status);
  const scanFn = useMemo(() => () => api.scanOverview(), []);
  const { data: scanData } = useApi(scanFn);
  const { data: repoData } = useApi(api.repositoryIntelligence);
  const { data: threatModelData } = useApi(api.threatModel);
  const { data: baselineData } = useApi(api.securityBaseline);
  const findingsFn = useMemo(() => () => api.scanFindings(), []);
  const { data: findingsData } = useApi(findingsFn);
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedScan, setSelectedScan] = useState('all');

  const statuses = statusData?.stages || [];
  const overview = scanData || {};
  const nodes = useMemo(() => flowNodes(statuses, overview), [statuses, overview]);
  const model = deriveModel({
    nodes,
    overview,
    repo: repoData,
    threatModel: threatModelData,
    baseline: baselineData,
    findings: findingsData?.findings || [],
    selectedSeverity,
    selectedScan,
  });

  return (
    <div className="insight-home">
      <Hero nodes={nodes} overview={overview} statusError={statusError} />
      <section className="insight-kpis" aria-label="Derived security insights">
        <Kpi icon={Target} tone="danger" label="Attack surface pressure" value={model.surfacePressure} hint="Exposed entry points and APIs." />
        <Kpi icon={Database} tone="accent" label="Evidence Coverage" value={model.readiness} hint="Evidence across your assessment." />
        <Kpi icon={ScanSearch} tone="info" label="Security Findings" value={model.filteredFindings.length} hint="Findings by severity and scan type." />
        <Kpi icon={GitPullRequestArrow} tone="warn" label="Areas Under Review" value={model.scanFocus} hint="Application areas being assessed." />
      </section>
      <section className="insight-grid" aria-label="ThreatForge dashboard visuals">
        <AttackSurfaceMap model={model} />
        <RiskConcentrationGraph model={model} />
        <EvidenceReadiness model={model} />
        <SeverityCard
          model={model}
          selectedSeverity={selectedSeverity}
          onSelectSeverity={setSelectedSeverity}
          selectedScan={selectedScan}
          onSelectScan={setSelectedScan}
        />
        <GovernanceCard model={model} />
        <AssuranceStrip />
      </section>
    </div>
  );
}
