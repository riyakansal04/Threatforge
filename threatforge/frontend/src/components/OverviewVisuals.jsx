function normalizeItems(items = []) {
  return items
    .map(([label, value, tone], index) => ({
      label,
      value: Number(value) || 0,
      tone: tone || `tone-${(index % 5) + 1}`,
    }))
    .filter((item) => item.value > 0);
}

export function OverviewDashboard({ children }) {
  return <div className="overview-viz-dashboard">{children}</div>;
}

export function SignalOrbit({ title, items }) {
  const rows = normalizeItems(items).slice(0, 5);
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  return (
    <article className="overview-viz overview-viz--neon-cloud">
      <header><h3>{title}</h3><span>{total} signals</span></header>
      <div className="neon-cloud" style={{ '--count': rows.length || 1 }}>
        <div className="neon-cloud__halo" />
        <div className="neon-cloud__core">
          <strong>{total}</strong>
          <span>{title}</span>
        </div>
        {rows.map((item, index) => (
          <div
            className={`neon-cloud__bubble ${item.tone}`}
            style={{
              '--i': index,
              '--size': `${Math.min(104, Math.max(62, 54 + item.value * 2.2))}px`,
              '--delay': `${index * -0.7}s`,
            }}
            key={item.label}
          >
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function SignalRadar({ title, items }) {
  const rows = normalizeItems(items).slice(0, 6);
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  return (
    <article className="overview-viz overview-viz--aurora">
      <header><h3>{title}</h3><span>{total} mapped</span></header>
      <div className="aurora-ribbons">
        <div className="aurora-ribbons__glow" />
        {rows.map((item, index) => (
          <div
            className={`aurora-ribbon ${item.tone}`}
            style={{
              '--offset': `${index * 18}px`,
              '--width': `${Math.min(96, Math.max(32, item.value * 4))}%`,
              '--delay': `${index * -0.5}s`,
            }}
            key={item.label}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function SignalFlow({ title, items }) {
  const rows = normalizeItems(items);
  return (
    <article className="overview-viz overview-viz--pulse-flow">
      <header><h3>{title}</h3><span>{rows.reduce((sum, item) => sum + item.value, 0)} mapped</span></header>
      <div className="pulse-flow">
        {rows.map((item, index) => (
          <div className={`pulse-flow__step ${item.tone}`} key={item.label}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.value}</strong>
            <em>{item.label}</em>
          </div>
        ))}
      </div>
    </article>
  );
}

export function SignalBubbles({ title, items }) {
  const rows = normalizeItems(items).slice(0, 5);
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  return (
    <article className="overview-viz overview-viz--bubble-field">
      <header><h3>{title}</h3><span>{total} mapped</span></header>
      <div className="floating-bubble-field">
        <div className="floating-bubble-field__glow" />
        {rows.map((item, index) => (
          <div
            className={`floating-metric-bubble ${item.tone}`}
            style={{
              '--i': index,
              '--size': `${Math.min(132, Math.max(88, 76 + Math.sqrt(item.value) * 10))}px`,
              '--delay': `${index * -0.85}s`,
            }}
            key={item.label}
          >
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function SignalShowcase({ title, items, maxItems = 8 }) {
  const allRows = normalizeItems(items).sort((a, b) => b.value - a.value);
  const rows = allRows.slice(0, maxItems);
  const extraRows = allRows.slice(maxItems);
  const total = allRows.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(...rows.map((item) => item.value), 1);
  const sortedRows = rows;

  return (
    <article className="signal-analytics">
      <header>
        <h3>{title}</h3>
        <span>{total} mapped</span>
      </header>
      <div className="signal-analytics__grid">
        <div className="signal-analytics__total">
          <strong>{total}</strong>
          <span>Total mapped signals</span>
        </div>
        <div className="signal-analytics__histogram" aria-label={`${title} histogram`}>
          {sortedRows.map((item) => (
            <div className={`signal-analytics__bar ${item.tone}`} key={item.label}>
              <span>{item.label}</span>
              <div>
                <i style={{ '--height': `${Math.max((item.value / max) * 100, 10)}%` }} />
              </div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="signal-analytics__insight">
          <span>Highest concentration</span>
          <strong>{sortedRows[0]?.label || 'No signals'}</strong>
          <em>{sortedRows[0]?.value || 0} signals</em>
        </div>
        {!!extraRows.length && (
          <div className="signal-analytics__extras" aria-label="Additional mapped signals">
            {extraRows.map((item) => (
              <span className={`signal-analytics__extra ${item.tone}`} key={item.label}>
                <b>{item.value}</b>
                <em>{item.label}</em>
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
