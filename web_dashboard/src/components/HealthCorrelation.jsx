/*
 * HealthCorrelation.jsx – Heart Rate vs Activity Chart
 * ══════════════════════════════════════════════════════
 * SVG-based sparkline chart showing heart rate over time,
 * color-coded by activity type (Walking / Driving / Stationary).
 * Shows how heart rate correlates with the user's physical activity.
 */

import { useMemo } from 'react';

const ACTIVITY_COLORS = {
  walking:    '#4ade80',
  driving:    '#38bdf8',
  stationary: '#64748b',
};

export default function HealthCorrelation({ healthData }) {
  const chartWidth = 600;
  const chartHeight = 120;
  const paddingX = 35;
  const paddingY = 16;
  const innerW = chartWidth - paddingX * 2;
  const innerH = chartHeight - paddingY * 2;

  const { path, dots, hrRange, activityBands, avgByActivity } = useMemo(() => {
    if (!healthData || healthData.length < 2) {
      return { path: '', dots: [], hrRange: { min: 60, max: 100 }, activityBands: [], avgByActivity: {} };
    }

    const hrs = healthData.map(d => d.heart_rate).filter(h => h > 0);
    const minHR = Math.min(...hrs, 50) - 5;
    const maxHR = Math.max(...hrs, 100) + 5;

    const timeMin = healthData[0].timestamp;
    const timeMax = healthData[healthData.length - 1].timestamp;
    const timeSpan = timeMax - timeMin || 1;

    // Build SVG path
    const points = healthData.map((d, i) => {
      const x = paddingX + (d.timestamp - timeMin) / timeSpan * innerW;
      const y = paddingY + innerH - ((d.heart_rate - minHR) / (maxHR - minHR)) * innerH;
      return { x, y, ...d };
    });

    let pathStr = '';
    points.forEach((p, i) => {
      pathStr += i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
    });

    // Activity background bands
    const bands = [];
    let bandStart = points[0];
    let bandActivity = healthData[0].activity;
    for (let i = 1; i < points.length; i++) {
      if (healthData[i].activity !== bandActivity || i === points.length - 1) {
        bands.push({
          x: bandStart.x,
          width: points[i].x - bandStart.x,
          activity: bandActivity,
        });
        bandStart = points[i];
        bandActivity = healthData[i].activity;
      }
    }

    // Compute average HR per activity
    const sums = {};
    const counts = {};
    healthData.forEach(d => {
      if (d.heart_rate > 0) {
        sums[d.activity] = (sums[d.activity] || 0) + d.heart_rate;
        counts[d.activity] = (counts[d.activity] || 0) + 1;
      }
    });
    const avgs = {};
    Object.keys(sums).forEach(a => {
      avgs[a] = Math.round(sums[a] / counts[a]);
    });

    // Show last few dots for detail
    const dotPoints = points.slice(-6);

    return {
      path: pathStr,
      dots: dotPoints,
      hrRange: { min: minHR, max: maxHR },
      activityBands: bands,
      avgByActivity: avgs,
    };
  }, [healthData]);

  const hasData = healthData && healthData.length >= 2;

  return (
    <div className="health-correlation glass-card" id="health-correlation">
      {/* Header */}
      <div className="card-header">
        <div className="card-header__label">
          <span className="card-header__icon card-header__icon--hr">💓</span>
          Health × Activity Correlation
        </div>
      </div>

      {/* Chart */}
      <div className="hc-chart-container">
        {hasData ? (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="hc-chart-svg" preserveAspectRatio="none">
            {/* Activity background bands */}
            {activityBands.map((band, i) => (
              <rect
                key={i}
                x={band.x}
                y={paddingY}
                width={Math.max(2, band.width)}
                height={innerH}
                fill={ACTIVITY_COLORS[band.activity] || '#475569'}
                opacity={0.08}
                rx={2}
              />
            ))}

            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
              const y = paddingY + innerH * (1 - frac);
              const hrVal = Math.round(hrRange.min + (hrRange.max - hrRange.min) * frac);
              return (
                <g key={i}>
                  <line
                    x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y}
                    stroke="rgba(255,255,255,0.05)" strokeWidth={1}
                  />
                  <text x={paddingX - 4} y={y + 3} fontSize="8" fill="rgba(255,255,255,0.3)" textAnchor="end" fontFamily="monospace">
                    {hrVal}
                  </text>
                </g>
              );
            })}

            {/* HR line with gradient stroke */}
            <defs>
              <linearGradient id="hrLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f85149" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f85149" />
              </linearGradient>
            </defs>
            <path
              d={path}
              fill="none"
              stroke="url(#hrLineGrad)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dot highlights */}
            {dots.map((d, i) => (
              <circle
                key={i}
                cx={d.x} cy={d.y} r={2.5}
                fill={ACTIVITY_COLORS[d.activity] || '#f85149'}
                stroke="#fff" strokeWidth={0.5}
                opacity={0.8 + (i / dots.length) * 0.2}
              />
            ))}
          </svg>
        ) : (
          <div className="hc-chart-empty">
            <span style={{ fontSize: '1.2rem', opacity: 0.3 }}>💓📈</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Collecting data...</span>
          </div>
        )}
      </div>

      {/* Average HR per Activity */}
      <div className="hc-avg-row">
        {Object.entries(ACTIVITY_COLORS).map(([activity, color]) => (
          <div key={activity} className="hc-avg-item">
            <div className="hc-avg-dot" style={{ background: color }} />
            <span className="hc-avg-label">{activity}</span>
            <span className="hc-avg-value" style={{ color: color }}>
              {avgByActivity[activity] ? `${avgByActivity[activity]} BPM` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
