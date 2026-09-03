/*
 * ActivityTimeline.jsx – Visual Activity Timeline
 * ══════════════════════════════════════════════════
 * Horizontal bar chart showing Walking / Driving / Stationary
 * segments throughout the session, with live segment tracking.
 */

import { useMemo } from 'react';

const ACTIVITY_COLORS = {
  walking:    { bg: '#4ade80', label: '🚶 Walking' },
  driving:    { bg: '#38bdf8', label: '🚙 Driving' },
  stationary: { bg: '#64748b', label: '⏸️ Still' },
};

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function ActivityTimeline({ timeline, currentActivity, summary }) {
  // Build visual segments from timeline
  const segments = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    const totalDuration = timeline.reduce((s, seg) => s + seg.duration_s, 0);
    if (totalDuration === 0) return [];
    return timeline.map(seg => ({
      ...seg,
      widthPercent: Math.max(1, (seg.duration_s / totalDuration) * 100),
    }));
  }, [timeline]);

  const totalSeconds = (summary?.walking || 0) + (summary?.driving || 0) + (summary?.stationary || 0);

  return (
    <div className="activity-timeline glass-card" id="activity-timeline">
      {/* Header */}
      <div className="card-header">
        <div className="card-header__label">
          <span className="card-header__icon" style={{ background: 'rgba(74, 222, 128, 0.12)' }}>📊</span>
          Activity Timeline
        </div>
        <span className="card-header__badge card-header__badge--safe" style={{
          background: ACTIVITY_COLORS[currentActivity]?.bg + '22',
          color: ACTIVITY_COLORS[currentActivity]?.bg,
          border: `1px solid ${ACTIVITY_COLORS[currentActivity]?.bg}44`,
        }}>
          {ACTIVITY_COLORS[currentActivity]?.label || 'Unknown'}
        </span>
      </div>

      {/* Timeline Bar */}
      <div className="timeline-bar">
        {segments.length > 0 ? (
          segments.map((seg, i) => (
            <div
              key={i}
              className="timeline-segment"
              style={{
                width: `${seg.widthPercent}%`,
                background: ACTIVITY_COLORS[seg.activity]?.bg || '#475569',
              }}
              title={`${ACTIVITY_COLORS[seg.activity]?.label}: ${formatDuration(seg.duration_s)}`}
            />
          ))
        ) : (
          <div className="timeline-segment" style={{ width: '100%', background: ACTIVITY_COLORS[currentActivity]?.bg || '#475569' }} />
        )}
        {/* Live pulsing current segment */}
        <div
          className="timeline-segment timeline-segment--live"
          style={{ background: ACTIVITY_COLORS[currentActivity]?.bg || '#475569' }}
        />
      </div>

      {/* Summary Stats */}
      <div className="timeline-summary">
        {Object.entries(ACTIVITY_COLORS).map(([key, { bg, label }]) => {
          const secs = summary?.[key] || 0;
          const pct = totalSeconds > 0 ? Math.round((secs / totalSeconds) * 100) : 0;
          return (
            <div key={key} className="timeline-stat">
              <div className="timeline-stat__dot" style={{ background: bg }} />
              <span className="timeline-stat__label">{label}</span>
              <span className="timeline-stat__value">{formatDuration(secs)}</span>
              <span className="timeline-stat__pct" style={{ color: bg }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
