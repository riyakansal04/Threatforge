// Single source of truth for the top-level security lifecycle flow (Home -> Flow page).
// Distinct from the more granular STAGE_LABELS/STAGE_PAGES in stages.js: each flow stage
// summarizes several of those granular stage keys under one visual node.
//
// Note: the backend's /api/status endpoint only reports on mapper stages (repository
// intelligence, threat modeling, ..., closure) - it does not know about the six scan
// types, which live under /api/scanning/overview instead. The Scanning node's status is
// therefore computed separately from scan-overview data, not from /api/status.

export const LIFECYCLE_STAGES = [
  {
    id: 'intelligence',
    number: '01',
    title: 'Intelligence',
    verb: 'Understand the repository before scanning.',
    summary: 'Repository intelligence, architecture and threat modeling, and security assessment create the review baseline.',
    icon: 'Radar',
    stageKeys: ['repository-intelligence', 'threat-modeling', 'security-baseline'],
    to: '/pre-scan',
    subprocesses: [
      { label: 'Repository intelligence', to: '/pre-scan/repository-intelligence' },
      { label: 'Architecture & threat model', to: '/pre-scan/threat-model' },
      { label: 'Security assessment', to: '/pre-scan/security-review-plan' },
    ],
  },
  {
    id: 'scanning',
    number: '02',
    title: 'Scanning',
    verb: 'Run the six scan perspectives.',
    summary: 'Standard, deep, module, exploitable, dependency and runtime scan coverage.',
    icon: 'ScanSearch',
    stageKeys: ['standard-scan', 'deep-scan', 'module-scan', 'exploitable-scan', 'dependency-scan', 'runtime-validation'],
    to: '/scanning',
    subprocesses: [
      { label: 'Standard scan', to: '/scanning/overview' },
      { label: 'Deep scan', to: '/scanning/overview' },
      { label: 'Module scan', to: '/scanning/overview' },
      { label: 'Exploitable scan', to: '/scanning/overview' },
      { label: 'Dependency scan', to: '/scanning/overview' },
      { label: 'Runtime scan', to: '/scanning/overview' },
    ],
  },
  {
    id: 'triage',
    number: '03',
    title: 'Triage',
    verb: 'Confirm real findings and explain false positives.',
    summary: 'Classify scanner output into confirmed findings, false positives, duplicates and validation-required items.',
    icon: 'ListChecks',
    stageKeys: ['triage'],
    to: '/findings-cases/triage',
    subprocesses: [
      { label: 'Confirmed findings', to: '/findings-cases/triage' },
      { label: 'False-positive reasons', to: '/findings-cases/triage' },
      { label: 'Human approval', to: '/findings-cases/triage' },
    ],
  },
  {
    id: 'prioritization',
    number: '04',
    title: 'Prioritization',
    verb: 'Rank only the approved findings.',
    summary: 'Approved findings move into a risk-aware queue with priority, reason, owner and work-plan context.',
    icon: 'TrendingUp',
    stageKeys: ['prioritization'],
    to: '/findings-cases/priority',
    approvalBefore: {
      label: 'Human approval',
      to: '/findings-cases/triage',
      description: 'Reviewer confirms triage decisions before anything enters prioritization.',
    },
    subprocesses: [
      { label: 'Risk ranking', to: '/findings-cases/priority' },
      { label: 'Priority reasons', to: '/findings-cases/priority' },
      { label: 'Remediation queue', to: '/findings-cases/priority' },
    ],
  },
  {
    id: 'remediation',
    number: '05',
    title: 'Remediation',
    verb: 'Generate and review fixes.',
    summary: 'Root cause, proposed fixes, changed files, validation notes and residual risk are reviewed before work is created.',
    icon: 'Wrench',
    stageKeys: ['investigation', 'remediation'],
    to: '/findings-cases/remediation',
    subprocesses: [
      { label: 'Root cause', to: '/findings-cases/remediation' },
      { label: 'Fix proposal', to: '/findings-cases/remediation' },
      { label: 'Fix approval', to: '/findings-cases/remediation' },
      { label: 'Work handoff', to: '/findings-cases/remediation' },
    ],
  },
  {
    id: 'verification',
    number: '06',
    title: 'Post-scan Verification',
    verb: 'Prove the fix and close the case.',
    summary: 'Verify the original weakness, check related paths for regressions, and decide closure with evidence.',
    icon: 'ShieldCheck',
    stageKeys: ['fix-verification', 'regression', 'closure'],
    to: '/post-scan/verification',
    approvalBefore: {
      label: 'Fix approval',
      to: '/findings-cases/remediation',
      description: 'Reviewer approves the remediation before verification starts.',
    },
    subprocesses: [
      { label: 'Fix verification', to: '/post-scan/verification' },
      { label: 'Regression check', to: '/post-scan/regression' },
      { label: 'Closure', to: '/post-scan/closure' },
    ],
  },
];

function mapperStageStatus(stage, statuses = []) {
  const rows = statuses.filter((s) => stage.stageKeys.includes(s.key));
  const mapped = rows.filter((s) => s.has_data);
  const runs = rows.reduce((sum, s) => sum + (Number(s.runs) || 0), 0);
  const updatedAt = rows.map((s) => s.last_run_at).filter(Boolean).sort().at(-1);
  const metrics = {};
  rows.forEach((row) => {
    Object.entries(row.counts || {}).forEach(([key, value]) => {
      metrics[key] = (metrics[key] || 0) + (Number(value) || 0);
    });
  });
  return {
    total: stage.stageKeys.length,
    mappedCount: mapped.length,
    hasData: mapped.length > 0,
    runs,
    updatedAt,
    metrics,
    subRows: rows.map((s) => ({ key: s.key, hasData: !!s.has_data, runs: Number(s.runs) || 0 })),
  };
}

function scanningStageStatus(scanOverview = {}) {
  const byType = scanOverview.by_type || [];
  const mapped = byType.filter((t) => t.count > 0);
  return {
    total: 6,
    mappedCount: mapped.length,
    hasData: (scanOverview.scan_count || 0) > 0,
    runs: scanOverview.scan_count || 0,
    updatedAt: undefined,
    subRows: byType.map((t) => ({ key: t.scan_type, label: t.label, hasData: t.count > 0, runs: t.count || 0, findings: t.findings || 0 })),
  };
}

// Curated, ranked metric keys per stage - drawn only from fields the backend actually
// reports counts for (see backend/app/mapper/fields.py STAGES). Only nonzero metrics are
// shown, capped at 4, so the flow page highlights the handful that matter instead of a
// full data dump.
export const STAGE_METRICS = {
  intelligence: [
    ['components', 'Components mapped'],
    ['apis', 'APIs & endpoints'],
    ['entry_points', 'Entry points'],
    ['integrations', 'Integrations'],
    ['threats', 'Threats identified'],
    ['assets', 'Assets identified'],
  ],
  triage: [
    ['triage_decisions', 'Triage decisions'],
    ['finding_relationships', 'Duplicate links resolved'],
  ],
  prioritization: [
    ['priority_queue', 'Priority queue items'],
  ],
  remediation: [
    ['remediations', 'Remediation proposals'],
  ],
  verification: [
    ['targeted_verifications', 'Fixes verified'],
    ['regression_verifications', 'Regression checks'],
    ['closure_assessments', 'Closure decisions'],
  ],
};

export function topMetrics(status, stageId, max = 4) {
  const defs = STAGE_METRICS[stageId] || [];
  return defs
    .map(([key, label]) => ({ key, label, value: status.metrics?.[key] || 0 }))
    .filter((item) => item.value > 0)
    .slice(0, max);
}

export function flowNodes(statuses = [], scanOverview = {}) {
  const nodes = LIFECYCLE_STAGES.map((stage) => ({
    stage,
    status: stage.id === 'scanning' ? scanningStageStatus(scanOverview) : mapperStageStatus(stage, statuses),
  }));
  let activeAssigned = false;
  return nodes.map((node, index) => {
    const prevComplete = index === 0 || nodes[index - 1].status.hasData;
    let state = 'pending';
    if (node.status.hasData) state = 'complete';
    else if (prevComplete && !activeAssigned) {
      state = 'active';
      activeAssigned = true;
    }
    return { ...node, state };
  });
}
