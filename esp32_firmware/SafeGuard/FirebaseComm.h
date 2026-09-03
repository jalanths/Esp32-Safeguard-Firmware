/*
 * FirebaseComm.h
 * SafeGuard: IoT-Based Smart Wearable System
 * ──────────────────────────────────────────
 * Firebase Realtime Database communication module.
 */

#ifndef FIREBASE_COMM_H
#define FIREBASE_COMM_H

#include "EdgeProcessing.h"
#include "Sensors.h"
#include <Arduino.h>

// ── Configuration ───────────────────────────────────────────────
// ⚠️ REPLACE THESE WITH YOUR OWN CREDENTIALS BEFORE FLASHING
// ─────────────────────────────────────────────────────────────────

#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASSWORD "YOUR_PASSWORD"

#define FIREBASE_HOST                                                          \
  "safeguardenvpro-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "3SX1ktJEqULNCYAiATeiV4JhHFuW2lZ8NXK8W2ko"

// Worker identification
#define WORKER_ID "WRK-001"
#define WORKER_NAME "Worker 1"

// ── Function prototypes ─────────────────────────────────────────

bool connectWiFi();
bool isWiFiConnected();
void initFirebase();

// Send periodic status update (heartbeat)
bool sendStatusUpdate(const SensorPayload &payload, EmergencyType status);

// Send emergency alert with full context
bool sendEmergencyAlert(const SensorPayload &payload, EmergencyType emergency);

// Send log entry to event history
bool logEvent(const char *eventType, const char *message);

#endif // FIREBASE_COMM_H
