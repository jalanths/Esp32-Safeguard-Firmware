/*
 * EdgeProcessing.h
 * SafeGuard: IoT-Based Smart Wearable System
 * ──────────────────────────────────────────
 * Edge-level sensor fusion and accident detection logic.
 *
 * Detects:
 *  1. FALL          – Free-fall → impact → inactivity
 *  2. FALL_HEIGHT   – Free-fall + altitude drop → impact → inactivity
 *  3. COLLAPSE      – Abnormal tilt + inactivity + abnormal HR
 *  4. MEDICAL       – Abnormal HR/SpO2 while stationary
 */

#ifndef EDGE_PROCESSING_H
#define EDGE_PROCESSING_H

#include <Arduino.h>
#include "Sensors.h"

// ── Emergency type enumeration ──────────────────────────────────

enum EmergencyType {
  SAFE            = 0,
  FALL_DETECTED   = 1,
  FALL_FROM_HEIGHT = 2,
  WORKER_COLLAPSE = 3,
  MEDICAL_EMERGENCY = 4
};

// ── Thresholds (tunable) ────────────────────────────────────────

// MPU6050 thresholds
#define FREE_FALL_THRESHOLD_G     0.4    // Below this = free-fall (g)
#define IMPACT_THRESHOLD_G        3.0    // Above this = impact (g)
#define INACTIVITY_THRESHOLD_G    0.15   // Deviation from 1g for stillness
#define TILT_ABNORMAL_DEGREES     60.0   // Tilt beyond this = abnormal posture

// BMP280 thresholds
#define ALTITUDE_DROP_THRESHOLD_M 1.5    // Rapid altitude drop (meters)

// MAX30100 thresholds
#define HR_LOW_THRESHOLD          40.0   // BPM below = bradycardia
#define HR_HIGH_THRESHOLD         150.0  // BPM above = tachycardia
#define SPO2_LOW_THRESHOLD        90.0   // SpO2% below = hypoxia

// Timing thresholds (milliseconds)
#define INACTIVITY_DURATION_MS    5000   // 5 sec inactivity after event
#define MEDICAL_STATIONARY_MS     10000  // 10 sec of abnormal vitals
#define FREE_FALL_WINDOW_MS       2000   // Window to detect impact after free-fall
#define ALTITUDE_CHECK_INTERVAL   1000   // Check altitude every 1 sec

// ── State machine ───────────────────────────────────────────────

struct EdgeState {
  // Free-fall detection
  bool     freeFallDetected;
  unsigned long freeFallTime;

  // Impact detection
  bool     impactDetected;
  unsigned long impactTime;

  // Inactivity tracking
  bool     inactive;
  unsigned long inactivityStart;

  // Altitude tracking
  float    previousAltitude;
  float    altitudeDrop;
  unsigned long lastAltitudeCheck;
  bool     altitudeDropDetected;

  // Medical condition tracking
  bool     abnormalVitals;
  unsigned long abnormalVitalsStart;

  // Tilt tracking
  bool     abnormalTilt;

  // Current confirmed emergency
  EmergencyType currentEmergency;
  bool          emergencyConfirmed;
  unsigned long emergencyTime;
};

// ── Function prototypes ─────────────────────────────────────────

void          initEdgeProcessor();
EdgeState     getEdgeState();
EmergencyType processFrame(const SensorPayload &payload);
const char*   emergencyTypeToString(EmergencyType type);
void          resetEmergency();

#endif // EDGE_PROCESSING_H
