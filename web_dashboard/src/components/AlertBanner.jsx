/*
 * AlertBanner.jsx – Emergency Alert Banner
 * ═══════════════════════════════════════════
 * Full-width banner that changes appearance based on worker status.
 * Flashes red with animation during emergencies.
 * Refined typography and cleaner layout.
 */

import { useEffect, useRef } from 'react';

// Emergency type display info
const EMERGENCY_INFO = {
  SAFE: {
    icon: '🛡️',
    title: 'All Systems Normal',
    message: 'Worker vitals and motion are within safe parameters',
    variant: 'safe',
  },
  FALL_DETECTED: {
    icon: '⚠️',
    title: '🚨 FALL DETECTED',
    message: 'Impact followed by prolonged inactivity – immediate response required',
    variant: 'emergency',
  },
  FALL_FROM_HEIGHT: {
    icon: '🆘',
    title: '🚨 FALL FROM HEIGHT',
    message: 'Altitude drop + high impact + no movement – critical emergency',
    variant: 'emergency',
  },
  WORKER_COLLAPSE: {
    icon: '🫀',
    title: '🚨 WORKER COLLAPSE',
    message: 'Abnormal posture + inactivity + irregular heart rate detected',
    variant: 'emergency',
  },
  MEDICAL_EMERGENCY: {
    icon: '💔',
    title: '🚨 MEDICAL EMERGENCY',
    message: 'Critical heart rate or SpO₂ levels while stationary',
    variant: 'emergency',
  },
};

export default function AlertBanner({ status, workerName, onAcknowledge }) {
  const audioRef = useRef(null);
  const info = EMERGENCY_INFO[status] || EMERGENCY_INFO.SAFE;
  const isEmergency = status !== 'SAFE';

  // Play alarm sound on emergency
  useEffect(() => {
    if (isEmergency) {
      // Create an oscillator-based alarm (no external audio file needed)
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (freq, startTime, duration) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        // Three-tone alarm pattern
        const now = ctx.currentTime;
        playBeep(880, now, 0.15);
        playBeep(1100, now + 0.2, 0.15);
        playBeep(880, now + 0.4, 0.15);

        audioRef.current = ctx;
      } catch {
        // Audio might be blocked by browser policy – fail silently
      }
    }

    return () => {
      if (audioRef.current && audioRef.current.state !== 'closed') {
        try { audioRef.current.close(); } catch { /* ignore */ }
      }
    };
  }, [isEmergency, status]);

  return (
    <div className={`alert-banner alert-banner--${info.variant}`} role="alert" aria-live="assertive">
      <div className="alert-banner__inner">
        <span className="alert-banner__icon">{info.icon}</span>
        <div className="alert-banner__content">
          <div className="alert-banner__title" style={{ color: isEmergency ? 'var(--danger)' : 'var(--safe)' }}>
            {info.title}
          </div>
          <div className="alert-banner__message">
            {isEmergency ? `${workerName} — ${info.message}` : info.message}
          </div>
        </div>
        {isEmergency ? (
          <button
            className="alert-banner__action alert-banner__action--danger"
            onClick={onAcknowledge}
            id="btn-acknowledge-emergency"
          >
            ✓ Acknowledge
          </button>
        ) : (
          <span className="alert-banner__action alert-banner__action--safe">
            ● Monitoring
          </span>
        )}
      </div>
    </div>
  );
}
