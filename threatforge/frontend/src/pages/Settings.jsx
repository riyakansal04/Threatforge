import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  FolderKanban,
  Moon,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sun,
} from 'lucide-react';

const THEME_KEY = 'threatforge:theme';

const THEME_OPTIONS = [
  {
    id: 'dark',
    label: 'Dark console',
    description: 'High-contrast review mode for long security sessions.',
    icon: Moon,
  },
  {
    id: 'light',
    label: 'Light console',
    description: 'Cleaner daytime view for reports and stakeholder review.',
    icon: Sun,
  },
];

const WORKSPACE_ITEMS = [
  {
    icon: RefreshCw,
    title: 'Refresh behavior',
    text: 'Fetches the latest mapped output without clearing saved report history.',
  },
  {
    icon: FolderKanban,
    title: 'Codebase memory',
    text: 'Saved project contexts keep uploads, stages, and findings separated.',
  },
  {
    icon: Database,
    title: 'Evidence retention',
    text: 'Source references, uploaded files, and generated mappings stay available for review.',
  },
];

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

export default function Settings() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="settings-page stack">
      <div className="page-head">
        <div className="eyebrow">Workspace</div>
        <h1>Settings</h1>
        <p>Control local presentation preferences while keeping uploaded evidence and analysis data unchanged.</p>
      </div>

      <section className="settings-console" aria-label="Workspace settings">
        <article className="settings-console__main">
          <header className="settings-section-head">
            <span className="feature__icon"><Palette size={18} aria-hidden="true" /></span>
            <div>
              <h2>Appearance</h2>
              <p>Choose the review surface that fits your environment.</p>
            </div>
          </header>

          <div className="theme-options" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map(({ id, label, description, icon: Icon }) => (
              <button
                type="button"
                key={id}
                role="radio"
                aria-checked={theme === id}
                className={`theme-option${theme === id ? ' is-on' : ''}`}
                onClick={() => setTheme(id)}
              >
                <span className="theme-option__icon"><Icon size={18} aria-hidden="true" /></span>
                <span className="theme-option__copy">
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                {theme === id && <CheckCircle2 className="theme-option__check" size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </article>

        <aside className="settings-console__side" aria-label="Settings status">
          <div className="settings-status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <div>
              <strong>Saved locally</strong>
              <span>Theme preference stays in this browser.</span>
            </div>
          </div>
          <div className="settings-status">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Analysis protected</strong>
              <span>Changing settings does not modify uploaded reports.</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="settings-grid">
        {WORKSPACE_ITEMS.map(({ icon: Icon, title, text }) => (
          <article className="setting-card" key={title}>
            <div className="setting-card__head">
              <span className="feature__icon"><Icon size={18} aria-hidden="true" /></span>
              <h2>{title}</h2>
            </div>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
