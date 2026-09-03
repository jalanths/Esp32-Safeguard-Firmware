/*
 * EdgeProcessing.cpp
 * SafeGuard: IoT-Based Smart Wearable System
 * ──────────────────────────────────────────
 * Sensor fusion engine implementing a state-machine approach
 * for multi-sensor accident detection at the edge.
 */

#include "EdgeProcessing.h"
#include <math.h>

// ── Internal state ──────────────────────────────────────────────

static EdgeState state;

// ── Initialization ──────────────────────────────────────────────

void initEdgeProcessor() {
  memset(&state, 0, sizeof(EdgeState));
  state.currentEmergency  = SAFE;
  state.emergencyConfirmed = false;
  state.previousAltitude   = 0.0;
  Serial.println("[EDGE] Edge processor initialized");
}

EdgeState getEdgeState() {
  return state;
}

void resetEmergency() {
  state.currentEmergency  = SAFE;
  state.emergencyConfirmed = false;
  state.freeFallDetected   = false;
  state.impactDetected     = false;
  state.altitudeDropDetected = false;
  state.abnormalVitals     = false;
  state.abnormalTilt       = false;
  Serial.println("[EDGE] Emergency state reset to SAFE");
}

const char* emergencyTypeToString(EmergencyType type) {
  switch (type) {
    case SAFE:              return "SAFE";
    case FALL_DETECTED:     return "FALL_DETECTED";
    case FALL_FROM_HEIGHT:  return "FALL_FROM_HEIGHT";
    case WORKER_COLLAPSE:   return "WORKER_COLLAPSE";
    case MEDICAL_EMERGENCY: return "MEDICAL_EMERGENCY";
    default:                return "UNKNOWN";
  }
}

// ── Internal helper functions ───────────────────────────────────

static bool isFreeFall(const MPU6050Data &mpu) {
  return (mpu.totalAccel < FREE_FALL_THRESHOLD_G);
}

static bool isImpact(const MPU6050Data &mpu) {
  return (mpu.totalAccel > IMPACT_THRESHOLD_G);
}

static bool isInactive(const MPU6050Data &mpu) {
  // Check if acceleration is close to 1g (just gravity, no movement)
  float deviation = fabs(mpu.totalAccel - 1.0);
  return (deviation < INACTIVITY_THRESHOLD_G);
}

static bool isAbnormalTilt(const MPU6050Data &mpu) {
  return (mpu.tiltAngle > TILT_ABNORMAL_DEGREES);
}

static bool isAbnormalHeartRate(const MAX30100Data &pulse) {
  if (!pulse.validReading) return false;
  return (pulse.heartRate < HR_LOW_THRESHOLD || 
          pulse.heartRate > HR_HIGH_THRESHOLD);
}

static bool isLowSpO2(const MAX30100Data &pulse) {
  if (!pulse.validReading) return false;
  return (pulse.spO2 < SPO2_LOW_THRESHOLD);
}

static bool isAltitudeDropping(float currentAlt, float previousAlt) {
  return ((previousAlt - currentAlt) > ALTITUDE_DROP_THRESHOLD_M);
}

// ── Main processing function ────────────────────────────────────

EmergencyType processFrame(const SensorPayload &payload) {
  unsigned long now = payload.readTimestamp;

  // If an emergency is already confirmed, keep returning it
  // until explicitly reset (supervisor acknowledges on dashboard)
  if (state.emergencyConfirmed) {
    return state.currentEmergency;
  }

  // ────────────────────────────────────────────────────────────
  // STEP 1: Detect free-fall phase
  // ────────────────────────────────────────────────────────────
  if (isFreeFall(payload.mpu)) {
    if (!state.freeFallDetected) {
      state.freeFallDetected = true;
      state.freeFallTime     = now;
      Serial.println("[EDGE] >>> Free-fall detected!");
    }
  }

  // ────────────────────────────────────────────────────────────
  // STEP 2: Detect impact after free-fall
  // ────────────────────────────────────────────────────────────
  if (isImpact(payload.mpu)) {
    state.impactDetected = true;
    state.impactTime     = now;
    Serial.print("[EDGE] >>> Impact detected! Accel = ");
    Serial.print(payload.mpu.totalAccel);
    Serial.println(" g");
  }

  // ────────────────────────────────────────────────────────────
  // STEP 3: Track altitude changes
  // ────────────────────────────────────────────────────────────
  if (now - state.lastAltitudeCheck > ALTITUDE_CHECK_INTERVAL) {
    if (state.previousAltitude > 0.01) {
      state.altitudeDrop = state.previousAltitude - payload.bmp.altitude;
      if (isAltitudeDropping(payload.bmp.altitude, state.previousAltitude)) {
        state.altitudeDropDetected = true;
        Serial.print("[EDGE] >>> Altitude drop: ");
        Serial.print(state.altitudeDrop);
        Serial.println(" m");
      }
    }
    state.previousAltitude  = payload.bmp.altitude;
    state.lastAltitudeCheck = now;
  }

  // ────────────────────────────────────────────────────────────
  // STEP 4: Track inactivity
  // ────────────────────────────────────────────────────────────
  if (isInactive(payload.mpu)) {
    if (!state.inactive) {
      state.inactive        = true;
      state.inactivityStart = now;
    }
  } else {
    state.inactive = false;
    // If there was movement and no emergency confirmed, reset fall states
    if (!state.emergencyConfirmed && 
        (now - state.impactTime > FREE_FALL_WINDOW_MS)) {
      state.freeFallDetected   = false;
      state.impactDetected     = false;
      state.altitudeDropDetected = false;
    }
  }

  // ────────────────────────────────────────────────────────────
  // STEP 5: Track abnormal tilt
  // ────────────────────────────────────────────────────────────
  state.abnormalTilt = isAbnormalTilt(payload.mpu);

  // ────────────────────────────────────────────────────────────
  // STEP 6: Track abnormal vitals
  // ────────────────────────────────────────────────────────────
  bool vitalsAbnormal = isAbnormalHeartRate(payload.pulse) || 
                        isLowSpO2(payload.pulse);

  if (vitalsAbnormal) {
    if (!state.abnormalVitals) {
      state.abnormalVitals      = true;
      state.abnormalVitalsStart = now;
    }
  } else {
    state.abnormalVitals = false;
  }

  // ────────────────────────────────────────────────────────────
  // DECISION ENGINE: Sensor Fusion Rules
  // ────────────────────────────────────────────────────────────

  unsigned long inactiveDuration = state.inactive ? 
                                   (now - state.inactivityStart) : 0;
  unsigned long abnormalVitalsDuration = state.abnormalVitals ? 
                                         (now - state.abnormalVitalsStart) : 0;

  // ── Rule 1: FALL FROM HEIGHT ──────────────────────────────
  // Free-fall + altitude drop + impact + prolonged inactivity
  if (state.freeFallDetected && 
      state.altitudeDropDetected && 
      state.impactDetected && 
      state.inactive && 
      inactiveDuration >= INACTIVITY_DURATION_MS) {

    state.currentEmergency  = FALL_FROM_HEIGHT;
    state.emergencyConfirmed = true;
    state.emergencyTime      = now;
    Serial.println("[EDGE] *** EMERGENCY: FALL FROM HEIGHT ***");
    return state.currentEmergency;
  }

  // ── Rule 2: FALL (ground level) ───────────────────────────
  // Free-fall + impact + prolonged inactivity (no altitude drop)
  if (state.freeFallDetected && 
      state.impactDetected && 
      state.inactive && 
      inactiveDuration >= INACTIVITY_DURATION_MS &&
      !state.altitudeDropDetected) {

    state.currentEmergency  = FALL_DETECTED;
    state.emergencyConfirmed = true;
    state.emergencyTime      = now;
    Serial.println("[EDGE] *** EMERGENCY: FALL DETECTED ***");
    return state.currentEmergency;
  }

  // ── Rule 3: WORKER COLLAPSE ───────────────────────────────
  // Abnormal tilt + inactivity + abnormal heart rate
  if (state.abnormalTilt && 
      state.inactive && 
      inactiveDuration >= INACTIVITY_DURATION_MS &&
      state.abnormalVitals) {

    state.currentEmergency  = WORKER_COLLAPSE;
    state.emergencyConfirmed = true;
    state.emergencyTime      = now;
    Serial.println("[EDGE] *** EMERGENCY: WORKER COLLAPSE ***");
    return state.currentEmergency;
  }

  // ── Rule 4: MEDICAL EMERGENCY ─────────────────────────────
  // Abnormal HR/SpO2 while stationary for extended period
  if (state.abnormalVitals && 
      state.inactive &&
      abnormalVitalsDuration >= MEDICAL_STATIONARY_MS) {

    state.currentEmergency  = MEDICAL_EMERGENCY;
    state.emergencyConfirmed = true;
    state.emergencyTime      = now;
    Serial.println("[EDGE] *** EMERGENCY: MEDICAL EMERGENCY ***");
    return state.currentEmergency;
  }

  // ── No emergency ─────────────────────────────────────────
  state.currentEmergency = SAFE;
  return SAFE;
}
