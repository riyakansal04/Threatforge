import { Link } from 'react-router-dom';
import { ArrowRight, FolderClock, Layers3, ScanSearch, ShieldCheck } from 'lucide-react';

const SECTIONS = [
  {
    icon: FolderClock,
    title: 'Codebase-centered workspace',
    text: 'Each upload belongs to a named project context, so repositories, demos, and review runs stay cleanly separated.',
  },
  {
    icon: Layers3,
    title: 'Readable security context',
    text: 'Architecture, assets, threats, scan plans, findings, and evidence are presented as one review path.',
  },
  {
    icon: ScanSearch,
    title: 'Scan results with context',
    text: 'Reports can be inspected individually or together, with findings tied back to their source files.',
  },
  {
    icon: ShieldCheck,
    title: 'Traceable decisions',
    text: 'Triage, priority, remediation, verification, and closure records preserve the reasoning behind decisions.',
  },
];

const STEPS = [
  'Choose or create a codebase.',
  'Upload the report files produced during the security review.',
  'Review the mapped codebase, threat model, scan results, findings, and evidence trail.',
  'Use the finding review path to track decisions through remediation and closure.',
];

export default function About() {
  return (
    <div className="stack">
      <section className="about-hero">
        <div>
          <div className="eyebrow">About ThreatForge</div>
          <h1>From scattered security reports to a presentation-ready review workspace.</h1>
          <p>
            ThreatForge organizes security analysis around codebases, evidence, scan results, findings, remediation,
            and closure so teams can browse, compare, and explain the review with confidence.
          </p>
          <div className="hero__actions">
            <Link to="/upload" className="btn btn--primary btn--lg">
              Start upload <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/history" className="btn btn--lg">View history</Link>
          </div>
        </div>
      </section>

      <section className="about-grid">
        {SECTIONS.map(({ icon: Icon, title, text }) => (
          <article className="about-card" key={title}>
            <span className="feature__icon"><Icon size={18} aria-hidden="true" /></span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <header className="panel__head">
          <h2 className="panel__title">How a review moves through ThreatForge</h2>
          <p className="panel__hint">The workspace keeps raw reports, mapped data, and decisions connected.</p>
        </header>
        <div className="panel__body">
          <ol className="review-steps">
            {STEPS.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
