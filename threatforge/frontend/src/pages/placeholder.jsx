import { Link } from 'react-router-dom';

export default function Placeholder({ title, description, eyebrow, note }) {
  return (
    <div className="stack">
      <div className="page-head">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <section className="panel">
        <div className="panel__body empty">
          <p>{note || 'Nothing to show here.'}</p>
          <Link to="/upload" className="btn">
            Go to upload
          </Link>
        </div>
      </section>
    </div>
  );
}