import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock, Play, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import LifecycleFlow from '../components/LifecycleFlow.jsx';
import { flowNodes, topMetrics } from '../lib/lifecycle.js';

const FALLBACK_SIGNALS = {
  triage: [
    { label: 'Triage decisions', valueKey: 'triage_decisions' },
    { label: 'False-positive reasons', valueKey: 'false_positive_reasons' },
    { label: 'Approval queue', valueKey: 'triage_decisions' },
  ],
  prioritization: [
    { label: 'Priority queue', valueKey: 'priority_queue' },
    { label: 'Risk-ranked items', valueKey: 'priority_queue' },
    { label: 'Approved findings', valueKey: 'priority_queue' },
  ],
  remediation: [
    { label: 'Fix proposals', valueKey: 'remediations' },
    { label: 'Root-cause notes', valueKey: 'root_causes' },
    { label: 'Fix approvals', valueKey: 'remediations' },
  ],
  verification: [
    { label: 'Fix verification', valueKey: 'targeted_verifications' },
    { label: 'Regression checks', valueKey: 'regression_verifications' },
    { label: 'Closure decisions', valueKey: 'closure_assessments' },
  ],
};

function previewSignals(node, overview = {}) {
  const { stage, status } = node;
  if (stage.id === 'scanning') {
    const scanRows = (status.subRows || []).filter((row) => (row.runs || row.findings));
    if (scanRows.length) {
      return scanRows.slice(0, 4).map((row) => ({
        label: row.label || row.key,
        value: row.findings || row.runs || 0,
        hint: row.findings ? 'findings' : 'reports',
      }));
    }
    return [
      { label: 'Reports uploaded', value: overview.scan_count || 0, hint: 'scan evidence' },
      { label: 'Scan types run', value: overview.scan_types_run || 0, hint: 'coverage' },
      { label: 'Findings reported', value: overview.finding_total || 0, hint: 'signals' },
    ];
  }

  const metrics = topMetrics(status, stage.id, 4);
  if (metrics.length) {
    return metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      hint: stage.id === 'intelligence' ? 'mapped from reports' : 'ready for review',
    }));
  }

  const fallback = FALLBACK_SIGNALS[stage.id] || [];
  if (fallback.length) {
    return fallback.map((item) => ({
      label: item.label,
      value: status.metrics?.[item.valueKey] || 0,
      hint: 'awaiting mapped output',
    }));
  }

  return [
    { label: 'Mapped evidence', value: status.mappedCount, hint: `${status.total || 0} expected inputs` },
    { label: 'Runs uploaded', value: status.runs || 0, hint: 'uploaded reports' },
  ];
}

export function StagePreviewCard({ node, overview, onClose }) {
  if (!node) return null;
  const { stage, status, state } = node;
  const mappedPct = status.total ? Math.round((status.mappedCount / status.total) * 100) : 0;
  const visibleSteps = stage.subprocesses?.slice(0, 4) || [];
  const signals = previewSignals(node, overview);

  const drawer = (
    <aside className={`flow-preview flow-preview--${state}`}>
      <button type="button" className="flow-preview__close" onClick={onClose} aria-label="Close stage details">
        <X size={16} aria-hidden="true" />
      </button>
      <div className="flow-preview__head">
        <span className="flow-preview__number">{stage.number}</span>
        <div>
          <strong>{stage.title}</strong>
          <small>{stage.verb}</small>
        </div>
      </div>
      <p>{stage.summary}</p>
      <div className="flow-preview__signals">
        {signals.map((item, index) => (
          <article className="flow-preview-signal" key={`${item.label}-${index}`}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.hint}</small>
          </article>
        ))}
      </div>
      <div className="flow-preview__coverage">
        <span><b>Stage evidence</b><em>{mappedPct}%</em></span>
        <i><u style={{ width: `${mappedPct}%` }} /></i>
      </div>
      {visibleSteps.length > 0 && (
        <div className="flow-preview__chips">
          {visibleSteps.map((step) => (
            <span key={step.label}><CheckCircle2 size={13} aria-hidden="true" /> {step.label}</span>
          ))}
        </div>
      )}
      {stage.approvalBefore && (
        <Link className="flow-preview__gate" to={stage.approvalBefore.to}>
          <Lock size={14} aria-hidden="true" />
          <span>{stage.approvalBefore.label}</span>
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      )}
      <Link className="flow-preview__cta" to={stage.to}>
        Explore this stage
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </aside>
  );
  return typeof document === 'undefined' ? drawer : createPortal(drawer, document.body);
}

export default function LifecycleFlowPage() {
  const { data: statusData, error: statusError } = useApi(api.status);
  const scanFn = useMemo(() => () => api.scanOverview(), []);
  const { data: scanData } = useApi(scanFn);
  const statuses = statusData?.stages || [];
  const overview = scanData || {};
  const nodes = useMemo(() => flowNodes(statuses, overview), [statuses, overview]);
  const defaultId = nodes.find((n) => n.state === 'active')?.stage.id || nodes[0]?.stage.id;
  const [selectedId, setSelectedId] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [touring, setTouring] = useState(false);
  const [tourStep, setTourStep] = useState(-1);
  const tourTimer = useRef(null);
  const tourInterval = useRef(null);
  const activeId = selectedId || defaultId;
  const preview = nodes.find((n) => n.stage.id === previewId);

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
    <div className="stack">
      <div className="page-head flow-page-head">
        <div>
          <div className="eyebrow">ThreatForge workflow</div>
          <h1>Follow the review from intelligence to verified fix.</h1>
          <p>Click a stage to see what matters most so far, or play the flow to watch it connect end to end.</p>
        </div>
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
        <>
          <section className={`panel flow-panel ${preview ? 'has-drawer' : ''}`}>
            <LifecycleFlow nodes={nodes} selectedId={activeId} openId={previewId} onSelect={setSelectedId} onPreview={setPreviewId} isPlaying={touring} playIndex={tourStep} />
            <StagePreviewCard node={preview} overview={overview} onClose={() => setPreviewId('')} />
          </section>
        </>
      )}
    </div>
  );
}
