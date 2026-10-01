// Single source of truth for navigation and the lifecycle.

export const PRESCAN_PAGES = [
  {
    path: '/pre-scan/repository-intelligence',
    label: 'Repository intelligence',
    stage: 'Understand the codebase',
    description: 'What the application does, how it is built, and where security review should start.',
  },
  {
    path: '/pre-scan/architecture',
    label: 'Architecture map',
    stage: 'Understand the codebase',
    description: 'Components, relationships, execution flows and data flows.',
  },
  {
    path: '/pre-scan/threat-model',
    label: 'Threat model',
    stage: 'Find what can go wrong',
    description: 'Assets, trust boundaries, actors, threats and attack paths.',
  },
  {
    path: '/pre-scan/security-review-plan',
    label: 'Security assessment',
    stage: 'Plan the review',
    description: 'Review priorities, unresolved areas, threat convergence and scan targets.',
  },
];

export const TRACEABILITY_PAGES = [
  {
    path: '/evidence',
    label: 'Source evidence',
    description: 'Audit references used to support mapped security information.',
  },
  {
    path: '/pre-scan/raw-artifacts',
    label: 'Codebase raw artifacts',
    description: 'Inspect original uploaded report files across the selected codebase.',
  },
];

export const SCANNING_PAGES = [
  { path: '/scanning/overview', label: 'Analysis dashboard' },
  { path: '/scanning/findings', label: 'Findings' },
  { path: '/scanning/coverage', label: 'Scan scope' },
];

export const FINDING_PAGES = [
  { path: '/findings-cases/triage', label: 'Triage', stage: 'triage' },
  { path: '/findings-cases/priority', label: 'Priority queue', stage: 'prioritization' },
  { path: '/findings-cases/remediation', label: 'Remediation', stage: 'investigation' },
];

export const POSTSCAN_PAGES = [
  { path: '/post-scan/verification', label: 'Verification & Closure', stage: 'fix-verification' },
];

export const UPCOMING_PHASES = [];

export const PRESCAN_STAGES = [
  {
    id: 'repository-intelligence',
    number: '01',
    title: 'Understand the codebase',
    summary: 'Build a plain-language picture of what the application does, how it is built, and how it runs.',
    shows: [
      'Application purpose and technology stack',
      'Components, APIs and execution flows',
      'Data stores, integrations and configuration',
      'Authentication and authorization implementation',
    ],
    to: '/pre-scan/repository-intelligence',
  },
  {
    id: 'threat-modeling',
    number: '02',
    title: 'Map architecture and threats',
    summary: 'Bring architecture, trust boundaries, assets, threat actors and attack paths into one model.',
    shows: [
      'High-value assets and sensitive data',
      'Trust boundaries and threat actors',
      'Threat scenarios with a full trace',
      'Attack paths and threat relationships',
    ],
    to: '/pre-scan/threat-model',
  },
  {
    id: 'security-baseline',
    number: '03',
    title: 'Build the security assessment',
    summary: 'Decide which security surfaces matter most, where visibility is limited, and which scans should run next.',
    shows: [
      'Security-critical components and dependencies',
      'Threat convergence points',
      'Limited-visibility and unresolved areas',
      'Recommended scan type and target',
    ],
    to: '/pre-scan/security-review-plan',
  },
];

export const HISTORY_PAGES = [
  { path: '/history', label: 'Codebases' },
];
