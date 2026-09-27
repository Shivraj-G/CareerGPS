import { Outlet } from 'react-router-dom';
import { BrandMark } from '../components/common/BrandMark';

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand-link" href="/" aria-label="CareerGPS home">
          <BrandMark className="brand-logo" />
        </a>
        <span className="phase-badge">Frontend foundation</span>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
