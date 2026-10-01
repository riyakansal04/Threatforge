import { useEffect, useRef, useState } from 'react';
import { Download, Maximize2, Minus, Move, Plus } from 'lucide-react';
import { Panel } from './Blocks.jsx';

let counter = 0;

export function Mermaid({ source }) {
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', fontFamily: 'IBM Plex Sans' });
        counter += 1;
        const { svg: out } = await mermaid.render(`mmd-${counter}`, source);
        if (!dead) { setSvg(out); setErr(''); }
      } catch (e) {
        if (!dead) setErr(String(e.message || e));
      }
    })();
    return () => { dead = true; };
  }, [source]);

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
        <span><Move size={14} aria-hidden="true" /> Drag to pan</span>
      </div>
      <div
        className="mermaid-box diagram-canvas"
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
