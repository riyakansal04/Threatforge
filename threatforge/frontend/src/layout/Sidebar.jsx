import { NavLink, useLocation } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  ChevronsLeft,
  FolderClock,
  House,
  Info,
  ListChecks,
  Radar,
  ScanSearch,
  Settings,
  ShieldCheck,
  TrendingUp,
  Upload,
  Wrench,
} from 'lucide-react';
import { HISTORY_PAGES } from '../config/nav.js';

const linkClass = ({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link');

const STAGE_LINKS = [
  { to: '/pre-scan', label: 'Intelligence', icon: Radar },
  { to: '/threat-modeling', label: 'Threat Modeling', icon: ShieldCheck },
  { to: '/scanning', label: 'Scanning', icon: ScanSearch },
  { to: '/findings-cases', label: 'Triage', icon: ListChecks, exact: true },
  { to: '/findings-cases/priority', label: 'Prioritization', icon: TrendingUp },
  { to: '/findings-cases/remediation', label: 'Remediation', icon: Wrench },
  { to: '/post-scan/verification', label: 'Verification', icon: CheckCircle2 },
];

export default function Sidebar({ open, collapsed, onToggleSidebar }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const activeStageClass = (item) => {
    if (item.tab) {
      return location.pathname === '/findings-cases' && (params.get('tab') || 'triage') === item.tab ? 'nav-link is-active' : 'nav-link';
    }
    if (item.exact) {
      return location.pathname === item.to ? 'nav-link is-active' : 'nav-link';
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`) ? 'nav-link is-active' : 'nav-link';
  };

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <ShieldCheck size={18} />
        </span>
        <span className="brand__copy">
          <span className="brand__name">ThreatForge</span>
          <span className="brand__sub">Security Assurance Platform</span>
        </span>
        <button
          type="button"
          className="icon-btn sidebar-hide-btn"
          onClick={onToggleSidebar}
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <ChevronsLeft size={16} aria-hidden="true" />
        </button>
      </div>

      <nav className="nav" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => `${linkClass({ isActive })} nav-link--top`}>
          <House size={16} aria-hidden="true" />
          Home
        </NavLink>
        <NavLink to="/upload" className={({ isActive }) => `${linkClass({ isActive })} nav-link--top`}>
          <Upload size={16} aria-hidden="true" />
          Upload reports
        </NavLink>
        <NavLink to="/pre-scan/raw-artifacts" className={({ isActive }) => `${linkClass({ isActive })} nav-link--top`}>
          <Archive size={16} aria-hidden="true" />
          Artifacts
        </NavLink>
        <div className="nav-heading">Stages</div>
        <div className="nav-list nav-list--stages">
          {STAGE_LINKS.map(({ to, label, icon: Icon, tab, exact }) => (
            <NavLink key={to} to={to} className={() => activeStageClass({ to, tab, exact })}>
              <Icon size={16} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
        <NavLink to="/history" className={({ isActive }) => `${linkClass({ isActive })} nav-link--top`}>
          <FolderClock size={16} aria-hidden="true" />
          {HISTORY_PAGES[0].label}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `${linkClass({ isActive })} nav-link--top`}>
          <Settings size={16} aria-hidden="true" />
          Settings
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `${linkClass({ isActive })} nav-link--top`}>
          <Info size={16} aria-hidden="true" />
          About
        </NavLink>
      </nav>
    </aside>
  );
}
