/*
 * FirebaseComm.cpp
 * SafeGuard: IoT-Based Smart Wearable System
 * ──────────────────────────────────────────
 * WiFi and Firebase Realtime Database communication.
 * Uses Firebase ESP32 Client library for real-time data push.
 */

#include "FirebaseComm.h"
#include <WiFi.h>
#include <FirebaseESP32.h>

// ── Firebase objects ────────────────────────────────────────────

static FirebaseData   fbData;
static FirebaseAuth   fbAuth;
static FirebaseConfig fbConfig;

static bool firebaseReady = false;

// ── WiFi connection ─────────────────────────────────────────────

bool connectWiFi() {
  Serial.print("[WIFI] Connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setAutoReconnect(true);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("[WIFI] Connected! IP: ");
    Serial.println(WiFi.localIP());
    return true;
  } else {
    Serial.println();
    Serial.println("[WIFI] Connection FAILED");
    return false;
  }
}

bool isWiFiConnected() {
  return (WiFi.status() == WL_CONNECTED);
}

// ── Firebase initialization ─────────────────────────────────────

void initFirebase() {
  fbConfig.database_url = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;

  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  // Set read/write timeout
  fbData.setBSSLBufferSize(1024, 1024);

  firebaseReady = true;
  Serial.println("[FIREBASE] Initialized and ready");
}

// ── Helper: Build JSON payload ──────────────────────────────────

static FirebaseJson buildPayloadJson(const SensorPayload &payload, 
                                      EmergencyType status) {
  FirebaseJson json;

  // Worker identification
  json.set("worker_id",   WORKER_ID);
  json.set("worker_name", WORKER_NAME);

  // Status
  json.set("status", emergencyTypeToString(status));
  json.set("is_emergency", (status != SAFE));

  // Vitals
  json.set("heart_rate", payload.pulse.heartRate);
  json.set("spo2",       payload.pulse.spO2);
  json.set("vitals_valid", payload.pulse.validReading);

  // Motion
  json.set("accel_total", payload.mpu.totalAccel);
  json.set("tilt_angle",  payload.mpu.tiltAngle);
  json.set("is_moving",   (fabs(payload.mpu.totalAccel - 1.0) > 0.15));

  // Environment
  json.set("altitude",    payload.bmp.altitude);
  json.set("pressure",    payload.bmp.pressure);
  json.set("temperature", payload.bmp.temperature);

  // Location
  json.set("latitude",    payload.gps.latitude);
  json.set("longitude",   payload.gps.longitude);
  json.set("gps_valid",   payload.gps.validFix);
  json.set("satellites",  payload.gps.satellites);

  // Timestamp
  json.set("timestamp",   payload.gps.timestamp);
  json.set("device_ms",   (int)payload.readTimestamp);

  return json;
}

// ── Send periodic status (overwrites current state) ─────────────

bool sendStatusUpdate(const SensorPayload &payload, EmergencyType status) {
  if (!firebaseReady || !isWiFiConnected()) {
    Serial.println("[FIREBASE] Not ready or WiFi disconnected");
    return false;
  }

  String path = "/workers/" + String(WORKER_ID) + "/current";
  FirebaseJson json = buildPayloadJson(payload, status);

  if (Firebase.setJSON(fbData, path, json)) {
    Serial.println("[FIREBASE] Status update sent");
    return true;
  } else {
    Serial.print("[FIREBASE] Status update FAILED: ");
    Serial.println(fbData.errorReason());
    return false;
  }
}

// ── Send emergency alert (appends to alerts log) ────────────────

bool sendEmergencyAlert(const SensorPayload &payload, EmergencyType emergency) {
  if (!firebaseReady || !isWiFiConnected()) {
    Serial.println("[FIREBASE] Not ready or WiFi disconnected");
    return false;
  }

  // Push to alerts list
  String alertPath = "/alerts";
  FirebaseJson alertJson = buildPayloadJson(payload, emergency);
  alertJson.set("acknowledged", false);

  if (Firebase.pushJSON(fbData, alertPath, alertJson)) {
    Serial.print("[FIREBASE] Emergency alert pushed: ");
    Serial.println(emergencyTypeToString(emergency));
  } else {
    Serial.print("[FIREBASE] Alert push FAILED: ");
    Serial.println(fbData.errorReason());
    return false;
  }

  // Also update current status
  sendStatusUpdate(payload, emergency);

  return true;
}

// ── Log an event ────────────────────────────────────────────────

bool logEvent(const char* eventType, const char* message) {
  if (!firebaseReady || !isWiFiConnected()) return false;

  String path = "/workers/" + String(WORKER_ID) + "/events";
  FirebaseJson json;
  json.set("type",    eventType);
  json.set("message", message);
  json.set("device_ms", (int)millis());

  return Firebase.pushJSON(fbData, path, json);
}
