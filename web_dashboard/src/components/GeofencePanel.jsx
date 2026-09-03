/*
 * GeofencePanel.jsx – Geofence Configuration & Status Panel
 * ══════════════════════════════════════════════════════════
 * Allows setting a safe zone center + radius,
 * displays live distance from center and alert status.
 */

import { useState } from 'react';

export default function GeofencePanel({ geofence, geofenceStatus, onUpdateGeofence, latitude, longitude }) {
  const [editing, setEditing] = useState(false);
  const [tempRadius, setTempRadius] = useState(geofence.radius);

  const handleToggle = () => {
    onUpdateGeofence({ enabled: !geofence.enabled });
  };

  const handleSetCurrentAsCenter = () => {
    if (latitude && longitude) {
      onUpdateGeofence({
        center: { lat: latitude, lng: longitude },
      });
    }
  };

  const handleRadiusSave = () => {
    onUpdateGeofence({ radius: Number(tempRadius) || 200 });
    setEditing(false);
  };

  const isOutside = geofence.enabled && !geofenceStatus.inside;

  return (
    <div className={`geofence-panel glass-card ${isOutside ? 'geofence-panel--alert' : ''}`} id="geofence-panel">
      {/* Header */}
      <div className="card-header">
        <div className="card-header__label">
          <span className="card-header__icon" style={{ background: 'rgba(168, 85, 247, 0.12)' }}>🛡️</span>
          Geofence Safe Zone
        </div>
        <button
          type="button"
          className={`geofence-toggle ${geofence.enabled ? 'geofence-toggle--on' : ''}`}
          onClick={handleToggle}
        >
          <span className="geofence-toggle__knob" />
        </button>
      </div>

      {geofence.enabled ? (
        <>
          {/* Status */}
          <div className="geofence-status">
            <div className={`geofence-status__indicator ${isOutside ? 'geofence-status__indicator--outside' : 'geofence-status__indicator--inside'}`}>
              <span className="geofence-status__icon">{isOutside ? '⚠️' : '✅'}</span>
              <div>
                <div className="geofence-status__label">
                  {isOutside ? 'OUTSIDE SAFE ZONE' : 'Inside Safe Zone'}
                </div>
                <div className="geofence-status__dist">
                  {geofenceStatus.distance}m from center
                  {isOutside && ` (${geofenceStatus.distance - geofence.radius}m beyond boundary)`}
                </div>
              </div>
            </div>
          </div>

          {/* Config */}
          <div className="geofence-config">
            <div className="geofence-config__row">
              <span className="geofence-config__label">Center</span>
              <span className="geofence-config__value">
                {geofence.center.lat.toFixed(5)}, {geofence.center.lng.toFixed(5)}
              </span>
              <button
                type="button"
                className="sim-btn"
                onClick={handleSetCurrentAsCenter}
                style={{ fontSize: '0.65rem', padding: '2px 8px' }}
              >
                📍 Set Current
              </button>
            </div>
            <div className="geofence-config__row">
              <span className="geofence-config__label">Radius</span>
              {editing ? (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={tempRadius}
                    onChange={(e) => setTempRadius(e.target.value)}
                    className="geofence-input"
                    min={10}
                    max={10000}
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>m</span>
                  <button type="button" className="sim-btn sim-btn--safe" onClick={handleRadiusSave} style={{ fontSize: '0.6rem', padding: '2px 8px' }}>
                    ✓
                  </button>
                </div>
              ) : (
                <span className="geofence-config__value" onClick={() => { setEditing(true); setTempRadius(geofence.radius); }} style={{ cursor: 'pointer' }}>
                  {geofence.radius}m <span style={{ fontSize: '0.55rem', opacity: 0.5 }}>(click to edit)</span>
                </span>
              )}
            </div>
          </div>

          {/* Visual radius bar */}
          <div className="geofence-bar">
            <div
              className={`geofence-bar__fill ${isOutside ? 'geofence-bar__fill--outside' : 'geofence-bar__fill--inside'}`}
              style={{ width: `${Math.min(100, (geofenceStatus.distance / (geofence.radius * 1.5)) * 100)}%` }}
            />
            <div className="geofence-bar__boundary" style={{ left: `${(1 / 1.5) * 100}%` }} />
          </div>
          <div className="geofence-bar-labels">
            <span>0m</span>
            <span style={{ color: 'var(--warning)' }}>{geofence.radius}m limit</span>
            <span>{Math.round(geofence.radius * 1.5)}m</span>
          </div>
        </>
      ) : (
        <div className="geofence-disabled">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Enable to set a safe boundary zone. You'll be alerted when the worker leaves the defined area.
          </span>
        </div>
      )}
    </div>
  );
}
