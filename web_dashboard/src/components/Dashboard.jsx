/*
 * Dashboard.jsx – Main Command Center Layout (Bento Grid + Responsive Mobile Layout)
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Professional dynamic command center supporting:
 *   1. Direct Wi-Fi ESP32 IP stream
 *   2. USB Serial API connection (reads user's exact Arduino Serial.println format)
 *   3. Interactive simulation test mode
 *   4. Adaptive Mobile Layout & View Switcher
 */

import React, { useState, useEffect } from 'react';
import AlertBanner from './AlertBanner';
import CrashAlert from './CrashAlert';
import MapWidget from './MapWidget';
import EventLog from './EventLog';
import SimControls from './SimControls';
import ActivityTimeline from './ActivityTimeline';
import HealthCorrelation from './HealthCorrelation';
import GeofencePanel from './GeofencePanel';
import { useSimulator } from '../hooks/useSimulator';
import { useFirebase } from '../hooks/useFirebase';
import { useWebSerial } from '../hooks/useWebSerial';
import { useActivityTracker } from '../hooks/useActivityTracker';

// ── Threshold helpers ──────────────────────────────────────────

function getHRClass(hr) {
  if (!hr || hr <= 0) return 'value--neutral';
  if (hr < 40 || hr > 150) return 'value--danger';
  if (hr < 50 || hr > 120) return 'value--warning';
  return 'value--safe';
}
function getHRStatus(hr) {
  if (!hr || hr <= 0) return 'info';
  if (hr < 40 || hr > 150) return 'danger';
  if (hr < 50 || hr > 120) return 'warning';
  return 'safe';
}
function getHRPercent(hr) {
  if (!hr || hr <= 0) return 0;
  return Math.min(100, Math.max(0, ((hr - 30) / 150) * 100));
}
function getSpO2Class(spo2) {
  if (!spo2 || spo2 <= 0) return 'value--neutral';
  if (spo2 < 90) return 'value--danger';
  if (spo2 < 95) return 'value--warning';
  return 'value--safe';
}
function getSpO2Status(spo2) {
  if (!spo2 || spo2 <= 0) return 'info';
  if (spo2 < 90) return 'danger';
  if (spo2 < 95) return 'warning';
  return 'safe';
}
function getSpO2Percent(spo2) {
  if (!spo2 || spo2 <= 0) return 0;
  return Math.min(100, Math.max(0, ((spo2 - 70) / 30) * 100));
}
function getTiltClass(tilt) {
  if (tilt > 60) return 'value--danger';
  if (tilt > 30) return 'value--warning';
  return 'value--safe';
}
function getTiltStatus(tilt) {
  if (tilt > 60) return 'danger';
  if (tilt > 30) return 'warning';
  return 'safe';
}
function getMotionLabel(isMoving, accel, speed = 0) {
  if (accel < 0.4) return 'FREE FALL';
  if (speed > 15) return 'Driving';
  if (isMoving || speed > 1) return 'Walking';
  return 'Stationary';
}

// ── Range Bar ──────────────────────────────────────────────────

function RangeBar({ percent, status }) {
  return (
    <div className="vital-card__range-bar">
      <div
        className={`vital-card__range-fill vital-card__range-fill--${status}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ── Map Error Boundary ─────────────────────────────────────────

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('MapWidget Error Boundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="map-widget glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px', justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: '300px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
          <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '8px' }}>Map Component Error</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '300px', marginBottom: '16px' }}>
            Google Maps API encountered an activation or loading error.
          </p>
          <button type="button" onClick={() => { localStorage.setItem('safeguard_map_provider', 'leaflet'); this.setState({ hasError: false, error: null }); window.location.reload(); }} className="sim-btn sim-btn--safe" style={{ padding: '8px 20px', fontWeight: 600 }}>
            Switch to OpenStreetMap (Free Fallback)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Worker Header ──────────────────────────────────────────────

function WorkerHeader({ data, dataMode, directConnected, serialConnected }) {
  const isEmergency = data.status !== 'SAFE';
  const initials = (data.worker_name || 'W').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  let connectionLabel = 'Simulation';
  let connectionColor = 'var(--warning)';
  if (dataMode === 'serial') {
    connectionLabel = serialConnected ? 'USB Serial Connected ✓' : 'USB Serial Ready';
    connectionColor = serialConnected ? 'var(--safe)' : 'var(--blue)';
  } else if (dataMode === 'hardware') {
    connectionLabel = directConnected ? 'Wi-Fi Direct Connected ✓' : 'Wi-Fi Standby';
    connectionColor = directConnected ? 'var(--safe)' : 'var(--blue)';
  }

  return (
    <div className="worker-header glass-card">
      <div className="worker-header__identity">
        <div className="worker-header__avatar">{initials}</div>
        <div className="worker-header__info">
          <div className="worker-header__name">{data.worker_name || 'ESP32 Worker Node'}</div>
          <div className="worker-header__id">{data.worker_id || 'ID-ESP32'}</div>
        </div>
        <div className={`worker-header__status-badge ${isEmergency ? 'worker-header__status-badge--emergency' : 'worker-header__status-badge--safe'}`}>
          <span style={{ fontSize: '0.55rem' }}>{isEmergency ? '🔴' : '🟢'}</span>
          {data.status.replace(/_/g, ' ')}
        </div>
      </div>
      <div className="worker-header__meta">
        <div className="worker-header__meta-item">
          <span className="worker-header__meta-icon" style={{ background: connectionColor }}></span>
          <span>Stream: <strong style={{ color: connectionColor }}>{connectionLabel}</strong></span>
        </div>
        <div className="worker-header__meta-item">
          <span className="worker-header__meta-icon" style={{ background: 'var(--text-muted)' }}></span>
          <span>Updated: <strong style={{ color: 'var(--text-secondary)' }}>
            {data.timestamp ? new Date(data.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          </strong></span>
        </div>
        <div className="worker-header__meta-item">
          <span className="worker-header__meta-icon" style={{ background: data.gps_valid ? 'var(--safe)' : 'var(--warning)' }}></span>
          <span>GPS Fix: <strong style={{ color: data.gps_valid ? 'var(--safe)' : 'var(--warning)' }}>
            {data.gps_valid ? `${data.satellites || 6} Sats` : 'Searching'}
          </strong></span>
        </div>
      </div>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────

function SectionHeader({ title, rightElement }) {
  return (
    <div className="section-header">
      <div className="section-header__title">
        <span className="section-header__accent"></span>
        {title}
      </div>
      <span className="section-header__line"></span>
      {rightElement}
    </div>
  );
}

// ── System Stats ───────────────────────────────────────────────

function SystemStats({ events, dataMode }) {
  const [uptime, setUptime] = useState('0s');
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed < 60) setUptime(`${elapsed}s`);
      else if (elapsed < 3600) setUptime(`${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
      else setUptime(`${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const dangerCount = events.filter(e => e.severity === 'danger').length;

  return (
    <div className="system-stats glass-card">
      <div className="system-stats__item">
        <span className="system-stats__dot system-stats__dot--active"></span>
        <span>Uptime: <span className="system-stats__value">{uptime}</span></span>
      </div>
      <div className="system-stats__item">
        <span className="system-stats__dot"></span>
        <span>Events: <span className="system-stats__value">{events.length}</span></span>
      </div>
      <div className="system-stats__item">
        <span className="system-stats__dot" style={dangerCount > 0 ? { background: 'var(--danger)', opacity: 1 } : {}}></span>
        <span>Alerts: <span className="system-stats__value" style={dangerCount > 0 ? { color: 'var(--danger)' } : {}}>{dangerCount}</span></span>
      </div>
      <div className="system-stats__item">
        <span className="system-stats__dot"></span>
        <span>Data Stream: <span className="system-stats__value">{dataMode === 'serial' ? 'USB Serial' : dataMode === 'hardware' ? 'Wi-Fi IP' : 'Simulation'}</span></span>
      </div>
    </div>
  );
}

// ── Dashboard Main Component ───────────────────────────────────

export default function Dashboard({ dataMode = 'hardware', onModeChange }) {
  const sim = useSimulator(1500);
  const fb = useFirebase('WRK-001');
  const webSerial = useWebSerial((logEvent) => {
    // optional serial log handler
  });

  const [mobileView, setMobileView] = useState('map'); // map (GPS Focus) | all | logs

  // Activity intelligence tracker
  const activity = useActivityTracker();

  // Select active data source based on dataMode
  let activeData = fb.data;
  let activeEvents = fb.events;
  let activeReset = fb.resetToSafe;
  let activeTrigger = fb.triggerEvent;

  if (dataMode === 'simulation') {
    activeData = sim.data;
    activeEvents = sim.events;
    activeReset = sim.resetToSafe;
    activeTrigger = sim.triggerEvent;
  } else if (dataMode === 'serial') {
    activeData = webSerial.serialData;
    activeEvents = fb.events; // keep log history
    activeReset = () => {
      // local reset
    };
  }

  const [ipInput, setIpInput] = useState(fb.directIp || '');
  const [ipTesting, setIpTesting] = useState(false);
  const [connectionPopup, setConnectionPopup] = useState(null); // { type: 'success' | 'error', message: string }

  const handleIpSubmit = async (e) => {
    e.preventDefault();
    const cleanIp = ipInput.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanIp) return;

    if (fb.updateDirectIp) fb.updateDirectIp(cleanIp);
    setIpTesting(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`http://${cleanIp}/api/data`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);

      if (res.ok) {
        setConnectionPopup({
          type: 'success',
          title: '✅ ESP32 Connected!',
          message: `Successfully connected to ESP32 at http://${cleanIp}/api/data.\n\nLive GPS and sensor telemetry is now streaming directly into your dashboard.`
        });
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      setConnectionPopup({
        type: 'error',
        title: '⚠️ ESP32 Connection Failed',
        message: `Could not reach ESP32 at http://${cleanIp}/api/data.\n\nWhy did this happen?\n1. Your ESP32 might be running the old sketch that only prints to Serial and doesn't run a web server.\n2. Upload SafeGuard_WiFi_JSON.ino to your ESP32 so it hosts port 80.\nOR simply switch to the "🔌 USB Serial Cable" tab right above to stream instantly via USB!`
      });
    } finally {
      setIpTesting(false);
    }
  };

  const {
    heart_rate = 0, spo2 = 0, altitude = 0, accel_total = 1, tilt_angle = 0,
    is_moving = false, gps_valid = false, satellites = 0, pressure = 1013.25,
    temperature = 25.0, vitals_valid = false, latitude, longitude,
    ax = 0, ay = 0, az = 9.81, speed = 0,
  } = activeData;

  // Feed data to activity tracker every frame
  useEffect(() => {
    activity.processFrame(activeData);
  }, [activeData]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentActivity = speed > 15 ? 'driving' : (is_moving || speed > 1) ? 'walking' : 'stationary';
  const timelineSummary = activity.getTimelineSummary();

  return (
    <div className="dashboard">
      {/* Connection Test Modal Popup */}
      {connectionPopup && (
        <div className="key-modal-overlay" onClick={() => setConnectionPopup(null)}>
          <div className="key-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ color: connectionPopup.type === 'success' ? '#4ade80' : '#f87171', margin: '0 0 12px 0', fontSize: '1.1rem' }}>
              {connectionPopup.title}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5', whiteSpace: 'pre-line', margin: '0 0 20px 0' }}>
              {connectionPopup.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConnectionPopup(null)}
                className="connection-btn"
                style={{ background: connectionPopup.type === 'success' ? '#22c55e' : '#38bdf8', color: '#fff', border: 'none', padding: '8px 20px' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Crash Detection Alert ────────────── */}
      <CrashAlert crashAlert={activity.crashAlert} onDismiss={activity.dismissCrashAlert} />

      {/* ── Emergency Alert Banner ──────────── */}
      <AlertBanner status={activeData.status} workerName={activeData.worker_name} onAcknowledge={activeReset} />

      {/* ── Worker Info Header ─────────────── */}
      <WorkerHeader
        data={activeData}
        dataMode={dataMode}
        directConnected={fb.directConnected}
        serialConnected={webSerial.isConnected}
      />

      {/* ── Hardware Source / Connection Selector Panel ── */}
      <div className="connection-selector-panel glass-card">
        <div className="connection-tabs">
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('hardware')}
            className={`connection-tab ${dataMode === 'hardware' ? 'connection-tab--active' : ''}`}
          >
            📡 Wi-Fi Direct Stream
          </button>
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('serial')}
            className={`connection-tab ${dataMode === 'serial' ? 'connection-tab--active' : ''}`}
          >
            🔌 USB Serial Cable (ESP32)
          </button>
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('simulation')}
            className={`connection-tab ${dataMode === 'simulation' ? 'connection-tab--active' : ''}`}
          >
            🧪 Simulator Test
          </button>
        </div>

        {/* Dynamic Controls based on chosen tab */}
        <div className="connection-tab-content">
          {dataMode === 'hardware' && (
            <div className="connection-row">
              <div className="connection-desc">
                <span>🌐 Enter ESP32 Wi-Fi IP (Printed in Arduino Serial Monitor):</span>
              </div>
              <form onSubmit={handleIpSubmit} className="connection-form">
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.150"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  className="connection-input"
                />
                <button type="submit" disabled={ipTesting} className={`connection-btn ${fb.directConnected ? 'connection-btn--online' : ''}`}>
                  {ipTesting ? 'Testing IP...' : fb.directConnected ? 'Connected ✓' : 'Connect IP'}
                </button>
              </form>
            </div>
          )}

          {dataMode === 'serial' && (
            <div className="connection-row">
              <div className="connection-desc">
                <span>⚡ Connect USB cable to your laptop/phone to stream your exact Arduino Serial outputs:</span>
                {webSerial.serialError && <span style={{ color: '#ef4444', fontSize: '0.7rem', display: 'block' }}>{webSerial.serialError}</span>}
              </div>
              <div>
                {!webSerial.isConnected ? (
                  <button type="button" onClick={webSerial.connectSerial} className="connection-btn connection-btn--usb">
                    🔌 Select ESP32 COM Port
                  </button>
                ) : (
                  <button type="button" onClick={webSerial.disconnectSerial} className="connection-btn connection-btn--online">
                    Disconnect Serial ✓
                  </button>
                )}
              </div>
            </div>
          )}

          {dataMode === 'simulation' && (
            <SimControls onTrigger={activeTrigger} onReset={activeReset} currentStatus={activeData.status} />
          )}
        </div>
      </div>

      {/* ── Command Center Section Header & Mobile View Selector ── */}
      <SectionHeader
        title="Command Center"
        rightElement={
          <div className="mobile-view-switcher">
            <button
              type="button"
              onClick={() => setMobileView('map')}
              className={`mobile-view-btn ${mobileView === 'map' ? 'mobile-view-btn--active' : ''}`}
            >
              🛰️ GPS Live Tracker
            </button>
            <button
              type="button"
              onClick={() => setMobileView('all')}
              className={`mobile-view-btn ${mobileView === 'all' ? 'mobile-view-btn--active' : ''}`}
            >
              📊 All Sensors
            </button>
            <button
              type="button"
              onClick={() => setMobileView('logs')}
              className={`mobile-view-btn ${mobileView === 'logs' ? 'mobile-view-btn--active' : ''}`}
            >
              📋 Logs
            </button>
            <button
              type="button"
              onClick={() => setMobileView('insights')}
              className={`mobile-view-btn ${mobileView === 'insights' ? 'mobile-view-btn--active' : ''}`}
            >
              🧠 Insights
            </button>
          </div>
        }
      />

      {/* ── Bento Grid Layout (Adaptive for Laptop & Mobile) ── */}
      <div className={`dashboard__bento dashboard__bento--view-${mobileView}`}>

        {/* ❤️ Heart Rate Card */}
        {(mobileView === 'all') && (
          <div className="vital-card vital-card--hr glass-card" id="tile-heart-rate">
            <div className="card-header">
              <div className="card-header__label">
                <span className="card-header__icon card-header__icon--hr">❤️</span>
                Heart Rate
              </div>
              <span className={`card-header__badge card-header__badge--${getHRStatus(heart_rate)}`}>
                {vitals_valid ? (heart_rate < 40 || heart_rate > 150 ? 'Abnormal' : 'Normal') : 'Standby'}
              </span>
            </div>
            <div className="vital-card__value-row">
              <span className={`vital-card__value ${getHRClass(heart_rate)}`}>
                {vitals_valid ? Math.round(heart_rate) : '—'}
              </span>
              <span className="vital-card__unit">BPM</span>
            </div>
            <div className="vital-card__sub">
              {vitals_valid
                ? heart_rate < 40 || heart_rate > 150 ? '⚠ CRITICAL — Immediate attention' : '● Normal sinus rhythm'
                : 'Sensor initialized'}
            </div>
            <RangeBar percent={vitals_valid ? getHRPercent(heart_rate) : 0} status={getHRStatus(heart_rate)} />
            <div className="vital-card__detail">Safe range: 60–100 BPM · Alert: &lt;40 or &gt;150</div>
          </div>
        )}

        {/* 🫁 SpO₂ Card */}
        {(mobileView === 'all') && (
          <div className="vital-card vital-card--spo2 glass-card" id="tile-spo2">
            <div className="card-header">
              <div className="card-header__label">
                <span className="card-header__icon card-header__icon--spo2">🫁</span>
                Blood Oxygen
              </div>
              <span className={`card-header__badge card-header__badge--${getSpO2Status(spo2)}`}>
                {vitals_valid ? (spo2 < 90 ? 'Hypoxia' : spo2 < 95 ? 'Low' : 'Healthy') : 'Standby'}
              </span>
            </div>
            <div className="vital-card__value-row">
              <span className={`vital-card__value ${getSpO2Class(spo2)}`}>
                {vitals_valid ? Math.round(spo2) : '—'}
              </span>
              <span className="vital-card__unit">% SpO₂</span>
            </div>
            <div className="vital-card__sub">
              {vitals_valid
                ? spo2 < 90 ? '⚠ HYPOXIA — Oxygen support needed' : spo2 < 95 ? '⚠ Below optimal saturation' : '● Optimal oxygen saturation'
                : 'Waiting for pulse oximeter'}
            </div>
            <RangeBar percent={vitals_valid ? getSpO2Percent(spo2) : 0} status={getSpO2Status(spo2)} />
            <div className="vital-card__detail">Target: ≥95% · Critical: &lt;90% · Danger: &lt;85%</div>
          </div>
        )}

        {/* 🗺️ Live GPS Map Widget */}
        {(mobileView === 'all' || mobileView === 'map') && (
          <MapErrorBoundary>
            <MapWidget
              latitude={latitude}
              longitude={longitude}
              gpsValid={gps_valid}
              status={activeData.status}
              workerName={activeData.worker_name}
              satellites={satellites}
            />
          </MapErrorBoundary>
        )}

        {/* ⛰️ Altitude Card */}
        {(mobileView === 'all') && (
          <div className="vital-card vital-card--alt glass-card" id="tile-altitude">
            <div className="card-header">
              <div className="card-header__label">
                <span className="card-header__icon card-header__icon--altitude">⛰️</span>
                Altitude & Environment
              </div>
            </div>
            <div className="vital-card__value-row">
              <span className="vital-card__value value--info">{Number(altitude).toFixed(1)}</span>
              <span className="vital-card__unit">meters</span>
            </div>
            <div className="vital-card__sub">{Number(pressure).toFixed(1)} hPa · {Number(temperature).toFixed(1)}°C</div>
            <RangeBar percent={Math.min(100, Math.max(0, (altitude / 500) * 100))} status="info" />
            <div className="vital-card__detail">BMP280 Barometric · Temperature: {Number(temperature).toFixed(1)}°C</div>
          </div>
        )}

        {/* 🏃 Motion & Tilt Card */}
        {(mobileView === 'all') && (
          <div className="vital-card vital-card--motion glass-card" id="tile-motion">
            <div className="card-header">
              <div className="card-header__label">
                <span className="card-header__icon card-header__icon--motion">
                  {speed > 15 ? '🚙' : '🏃'}
                </span>
                Activity & Motion
              </div>
              <span className={`card-header__badge card-header__badge--${getTiltStatus(tilt_angle)}`}>
                {tilt_angle > 60 ? 'Fallen' : tilt_angle > 30 ? 'Tilted' : 'Upright'}
              </span>
            </div>
            <div className="vital-card__value-row">
              <span className={`vital-card__value ${getTiltClass(tilt_angle)}`}>{getMotionLabel(is_moving, accel_total, speed)}</span>
            </div>
            <div className="vital-card__sub">Speed: {Number(speed).toFixed(1)} km/h · Accel: {Number(accel_total).toFixed(2)}g</div>
            <div className="vital-card__sub" style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: '2px' }}>
              Tilt: {Number(tilt_angle).toFixed(1)}° · Z-Accel: {Number(az).toFixed(2)}
            </div>
            <RangeBar percent={Math.min(100, (tilt_angle / 90) * 100)} status={getTiltStatus(tilt_angle)} />
            <div className="vital-card__detail">MPU6050 Calibrated 6-Axis · Fall: &gt;60° · Moving: &gt;0.15g deviation</div>
          </div>
        )}

        {/* 🛰️ GPS Telemetry Card */}
        {(mobileView === 'all' || mobileView === 'map') && (
          <div className="vital-card vital-card--gps glass-card" id="tile-gps">
            <div className="card-header">
              <div className="card-header__label">
                <span className="card-header__icon card-header__icon--gps">🛰️</span>
                GPS Receiver Status
              </div>
              <span className={`card-header__badge card-header__badge--${gps_valid ? 'safe' : 'warning'}`}>
                {gps_valid ? '3D Fix Fixed' : 'Searching Fix'}
              </span>
            </div>
            <div className="vital-card__gps-grid">
              <div className="vital-card__gps-stat">
                <span className="vital-card__gps-stat-label">Satellites</span>
                <span className={`vital-card__gps-stat-value ${gps_valid ? 'value--safe' : 'value--warning'}`}>
                  {satellites || 0} / 12
                </span>
              </div>
              <div className="vital-card__gps-stat">
                <span className="vital-card__gps-stat-label">Coordinates</span>
                <span className="vital-card__gps-stat-value value--info">
                  {latitude?.toFixed(5) || '—'}, {longitude?.toFixed(5) || '—'}
                </span>
              </div>
              <div className="vital-card__gps-stat">
                <span className="vital-card__gps-stat-label">Baud Rate</span>
                <span className="vital-card__gps-stat-value value--safe">
                  9600 bps (UART2)
                </span>
              </div>
              <div className="vital-card__gps-stat">
                <span className="vital-card__gps-stat-label">Pinout</span>
                <span className="vital-card__gps-stat-value value--info">
                  RX=16 / TX=17
                </span>
              </div>
            </div>
            <RangeBar percent={Math.min(100, ((satellites || 0) / 12) * 100)} status={gps_valid ? 'safe' : 'warning'} />
          </div>
        )}

        {/* 📋 Event Log */}
        {(mobileView === 'all' || mobileView === 'logs') && (
          <EventLog events={activeEvents} />
        )}
      </div>

      {/* ── Intelligence Insights Section ────── */}
      {(mobileView === 'all' || mobileView === 'insights') && (
        <>
          <SectionHeader title="Activity Intelligence" />
          <div className="insights-grid">
            <ActivityTimeline
              timeline={activity.timeline}
              currentActivity={currentActivity}
              summary={timelineSummary}
            />
            <HealthCorrelation healthData={activity.healthData} />
            <GeofencePanel
              geofence={activity.geofence}
              geofenceStatus={activity.geofenceStatus}
              onUpdateGeofence={activity.updateGeofence}
              latitude={latitude}
              longitude={longitude}
            />
          </div>
        </>
      )}

      {/* ── System Stats Footer ────────────── */}
      <SystemStats events={activeEvents} dataMode={dataMode} />
    </div>
  );
}
