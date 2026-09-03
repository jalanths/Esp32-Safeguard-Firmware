/*
 * SimControls.jsx – Simulation Control Panel
 * ═══════════════════════════════════════════
 * Provides buttons to simulate different emergency scenarios
 * for testing the dashboard without real hardware.
 */

export default function SimControls({ onTrigger, onReset, currentStatus }) {
  return (
    <div className="sim-controls glass-card">
      <span className="sim-controls__label">🧪 Simulate</span>

      <button
        className="sim-btn sim-btn--danger"
        onClick={() => onTrigger('FALL_DETECTED')}
        disabled={currentStatus !== 'SAFE'}
        id="sim-btn-fall"
      >
        👤↓ Fall
      </button>

      <button
        className="sim-btn sim-btn--danger"
        onClick={() => onTrigger('FALL_FROM_HEIGHT')}
        disabled={currentStatus !== 'SAFE'}
        id="sim-btn-fall-height"
      >
        🏗️↓ Fall from Height
      </button>

      <button
        className="sim-btn sim-btn--warning"
        onClick={() => onTrigger('WORKER_COLLAPSE')}
        disabled={currentStatus !== 'SAFE'}
        id="sim-btn-collapse"
      >
        🫀 Collapse
      </button>

      <button
        className="sim-btn sim-btn--danger"
        onClick={() => onTrigger('MEDICAL_EMERGENCY')}
        disabled={currentStatus !== 'SAFE'}
        id="sim-btn-medical"
      >
        💔 Medical Emergency
      </button>

      {currentStatus !== 'SAFE' && (
        <button
          className="sim-btn sim-btn--safe"
          onClick={onReset}
          id="sim-btn-reset"
          style={{ marginLeft: 'auto' }}
        >
          ✓ Reset to Safe
        </button>
      )}

      <button
        className="sim-btn"
        onClick={() => onTrigger('DRIVING')}
        disabled={currentStatus !== 'SAFE' && currentStatus !== 'DRIVING'}
        id="sim-btn-drive"
        style={{ marginLeft: currentStatus === 'SAFE' ? 'auto' : '10px', background: 'var(--blue)', color: '#fff', border: 'none' }}
      >
        🚙 Drive
      </button>

      <button
        className="sim-btn sim-btn--danger"
        onClick={() => onTrigger('VEHICLE_CRASH')}
        disabled={currentStatus !== 'SAFE' && currentStatus !== 'DRIVING'}
        id="sim-btn-crash"
        style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none' }}
      >
        💥 Crash Test
      </button>
    </div>
  );
}
