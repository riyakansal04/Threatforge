import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  FolderClock,
  GitBranch,
  Layers3,
  ScanSearch,
  ShieldCheck,
  Upload,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: GitBranch,
    title: 'Codebase context',
    text: 'Named project spaces keep repositories, demos, and review runs separated.',
  },
  {
    icon: Layers3,
    title: 'Stage mapping',
    text: 'Architecture, threats, scans, triage, remediation, and verification stay connected.',
  },
  {
    icon: ScanSearch,
    title: 'Evidence review',
    text: 'Findings stay tied to raw artifacts, source references, and review evidence.',
  },
  {
    icon: ShieldCheck,
    title: 'Closure readiness',
    text: 'Verified fixes and decisions preserve the reasoning needed for assurance review.',
  },
];

const STEPS = [
  {
    icon: FolderClock,
    title: 'Select codebase',
    text: 'Start from the project context that owns the reports.',
  },
  {
    icon: Upload,
    title: 'Load reports',
    text: 'Upload the raw artifacts produced during the review.',
  },
  {
    icon: FileSearch,
    title: 'Inspect evidence',
    text: 'Review findings, paths, stages, and supporting details together.',
  },
  {
    icon: CheckCircle2,
    title: 'Close with trace',
    text: 'Carry decisions through remediation and verification.',
  },
];

const ASSURANCE_STAGES = [
  'Intelligence',
  'Threat Model',
  'Scanning',
  'Triage',
  'Priority',
  'Remediation',
  'Verification',
];

export default function About() {
  return (
    <div className="about-page stack">
      <section className="about-hero">
        <div className="about-hero__copy">
          <div className="eyebrow">About ThreatForge</div>
          <h1>Security review evidence, decisions, and fix status in one workspace.</h1>
          <p>
            ThreatForge turns uploaded report packages into a mapped assurance workflow so teams can review what was
            found, why it matters, what changed, and what is ready for closure.
          </p>
          <div className="hero__actions">
            <Link to="/upload" className="btn btn--primary btn--lg">
              Start upload <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/history" className="btn btn--lg">View history</Link>
          </div>
          <div className="about-hero__signals" aria-label="ThreatForge review outputs">
            <span>Evidence mapped</span>
            <span>Risk decisions</span>
            <span>Fix verification</span>
          </div>
        </div>

        <div className="about-board" aria-label="ThreatForge assurance path">
          <div className="about-board__head">
            <span><ShieldCheck size={18} aria-hidden="true" /> Assurance path</span>
            <strong>7 stages</strong>
          </div>
          <div className="about-board__summary">
            <strong>Upload to closure</strong>
            <span>One traceable path across every review stage.</span>
          </div>
          <div className="about-board__rail">
            {ASSURANCE_STAGES.map((stage, index) => (
              <span className={index === 6 ? 'is-current' : ''} key={stage}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                {stage}
              </span>
            ))}
          </div>
          <div className="about-board__metrics">
            <span>Raw files</span>
            <span>Mapped findings</span>
            <span>Verified fixes</span>
          </div>
        </div>
      </section>

      <section className="about-grid">
        {SECTIONS.map(({ icon: Icon, title, text }, index) => (
          <article className="about-card" key={title}>
            <div className="about-card__head">
              <span className="feature__icon"><Icon size={18} aria-hidden="true" /></span>
              <h2>{title}</h2>
              <span className="about-card__index">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="panel about-flow-panel">
        <header className="panel__head">
          <h2 className="panel__title">How a review moves through ThreatForge</h2>
          <p className="panel__hint">The workspace keeps raw reports, mapped data, and decisions connected.</p>
        </header>
        <div className="panel__body">
          <ol className="review-steps">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Icon size={18} aria-hidden="true" />
                <strong>{title}</strong>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
