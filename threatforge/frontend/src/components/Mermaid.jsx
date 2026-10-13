import { useEffect, useRef, useState } from 'react';
import { Download, Maximize2, Minus, Moon, Move, Plus, Sun } from 'lucide-react';
import { Panel } from './Blocks.jsx';

let counter = 0;

export function Mermaid({ source }) {
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');
  const [theme, setTheme] = useState('light');
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'base' : 'default',
          securityLevel: 'strict',
          fontFamily: 'IBM Plex Sans',
          themeCSS: theme === 'dark'
            ? `
              .node rect, .node polygon, .node circle, .node ellipse, .node path,
              .node .basic, .node .label-container, .node .outer, .node .inner {
                fill: #10283b !important;
                stroke: #37e4b2 !important;
              }
              .nodeLabel, .label, .label text, text, foreignObject, foreignObject div, foreignObject span {
                color: #f8fbff !important;
                fill: #f8fbff !important;
              }
              .edgePath path, path.flowchart-link, .flowchart-link {
                stroke: #67d8ff !important;
              }
              marker path, marker polygon {
                fill: #67d8ff !important;
                stroke: #67d8ff !important;
              }
              .edgeLabel, .edgeLabel rect, .labelBkg {
                color: #eef6ff !important;
                fill: #07111f !important;
                background: #07111f !important;
              }
            `
            : `
              .node rect, .node polygon, .node circle, .node ellipse, .node path,
              .node .basic, .node .label-container, .node .outer, .node .inner {
                fill: #ffffff !important;
                stroke: #2563eb !important;
              }
              .nodeLabel, .label, .label text, text, foreignObject, foreignObject div, foreignObject span {
                color: #0f172a !important;
                fill: #0f172a !important;
              }
              .edgePath path, path.flowchart-link, .flowchart-link {
                stroke: #2563eb !important;
              }
              marker path, marker polygon {
                fill: #2563eb !important;
                stroke: #2563eb !important;
              }
            `,
          themeVariables: theme === 'dark' ? {
            background: '#07111f',
            mainBkg: '#0e2638',
            primaryColor: '#12344a',
            primaryTextColor: '#eef6ff',
            primaryBorderColor: '#37e4b2',
            secondaryColor: '#16223f',
            tertiaryColor: '#07111f',
            lineColor: '#67d8ff',
            textColor: '#eef6ff',
            nodeTextColor: '#eef6ff',
            clusterBkg: '#0a182b',
            clusterBorder: '#2dd4bf',
            noteBkgColor: '#16223f',
            noteTextColor: '#eef6ff',
            edgeLabelBackground: '#07111f',
          } : {},
        });
        counter += 1;
        const { svg: out } = await mermaid.render(`mmd-${counter}`, source);
        if (!dead) { setSvg(out); setErr(''); }
      } catch (e) {
        if (!dead) setErr(String(e.message || e));
      }
    })();
    return () => { dead = true; };
  }, [source, theme]);

  const zoom = (delta) => {
    setView((v) => ({ ...v, scale: Math.min(2.8, Math.max(0.45, Number((v.scale + delta).toFixed(2)))) }));
  };

  const reset = () => setView({ scale: 1, x: 0, y: 0 });

  const download = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'threatforge-diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPointerDown = (e) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: view.x, oy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setView((v) => ({ ...v, x: drag.current.ox + dx, y: drag.current.oy + dy }));
  };

  const onPointerUp = () => { drag.current = null; };

  if (err) {
    return (
      <div>
        <p className="muted">This diagram could not be rendered ({err.split('\n')[0]}). Showing its source.</p>
        <pre className="pre">{source}</pre>
      </div>
    );
  }
  return (
    <div className="diagram-viewer">
      <div className="diagram-toolbar" aria-label="Diagram controls">
        <button type="button" className="icon-btn" onClick={() => zoom(0.12)} title="Zoom in"><Plus size={15} /></button>
        <button type="button" className="icon-btn" onClick={() => zoom(-0.12)} title="Zoom out"><Minus size={15} /></button>
        <button type="button" className="icon-btn" onClick={reset} title="Fit diagram"><Maximize2 size={15} /></button>
        <button type="button" className="icon-btn" onClick={download} title="Download SVG"><Download size={15} /></button>
        <button type="button" className="icon-btn diagram-mode-btn" onClick={() => setTheme((mode) => (mode === 'dark' ? 'light' : 'dark'))} title={`Switch diagram to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <span><Move size={14} aria-hidden="true" /> Drag to pan</span>
      </div>
      <div
        className={`mermaid-box diagram-canvas diagram-canvas--${theme}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {svg ? (
          <div
            className="diagram-canvas__inner"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : <p className="muted">Rendering diagram...</p>}
      </div>
    </div>
  );
}

export function Diagrams({ items }) {
  const list = items || [];
  if (!list.length) return <p className="muted">No Mermaid diagram was found in the uploaded files.</p>;
  return (
    <div className="stack-sm">
      {list.map((d) => (
        <div key={d.diagram_id} className="field">
          <h3 className="field__label">{d.title} <span className="muted">from {d.origin}</span></h3>
          <Mermaid source={d.source} />
          <details>
            <summary className="muted" style={{ cursor: 'pointer' }}>Show Mermaid source</summary>
            <pre className="pre">{d.source}</pre>
          </details>
        </div>
      ))}
    </div>
  );
}

export { Panel };
