/*
 * useSimulator.js – Data Simulation Hook
 * ═══════════════════════════════════════════
 * Generates realistic mock sensor data for dashboard testing
 * without requiring the ESP32 hardware or Firebase connection.
 *
 * Usage: const { data, triggerEvent, resetToSafe } = useSimulator();
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Realistic data ranges ──────────────────────────────────────

const NORMAL_RANGES = {
  heartRate:   { min: 65, max: 95 },
  spO2:        { min: 96, max: 99 },
  altitude:    { base: 12.5, variance: 0.3 },
  temperature: { base: 28.5, variance: 1.5 },
  accelTotal:  { base: 1.0, variance: 0.08 },
  tiltAngle:   { base: 5.0, variance: 8 },
  latitude:    { base: 17.3850, variance: 0.0005 },
  longitude:   { base: 78.4867, variance: 0.0005 },
  speed:       { base: 4.5, variance: 1.5 }, // Walking speed km/h
};

const DRIVING_RANGES = {
  ...NORMAL_RANGES,
  heartRate:   { min: 70, max: 85 },
  accelTotal:  { base: 1.05, variance: 0.1 }, // Less sharp accel than walking
  tiltAngle:   { base: 15.0, variance: 5 }, // Sitting posture tilt
  speed:       { base: 45.0, variance: 10.0 }, // Driving speed km/h
};

// ── Emergency scenarios ────────────────────────────────────────

const EMERGENCY_PROFILES = {
  FALL_DETECTED: {
    heartRate:  { min: 100, max: 130 },
    spO2:      { min: 93, max: 97 },
    accelTotal: { base: 0.98, variance: 0.02 },
    tiltAngle:  { base: 85, variance: 5 },
  },
  FALL_FROM_HEIGHT: {
    heartRate:  { min: 110, max: 140 },
    spO2:      { min: 90, max: 95 },
    altitude:   { base: 3.0, variance: 0.2 },
    accelTotal: { base: 1.0, variance: 0.02 },
    tiltAngle:  { base: 88, variance: 3 },
  },
  WORKER_COLLAPSE: {
    heartRate:  { min: 35, max: 50 },
    spO2:      { min: 88, max: 93 },
    accelTotal: { base: 0.99, variance: 0.01 },
    tiltAngle:  { base: 75, variance: 10 },
  },
  MEDICAL_EMERGENCY: {
    heartRate:  { min: 155, max: 180 },
    spO2:      { min: 85, max: 90 },
    accelTotal: { base: 1.0, variance: 0.03 },
    tiltAngle:  { base: 10, variance: 5 },
  },
  VEHICLE_CRASH: {
    heartRate:  { min: 120, max: 160 },
    spO2:      { min: 88, max: 94 },
    accelTotal: { base: 3.2, variance: 0.5 }, // High G-force impact
    tiltAngle:  { base: 70, variance: 15 },
    speed:      { base: 2, variance: 1 }, // Sudden near-stop
  },
};

// ── Utility ────────────────────────────────────────────────────

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomAround(base, variance) {
  return base + (Math.random() - 0.5) * 2 * variance;
}

function smoothValue(current, target, factor = 0.15) {
  return current + (target - current) * factor;
}

// ── Default initial state ──────────────────────────────────────

function createInitialData() {
  return {
    worker_id:    'WRK-001',
    worker_name:  'Rajesh Kumar',
    status:       'SAFE',
    is_emergency: false,
    heart_rate:   72,
    spo2:         98,
    vitals_valid: true,
    accel_total:  1.0,
    tilt_angle:   5.0,
    is_moving:    true,
    altitude:     12.5,
    pressure:     1013.2,
    temperature:  28.5,
    latitude:     17.3850,
    longitude:    78.4867,
    speed:        0.0,
    gps_valid:    true,
    satellites:   8,
    timestamp:    new Date().toISOString(),
    device_ms:    0,
  };
}

// ── Hook ───────────────────────────────────────────────────────

export function useSimulator(updateIntervalMs = 1500) {
  const [data, setData] = useState(createInitialData());
  const [events, setEvents] = useState([]);
  const currentRef = useRef(createInitialData());
  const statusRef = useRef('SAFE');

  // Generate next data frame
  const generateFrame = useCallback(() => {
    const current = currentRef.current;
    const status = statusRef.current;
    const profile = EMERGENCY_PROFILES[status];
    const isEmergency = status !== 'SAFE' && status !== 'DRIVING';

    // For crash: briefly inject high speed history before crash
    if (status === 'VEHICLE_CRASH' && (current.speed || 0) < 5 && !current._crashPrepped) {
      // First frame of crash: pretend we were driving fast
      current.speed = 55;
      current._crashPrepped = true;
    }

    // Heart rate
    const hrRange = profile?.heartRate || NORMAL_RANGES.heartRate;
    const hrTarget = randomInRange(hrRange.min, hrRange.max);
    const heartRate = Math.round(smoothValue(current.heart_rate, hrTarget, 0.2));

    // SpO2
    const spRange = profile?.spO2 || NORMAL_RANGES.spO2;
    const spTarget = randomInRange(spRange.min, spRange.max);
    const spo2 = Math.round(smoothValue(current.spo2, spTarget, 0.15));

    // Altitude
    const altProfile = profile?.altitude || NORMAL_RANGES.altitude;
    const altTarget = randomAround(altProfile.base, altProfile.variance);
    const altitude = parseFloat(smoothValue(current.altitude, altTarget, 0.1).toFixed(1));

    // Acceleration
    const accProfile = profile?.accelTotal || NORMAL_RANGES.accelTotal;
    const accTarget = randomAround(accProfile.base, accProfile.variance);
    const accelTotal = parseFloat(smoothValue(current.accel_total, accTarget, 0.2).toFixed(2));

    // Tilt
    const tiltProfile = profile?.tiltAngle || NORMAL_RANGES.tiltAngle;
    const tiltTarget = randomAround(tiltProfile.base, tiltProfile.variance);
    const tiltAngle = parseFloat(smoothValue(current.tilt_angle, tiltTarget, 0.15).toFixed(1));

    // GPS (slow drift)
    const lat = parseFloat(randomAround(NORMAL_RANGES.latitude.base, NORMAL_RANGES.latitude.variance).toFixed(6));
    const lng = parseFloat(randomAround(NORMAL_RANGES.longitude.base, NORMAL_RANGES.longitude.variance).toFixed(6));

    const isMoving = !isEmergency && Math.abs(accelTotal - 1.0) > 0.05;

    // Speed
    const activeRanges = status === 'DRIVING' ? DRIVING_RANGES : NORMAL_RANGES;
    const speedProfile = profile?.speed || activeRanges.speed;
    const speedTarget = isMoving || status === 'DRIVING' ? randomAround(speedProfile.base, speedProfile.variance) : 0;
    const speed = parseFloat(smoothValue(current.speed || 0, Math.max(0, speedTarget), 0.2).toFixed(1));

    const newData = {
      ...current,
      status:       status === 'DRIVING' ? 'SAFE' : status, // keep status SAFE if driving
      is_emergency: isEmergency,
      heart_rate:   heartRate,
      spo2:         spo2,
      vitals_valid: true,
      accel_total:  accelTotal,
      tilt_angle:   tiltAngle,
      is_moving:    isMoving || status === 'DRIVING',
      altitude:     altitude,
      pressure:     parseFloat((1013.25 - (altitude * 0.12)).toFixed(1)),
      temperature:  parseFloat(randomAround(NORMAL_RANGES.temperature.base, NORMAL_RANGES.temperature.variance).toFixed(1)),
      latitude:     lat,
      longitude:    lng,
      speed:        speed,
      gps_valid:    true,
      satellites:   Math.floor(randomInRange(6, 12)),
      timestamp:    new Date().toISOString(),
      device_ms:    Date.now(),
    };

    currentRef.current = newData;
    return newData;
  }, []);

  // Start simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      const frame = generateFrame();
      setData({ ...frame });
    }, updateIntervalMs);

    return () => clearInterval(interval);
  }, [generateFrame, updateIntervalMs]);

  // Trigger an emergency event
  const triggerEvent = useCallback((emergencyType) => {
    statusRef.current = emergencyType;

    const newEvent = {
      id:        Date.now().toString(),
      type:      emergencyType,
      message:   getEventMessage(emergencyType),
      timestamp: new Date().toISOString(),
      severity:  emergencyType === 'SAFE' ? 'info' : 'danger',
    };

    setEvents(prev => [newEvent, ...prev].slice(0, 50));
  }, []);

  // Reset to safe
  const resetToSafe = useCallback(() => {
    statusRef.current = 'SAFE';
    const newEvent = {
      id:        Date.now().toString(),
      type:      'SYSTEM',
      message:   'Emergency cleared – Worker status reset to SAFE',
      timestamp: new Date().toISOString(),
      severity:  'safe',
    };
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
  }, []);

  return { data, events, triggerEvent, resetToSafe };
}

function getEventMessage(type) {
  switch (type) {
    case 'FALL_DETECTED':
      return 'Fall detected – Impact followed by inactivity';
    case 'FALL_FROM_HEIGHT':
      return 'Fall from height – Altitude drop + impact + inactivity';
    case 'WORKER_COLLAPSE':
      return 'Worker collapse – Abnormal posture + vitals detected';
    case 'MEDICAL_EMERGENCY':
      return 'Medical emergency – Critical heart rate / SpO₂ levels';
    case 'DRIVING':
      return 'Activity update – Started driving vehicle';
    case 'VEHICLE_CRASH':
      return '🚨 Vehicle crash detected – High G-force impact + sudden deceleration';
    default:
      return 'Status update';
  }
}

export default useSimulator;
