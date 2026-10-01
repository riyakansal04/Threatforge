import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'threatforge:theme';

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
    <div className="stack">
      <div className="page-head">
        <div className="eyebrow">Workspace</div>
        <h1>Settings</h1>
        <p>Adjust dashboard presentation without changing stored analysis data.</p>
      </div>

      <section className="panel">
        <header className="panel__head">
          <h2 className="panel__title">Appearance</h2>
          <p className="panel__hint">Choose the visual mode that is easier to review in your environment.</p>
        </header>
        <div className="panel__body">
          <div className="setting-row">
            <div>
              <h3>Theme</h3>
              <p className="muted">This preference is saved in this browser.</p>
            </div>
            <div className="segmented" role="group" aria-label="Theme">
              <button type="button" className={theme === 'dark' ? 'is-on' : ''} onClick={() => setTheme('dark')}>
                <Moon size={15} aria-hidden="true" />
                Dark
              </button>
              <button type="button" className={theme === 'light' ? 'is-on' : ''} onClick={() => setTheme('light')}>
                <Sun size={15} aria-hidden="true" />
                Light
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-grid">
        <article className="setting-card">
          <h2>Dashboard behavior</h2>
          <p>Refresh fetches latest data only. Fresh starts a new upload context without deleting history.</p>
        </article>
        <article className="setting-card">
          <h2>Project memory</h2>
          <p>Use Codebases to switch between saved project contexts and keep reports separated.</p>
        </article>
        <article className="setting-card">
          <h2>Evidence model</h2>
          <p>Mapped information keeps source references and uploaded files available for review.</p>
        </article>
      </section>
    </div>
  );
}
