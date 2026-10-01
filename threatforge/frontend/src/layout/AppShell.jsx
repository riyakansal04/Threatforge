import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

const COLLAPSE_KEY = 'threatforge.sidebar_collapsed';

export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const mainRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setNavOpen(false);
    mainRef.current?.scrollTo({ top: 0, left: 0 });
    window.scrollTo(0, 0);
  }, [pathname]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar open={navOpen} collapsed={collapsed} onToggleSidebar={toggleSidebar} />
      {navOpen && <div className="backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <div className="main" ref={mainRef}>
        <Topbar onMenu={() => setNavOpen(true)} onToggleSidebar={toggleSidebar} sidebarCollapsed={collapsed} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
