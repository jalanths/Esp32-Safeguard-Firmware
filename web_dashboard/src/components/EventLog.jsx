/*
 * EventLog.jsx – Real-Time Event Log Panel
 * ═══════════════════════════════════════════
 * Scrollable list of system events and emergency alerts
 * with color-coded severity strips, prominent labels,
 * and relative timestamps.
 */

import { useState, useEffect } from 'react';

// ── Relative time formatter ────────────────────────────────────

function timeAgo(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 5)   return 'just now';
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

// ── Severity config ────────────────────────────────────────────

const SEVERITY_CONFIG = {
  danger: {
    icon: '🚨',
    iconClass: 'event-log__icon--danger',
    label: 'Critical',
    labelClass: 'event-log__severity-label--danger',
  },
  warning: {
    icon: '⚠️',
    iconClass: 'event-log__icon--warning',
    label: 'Warning',
    labelClass: 'event-log__severity-label--warning',
  },
  safe: {
    icon: '✅',
    iconClass: 'event-log__icon--safe',
    label: 'Resolved',
    labelClass: 'event-log__severity-label--safe',
  },
  info: {
    icon: 'ℹ️',
    iconClass: 'event-log__icon--info',
    label: 'Info',
    labelClass: 'event-log__severity-label--info',
  },
};

// ── Component ──────────────────────────────────────────────────

export default function EventLog({ events = [] }) {
  const [, setTick] = useState(0);

  // Re-render every 10s to update relative timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="event-log glass-card" id="event-log-panel">
      <div className="event-log__header">
        <div className="event-log__title">
          <span>📋</span> Event Log
        </div>
        {events.length > 0 && (
          <span className="event-log__count">{events.length}</span>
        )}
      </div>

      <div className="event-log__body">
        {events.length === 0 ? (
          <div className="event-log__empty">
            <span className="event-log__empty-icon">📭</span>
            <span>No events recorded yet</span>
            <span className="event-log__empty-text">
              Trigger a simulation event or connect hardware to see logs
            </span>
          </div>
        ) : (
          events.map((event) => {
            const config = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.info;
            return (
              <div
                className={`event-log__item event-log__item--${event.severity || 'info'}`}
                key={event.id}
              >
                <div className={`event-log__icon ${config.iconClass}`}>
                  {config.icon}
                </div>
                <div className="event-log__details">
                  <div className={`event-log__severity-label ${config.labelClass}`}>
                    {config.label}
                  </div>
                  <div
                    className="event-log__event-type"
                    style={{
                      color: event.severity === 'danger'
                        ? 'var(--danger)'
                        : event.severity === 'safe'
                        ? 'var(--safe)'
                        : event.severity === 'warning'
                        ? 'var(--warning)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {event.type.replace(/_/g, ' ')}
                  </div>
                  <div className="event-log__event-message">
                    {event.message}
                  </div>
                </div>
                <div className="event-log__time">
                  {timeAgo(event.timestamp)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
