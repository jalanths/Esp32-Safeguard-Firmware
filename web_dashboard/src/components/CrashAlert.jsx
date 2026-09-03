/*
 * CrashAlert.jsx – Vehicle Crash Detection Alert Banner
 * ═══════════════════════════════════════════════════════
 * Shows a dramatic full-width emergency banner when a
 * potential vehicle crash is detected (high G-force + speed drop).
 */

export default function CrashAlert({ crashAlert, onDismiss }) {
  if (!crashAlert) return null;

  return (
    <div className="crash-alert" id="crash-alert-banner">
      <div className="crash-alert__inner">
        <div className="crash-alert__icon">🚨</div>
        <div className="crash-alert__content">
          <div className="crash-alert__title">VEHICLE CRASH DETECTED</div>
          <div className="crash-alert__message">{crashAlert.message}</div>
          <div className="crash-alert__meta">
            <span>Speed: {crashAlert.speedBefore?.toFixed(0)} → {crashAlert.speedAfter?.toFixed(0)} km/h</span>
            <span>Impact: {crashAlert.gForce?.toFixed(2)}g</span>
            <span>{new Date(crashAlert.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
        <button
          type="button"
          className="crash-alert__dismiss"
          onClick={onDismiss}
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
