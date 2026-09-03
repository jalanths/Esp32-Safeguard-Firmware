/*
 * VitalsPanel.jsx – Worker Vitals & Sensor Tiles
 * ═══════════════════════════════════════════════════
 * Displays heart rate, SpO₂, altitude, motion, and GPS
 * as individual glassmorphic stat tiles with:
 * - Dynamic value coloring based on safety thresholds
 * - Threshold range indicator bars
 * - Icon backgrounds with accent colors
 * - Detailed secondary info rows
 */

// ── Threshold helpers ──────────────────────────────────────────

function getHRClass(hr) {
  if (!hr || hr <= 0) return 'value--neutral';
  if (hr < 40 || hr > 150) return 'value--danger';
  if (hr < 50 || hr > 120) return 'value--warning';
  return 'value--safe';
}

function getHRRangeStatus(hr) {
  if (!hr || hr <= 0) return 'info';
  if (hr < 40 || hr > 150) return 'danger';
  if (hr < 50 || hr > 120) return 'warning';
  return 'safe';
}

// Percentage of where HR falls in 30–180 range
function getHRPercent(hr) {
  if (!hr || hr <= 0) return 0;
  return Math.min(100, Math.max(0, ((hr - 30) / (180 - 30)) * 100));
}

function getSpO2Class(spo2) {
  if (!spo2 || spo2 <= 0) return 'value--neutral';
  if (spo2 < 90) return 'value--danger';
  if (spo2 < 95) return 'value--warning';
  return 'value--safe';
}

function getSpO2RangeStatus(spo2) {
  if (!spo2 || spo2 <= 0) return 'info';
  if (spo2 < 90) return 'danger';
  if (spo2 < 95) return 'warning';
  return 'safe';
}

function getSpO2Percent(spo2) {
  if (!spo2 || spo2 <= 0) return 0;
  return Math.min(100, Math.max(0, ((spo2 - 70) / (100 - 70)) * 100));
}

function getTiltClass(tilt) {
  if (tilt > 60) return 'value--danger';
  if (tilt > 30) return 'value--warning';
  return 'value--safe';
}

function getTiltRangeStatus(tilt) {
  if (tilt > 60) return 'danger';
  if (tilt > 30) return 'warning';
  return 'safe';
}

function getTiltPercent(tilt) {
  return Math.min(100, Math.max(0, (tilt / 90) * 100));
}

function getMotionLabel(isMoving, accel, speed = 0) {
  if (accel < 0.4) return 'FREE FALL';
  if (speed > 15) return 'Driving';
  if (isMoving || speed > 1) return 'Walking';
  return 'Stationary';
}

// ── Range Bar Sub-Component ────────────────────────────────────

function RangeBar({ percent, status }) {
  return (
    <div className="stat-tile__range-bar">
      <div
        className={`stat-tile__range-fill stat-tile__range-fill--${status}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────

export default function VitalsPanel({ data }) {
  const {
    heart_rate = 0,
    spo2 = 0,
    altitude = 0,
    accel_total = 1,
    tilt_angle = 0,
    is_moving = false,
    gps_valid = false,
    satellites = 0,
    pressure = 0,
    temperature = 0,
    vitals_valid = false,
    ax = 0,
    ay = 0,
    az = 9.81,
    speed = 0,
  } = data;

  return (
    <div className="worker-card">
      {/* ── Heart Rate ────────────────────── */}
      <div className="stat-tile stat-tile--hr glass-card" id="tile-heart-rate">
        <div className="stat-tile__header">
          <div className="stat-tile__label">
            <span className="stat-tile__icon stat-tile__icon--hr">❤️</span>
            Heart Rate
          </div>
        </div>
        <div className={`stat-tile__value ${getHRClass(heart_rate)}`}>
          {vitals_valid ? Math.round(heart_rate) : '—'}
          <span className="stat-tile__unit">BPM</span>
        </div>
        <div className="stat-tile__sub">
          {vitals_valid
            ? heart_rate < 40 || heart_rate > 150
              ? '⚠ ABNORMAL'
              : '● Normal range'
            : 'Sensor not detected'}
        </div>
        <RangeBar
          percent={vitals_valid ? getHRPercent(heart_rate) : 0}
          status={getHRRangeStatus(heart_rate)}
        />
        <div className="stat-tile__range-info">
          Normal: 60–100 BPM
        </div>
      </div>

      {/* ── SpO₂ ──────────────────────────── */}
      <div className="stat-tile stat-tile--spo2 glass-card" id="tile-spo2">
        <div className="stat-tile__header">
          <div className="stat-tile__label">
            <span className="stat-tile__icon stat-tile__icon--spo2">🫁</span>
            Blood Oxygen
          </div>
        </div>
        <div className={`stat-tile__value ${getSpO2Class(spo2)}`}>
          {vitals_valid ? Math.round(spo2) : '—'}
          <span className="stat-tile__unit">%</span>
        </div>
        <div className="stat-tile__sub">
          {vitals_valid
            ? spo2 < 90
              ? '⚠ HYPOXIA WARNING'
              : spo2 < 95
              ? '⚠ Low SpO₂'
              : '● Healthy levels'
            : 'Waiting for reading'}
        </div>
        <RangeBar
          percent={vitals_valid ? getSpO2Percent(spo2) : 0}
          status={getSpO2RangeStatus(spo2)}
        />
        <div className="stat-tile__range-info">
          Target: ≥95% · Critical: &lt;90%
        </div>
      </div>

      {/* ── Altitude ──────────────────────── */}
      <div className="stat-tile stat-tile--altitude glass-card" id="tile-altitude">
        <div className="stat-tile__header">
          <div className="stat-tile__label">
            <span className="stat-tile__icon stat-tile__icon--altitude">⛰️</span>
            Altitude
          </div>
        </div>
        <div className="stat-tile__value value--info">
          {altitude.toFixed(1)}
          <span className="stat-tile__unit">m</span>
        </div>
        <div className="stat-tile__sub">
          {pressure.toFixed(0)} hPa · {temperature.toFixed(1)}°C
        </div>
        <RangeBar
          percent={Math.min(100, Math.max(0, (altitude / 50) * 100))}
          status="info"
        />
        <div className="stat-tile__range-info">
          Barometric altitude estimate
        </div>
      </div>

      {/* ── Motion / Tilt ───────────────────── */}
      <div className="stat-tile stat-tile--motion glass-card" id="tile-motion">
        <div className="stat-tile__header">
          <div className="stat-tile__label">
            <span className="stat-tile__icon stat-tile__icon--motion">
              {speed > 15 ? '🚙' : '🏃'}
            </span>
            Activity
          </div>
        </div>
        <div className={`stat-tile__value ${getTiltClass(tilt_angle)}`}>
          {getMotionLabel(is_moving, accel_total, speed)}
        </div>
        <div className="stat-tile__sub">
          Speed: {speed.toFixed(1)} km/h · Accel: {accel_total.toFixed(2)}g
        </div>
        <div className="stat-tile__sub" style={{ fontSize: '0.6rem', opacity: 0.7, marginTop: '1px' }}>
          Tilt: {tilt_angle.toFixed(1)}°
        </div>
        <RangeBar
          percent={getTiltPercent(tilt_angle)}
          status={getTiltRangeStatus(tilt_angle)}
        />
        <div className="stat-tile__range-info">
          Calibrated 6-Axis · Fall: &gt;60° · Moving: &gt;0.15g
        </div>
      </div>

      {/* ── GPS ───────────────────────────── */}
      <div className="stat-tile stat-tile--gps glass-card" id="tile-gps">
        <div className="stat-tile__header">
          <div className="stat-tile__label">
            <span className="stat-tile__icon stat-tile__icon--gps">🛰️</span>
            GPS Status
          </div>
        </div>
        <div className={`stat-tile__value ${gps_valid ? 'value--safe' : 'value--warning'}`}>
          {gps_valid ? 'Fixed' : 'Searching'}
        </div>
        <div className="stat-tile__sub">
          {satellites} satellite{satellites !== 1 ? 's' : ''} acquired
        </div>
        <RangeBar
          percent={Math.min(100, (satellites / 12) * 100)}
          status={gps_valid ? 'safe' : 'warning'}
        />
        <div className="stat-tile__range-info">
          Min 4 sats for fix · Tracking {satellites}/12
        </div>
      </div>
    </div>
  );
}
