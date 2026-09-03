/*
 * useActivityTracker.js – Activity Intelligence Hook
 * ════════════════════════════════════════════════════
 * Tracks:
 *   1. Activity timeline history (Walking / Driving / Stationary)
 *   2. Vehicle crash detection (sudden G-force + high speed)
 *   3. Geofence boundary violations
 *   4. Health-activity correlation data (HR vs activity)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Activity Classification ────────────────────────────────────

function classifyActivity(speed = 0, accelTotal = 1, isMoving = false) {
  if (speed > 15) return 'driving';
  if (isMoving || speed > 1) return 'walking';
  return 'stationary';
}

// ── Geofence helpers ───────────────────────────────────────────

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Crash Detection Thresholds ─────────────────────────────────

const CRASH_SPEED_THRESHOLD = 20;     // Must be driving > 20 km/h
const CRASH_G_FORCE_THRESHOLD = 2.5;  // Sudden spike in G-force
const CRASH_DECEL_THRESHOLD = 0.3;    // Sudden drop in accel from driving baseline
const CRASH_COOLDOWN_MS = 30000;      // Don't re-trigger within 30s

// ── Hook ───────────────────────────────────────────────────────

export function useActivityTracker() {
  // Activity timeline: array of { timestamp, activity, duration_s }
  const [timeline, setTimeline] = useState([]);
  // Health correlation: array of { timestamp, heart_rate, activity }
  const [healthData, setHealthData] = useState([]);
  // Geofence config
  const [geofence, setGeofence] = useState(() => {
    const saved = localStorage.getItem('safeguard_geofence');
    return saved ? JSON.parse(saved) : {
      enabled: false,
      center: { lat: 17.3850, lng: 78.4867 },
      radius: 200, // meters
    };
  });
  const [geofenceStatus, setGeofenceStatus] = useState({ inside: true, distance: 0 });
  // Crash detection
  const [crashAlert, setCrashAlert] = useState(null);

  const prevDataRef = useRef(null);
  const lastActivityRef = useRef({ activity: 'stationary', startTime: Date.now() });
  const lastCrashTimeRef = useRef(0);
  const speedHistoryRef = useRef([]); // For crash: track recent speeds

  // ── Process each incoming data frame ─────────────────────────

  const processFrame = useCallback((data) => {
    const now = Date.now();
    const {
      speed = 0, accel_total = 1, is_moving = false,
      heart_rate = 0, latitude, longitude,
    } = data;

    const activity = classifyActivity(speed, accel_total, is_moving);

    // 1. Update activity timeline
    const lastAct = lastActivityRef.current;
    if (activity !== lastAct.activity) {
      const durationS = Math.round((now - lastAct.startTime) / 1000);
      if (durationS > 0) {
        setTimeline(prev => {
          const entry = {
            activity: lastAct.activity,
            startTime: lastAct.startTime,
            endTime: now,
            duration_s: durationS,
          };
          return [...prev, entry].slice(-200); // Keep last 200 segments
        });
      }
      lastActivityRef.current = { activity, startTime: now };
    }

    // 2. Health-activity correlation sampling (every frame)
    setHealthData(prev => {
      const entry = {
        timestamp: now,
        heart_rate,
        speed,
        activity,
      };
      return [...prev, entry].slice(-120); // ~3 minutes at 1.5s intervals
    });

    // 3. Geofence check
    if (geofence.enabled && latitude && longitude) {
      const dist = haversineDistance(
        geofence.center.lat, geofence.center.lng,
        latitude, longitude
      );
      const inside = dist <= geofence.radius;
      setGeofenceStatus({ inside, distance: Math.round(dist) });
    }

    // 4. Crash detection
    speedHistoryRef.current.push({ speed, accel: accel_total, time: now });
    // Keep only last 10 frames (~15 seconds)
    if (speedHistoryRef.current.length > 10) {
      speedHistoryRef.current = speedHistoryRef.current.slice(-10);
    }

    const history = speedHistoryRef.current;
    if (history.length >= 3 && (now - lastCrashTimeRef.current) > CRASH_COOLDOWN_MS) {
      // Was driving fast recently?
      const recentHighSpeed = history.slice(-5).some(h => h.speed > CRASH_SPEED_THRESHOLD);
      // Sudden deceleration or G-force spike?
      const prevFrame = history[history.length - 2];
      const speedDrop = prevFrame ? (prevFrame.speed - speed) : 0;
      const suddenStop = recentHighSpeed && (speedDrop > 15 || speed < 2);
      const gForceSpike = accel_total > CRASH_G_FORCE_THRESHOLD;
      const accelDrop = prevFrame ? (prevFrame.accel - accel_total) : 0;
      const suddenDecel = recentHighSpeed && Math.abs(accelDrop) > CRASH_DECEL_THRESHOLD;

      if ((suddenStop && (gForceSpike || suddenDecel)) || (recentHighSpeed && gForceSpike)) {
        lastCrashTimeRef.current = now;
        const alert = {
          id: now.toString(),
          type: 'VEHICLE_CRASH',
          message: `⚠️ Possible vehicle crash detected! Speed dropped from ${prevFrame?.speed?.toFixed(0) || '?'} → ${speed.toFixed(0)} km/h with ${accel_total.toFixed(2)}g impact`,
          timestamp: new Date().toISOString(),
          severity: 'danger',
          speedBefore: prevFrame?.speed || 0,
          speedAfter: speed,
          gForce: accel_total,
        };
        setCrashAlert(alert);
        // Auto-clear after 30 seconds
        setTimeout(() => setCrashAlert(null), 30000);
      }
    }

    prevDataRef.current = data;
  }, [geofence]);

  // ── Update geofence and persist ──────────────────────────────

  const updateGeofence = useCallback((newConfig) => {
    setGeofence(prev => {
      const updated = { ...prev, ...newConfig };
      localStorage.setItem('safeguard_geofence', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const dismissCrashAlert = useCallback(() => {
    setCrashAlert(null);
  }, []);

  // Get current activity label
  const getCurrentActivity = useCallback(() => {
    return lastActivityRef.current.activity;
  }, []);

  // Get timeline summary (total time per activity)
  const getTimelineSummary = useCallback(() => {
    const summary = { walking: 0, driving: 0, stationary: 0 };
    timeline.forEach(seg => {
      if (summary[seg.activity] !== undefined) {
        summary[seg.activity] += seg.duration_s;
      }
    });
    // Include current ongoing segment
    const current = lastActivityRef.current;
    const ongoingS = Math.round((Date.now() - current.startTime) / 1000);
    if (summary[current.activity] !== undefined) {
      summary[current.activity] += ongoingS;
    }
    return summary;
  }, [timeline]);

  return {
    processFrame,
    timeline,
    healthData,
    geofence,
    geofenceStatus,
    updateGeofence,
    crashAlert,
    dismissCrashAlert,
    getCurrentActivity,
    getTimelineSummary,
  };
}

export default useActivityTracker;
