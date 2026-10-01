import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, PanelLeftOpen, Plus, RefreshCw, Upload } from 'lucide-react';
import { api, currentCodebaseId, setCurrentCodebaseId } from '../api/client.js';
import { FINDING_PAGES, HISTORY_PAGES, POSTSCAN_PAGES, PRESCAN_PAGES, SCANNING_PAGES, TRACEABILITY_PAGES } from '../config/nav.js';

export default function Topbar({ onMenu, onToggleSidebar, sidebarCollapsed }) {
  const { pathname } = useLocation();
  const [codebases, setCodebases] = useState([]);
  const [selected, setSelected] = useState(currentCodebaseId());
  const pre = PRESCAN_PAGES.find((p) => p.path === pathname);
  const scan = SCANNING_PAGES.find((p) => p.path === pathname);
  const finding = FINDING_PAGES.find((p) => p.path === pathname);
  const postScan = POSTSCAN_PAGES.find((p) => p.path === pathname);
  const history = HISTORY_PAGES.find((p) => p.path === pathname);
  const traceability = TRACEABILITY_PAGES.find((p) => p.path === pathname);

  const loadCodebases = useCallback(() => {
    api.codebases().then((res) => setCodebases(res.codebases || [])).catch(() => setCodebases([]));
  }, []);

  useEffect(() => {
    loadCodebases();
  }, [loadCodebases]);

  const refreshCurrent = () => {
    loadCodebases();
    setSelected(currentCodebaseId());
    window.dispatchEvent(new Event('threatforge:refresh'));
  };

  const changeCodebase = (id) => {
    setSelected(id);
    setCurrentCodebaseId(id);
    window.location.reload();
  };

  const freshCodebase = () => {
    setSelected('');
    setCurrentCodebaseId('');
    window.location.href = '/upload';
  };

  let trail = ['Home'];
  if (pathname === '/about') trail = ['About'];
  else if (pathname === '/settings') trail = ['Settings'];
  else if (pathname === '/upload') trail = ['Upload reports'];
  else if (pathname === '/flow') trail = ['ThreatForge workflow'];
  else if (pathname === '/pre-scan/raw-artifacts') trail = ['Artifacts'];
  else if (pathname === '/pre-scan') trail = ['ThreatForge workflow', 'Intelligence'];
  else if (pathname === '/scanning') trail = ['ThreatForge workflow', 'Scanning'];
  else if (pathname === '/findings-cases') trail = ['ThreatForge workflow', 'Triage and prioritization'];
  else if (pathname === '/findings-cases/remediation') trail = ['ThreatForge workflow', 'Remediation'];
  else if (history) trail = ['Codebases', history.label];
  else if (pre) trail = ['Before scanning', pre.label];
  else if (scan) trail = ['Security analysis', scan.label];
  else if (finding) trail = ['Finding review', finding.label];
  else if (postScan) trail = ['Verify fixes', postScan.label];
  else if (traceability) trail = ['Traceability', traceability.label];
  else if (pathname.startsWith('/scanning/scans/')) trail = ['Security analysis', 'Analysis dashboard'];

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Open navigation">
          <Menu size={20} />
        </button>
        {sidebarCollapsed && (
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleSidebar}
            aria-label="Show sidebar"
            title="Show sidebar"
          >
            <PanelLeftOpen size={18} />
            <span>Show sidebar</span>
          </button>
        )}
        <nav aria-label="Breadcrumb">
          <ol className="crumbs">
            {trail.map((item, i) => (
              <li key={item} aria-current={i === trail.length - 1 ? 'page' : undefined}>{item}</li>
            ))}
          </ol>
        </nav>
      </div>
      <div className="topbar__right">
        <label className="topbar-select" title="Switch codebase">
          <span>Current codebase</span>
          <select className="input codebase-select" value={selected} onChange={(e) => changeCodebase(e.target.value)}>
            <option value="">Select codebase</option>
          {codebases.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          </select>
        </label>
        <button type="button" className="btn btn--sm" onClick={refreshCurrent} title="Refresh current data">
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </button>
        <button type="button" className="btn btn--sm" onClick={freshCodebase} title="Start a new codebase upload">
          <Plus size={14} aria-hidden="true" />
          New codebase
        </button>
        <Link to="/upload" className="btn btn--primary">
          <Upload size={16} aria-hidden="true" />
          Upload reports
        </Link>
      </div>
    </header>
  );
}
