import { NavLink } from 'react-router-dom';
import { Archive, FolderClock, House, Info, PanelLeftClose, Settings, ShieldCheck, Upload } from 'lucide-react';
import { HISTORY_PAGES } from '../config/nav.js';

const linkClass = ({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link');

export default function Sidebar({ open, collapsed, onToggleSidebar }) {
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <ShieldCheck size={18} />
        </span>
        <span>
          <span className="brand__name">ThreatForge</span>
          <span className="brand__sub">Security Assurance Platform </span>
        </span>
        <button
          type="button"
          className="icon-btn sidebar-hide-btn"
          onClick={onToggleSidebar}
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <PanelLeftClose size={16} />
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
