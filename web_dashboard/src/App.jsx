/*
 * App.jsx – SafeGuard Dashboard Entry Point
 * ═══════════════════════════════════════════
 * Root component with top navigation bar, multi-mode hardware support,
 * and adaptive mobile/laptop dashboard.
 */

import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import './App.css';

function formatClock() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDate() {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function App() {
  const [clock, setClock] = useState(formatClock());
  const [date, setDate] = useState(formatDate());
  const [dataMode, setDataMode] = useState(() => {
    return localStorage.getItem('safeguard_data_mode') || 'hardware';
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setClock(formatClock());
      setDate(formatDate());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleModeChange = (newMode) => {
    setDataMode(newMode);
    localStorage.setItem('safeguard_data_mode', newMode);
  };

  const getModeBadge = () => {
    if (dataMode === 'serial') return { label: 'USB SERIAL', color: '#38bdf8' };
    if (dataMode === 'hardware') return { label: 'WI-FI STREAM', color: '#4ade80' };
    return { label: 'SIMULATION', color: '#fbbf24' };
  };

  const badge = getModeBadge();

  return (
    <div className="app">
      {/* ── Top Navigation Bar ──────────────── */}
      <header className="topbar" id="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo">SG</div>
          <div>
            <div className="topbar__title">SafeGuard Pro</div>
            <div className="topbar__subtitle">
              Live IoT Worker Safety & GPS Command Center
            </div>
          </div>
        </div>

        <div className="topbar__status">
          <div className="topbar__clock">
            <span>{date}</span>
            <span style={{ margin: '0 10px', opacity: 0.15 }}>│</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{clock}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="topbar__connection">
              <span
                className="topbar__connection-dot"
                style={{ background: badge.color, boxShadow: `0 0 10px ${badge.color}` }}
              ></span>
              <span style={{ color: badge.color, fontWeight: 700, fontSize: '0.72rem' }}>
                {badge.label}
              </span>
            </div>

            <div className="topbar__quick-modes">
              <button
                type="button"
                onClick={() => handleModeChange('hardware')}
                className={`topbar-mode-btn ${dataMode === 'hardware' ? 'topbar-mode-btn--active' : ''}`}
                title="Wi-Fi Wireless Streaming"
              >
                📡 Wi-Fi
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('serial')}
                className={`topbar-mode-btn ${dataMode === 'serial' ? 'topbar-mode-btn--active' : ''}`}
                title="Direct USB Serial Monitor"
              >
                🔌 USB Cable
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('simulation')}
                className={`topbar-mode-btn ${dataMode === 'simulation' ? 'topbar-mode-btn--active' : ''}`}
                title="Test Simulation"
              >
                🧪 Sim
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Dashboard ───────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Dashboard dataMode={dataMode} onModeChange={handleModeChange} />
      </main>
    </div>
  );
}
