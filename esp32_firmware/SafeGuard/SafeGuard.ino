/*
 * SafeGuard.ino
 * ══════════════════════════════════════════════════════════════════
 *  SafeGuard: IoT-Based Smart Wearable System for Real-Time
 *  Industrial Worker Safety Monitoring and Emergency Response
 * ══════════════════════════════════════════════════════════════════
 *
 * Hardware:
 *   - ESP32-WROOM-32 (Edge MCU)
 *   - MPU6050        (Accelerometer / Gyroscope)
 *   - BMP280         (Barometric Pressure / Altitude)
 *   - MAX30100       (Pulse Oximeter / Heart Rate)
 *   - NEO-6M GPS     (Location)
 *
 * Architecture:
 *   Perception → Edge Processing → WiFi → Firebase Cloud → Dashboard
 *
 * Author : SafeGuard IoT Team
 * Date   : 2026
 */

#include <Wire.h>
#include "Sensors.h"
#include "EdgeProcessing.h"
#include "FirebaseComm.h"

// ── Timing configuration ────────────────────────────────────────

#define SENSOR_READ_INTERVAL_MS    100    // Read sensors at ~10 Hz
#define STATUS_SEND_INTERVAL_MS    3000   // Send status every 3 sec
#define MAX30100_UPDATE_INTERVAL   10     // MAX30100 needs very frequent updates
#define SERIAL_BAUD                115200

// ── State variables ─────────────────────────────────────────────

unsigned long lastSensorRead   = 0;
unsigned long lastStatusSend   = 0;
unsigned long lastPoxUpdate    = 0;
bool          sensorsOk        = false;
bool          emergencySent    = false;

// ── Status LED (built-in) ───────────────────────────────────────
#define LED_PIN 2  // ESP32 built-in LED

void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
  }
}

// ══════════════════════════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1000);

  Serial.println();
  Serial.println("╔══════════════════════════════════════════╗");
  Serial.println("║       SafeGuard IoT Wearable System      ║");
  Serial.println("║  Industrial Worker Safety Monitoring      ║");
  Serial.println("╚══════════════════════════════════════════╝");
  Serial.println();

  // LED setup
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize I2C bus
  Wire.begin();

  // ── Initialize sensors ──────────────────────────────────────
  Serial.println("[INIT] Initializing sensors...");
  
  bool mpuOk  = initMPU6050();
  bool bmpOk  = initBMP280();
  bool poxOk  = initMAX30100();
  initGPS();

  sensorsOk = mpuOk && bmpOk && poxOk;

  if (sensorsOk) {
    Serial.println("[INIT] All sensors initialized successfully ✓");
    blinkLED(3, 200);  // 3 quick blinks = success
  } else {
    Serial.println("[INIT] ⚠ Some sensors failed! Check wiring.");
    if (!mpuOk)  Serial.println("  ✗ MPU6050 FAILED");
    if (!bmpOk)  Serial.println("  ✗ BMP280 FAILED");
    if (!poxOk)  Serial.println("  ✗ MAX30100 FAILED");
    blinkLED(10, 100);  // Rapid blinks = error
  }

  // Calibrate BMP280 baseline altitude
  if (bmpOk) {
    Serial.println("[INIT] Calibrating altitude baseline...");
    calibrateBMP280Baseline();
  }

  // ── Initialize edge processor ───────────────────────────────
  initEdgeProcessor();

  // ── Connect WiFi ────────────────────────────────────────────
  Serial.println("[INIT] Connecting to WiFi...");
  if (connectWiFi()) {
    blinkLED(2, 300);
    
    // Initialize Firebase
    Serial.println("[INIT] Initializing Firebase...");
    initFirebase();
    
    // Log boot event
    logEvent("SYSTEM", "SafeGuard device booted and connected");
  } else {
    Serial.println("[INIT] ⚠ WiFi failed – device will run offline");
    Serial.println("[INIT]   Sensor fusion will still work locally");
    blinkLED(5, 500);
  }

  Serial.println();
  Serial.println("[INIT] ═══ Setup complete. Entering main loop ═══");
  Serial.println();
}

// ══════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════════════════

void loop() {
  unsigned long now = millis();

  // ── Continuously update pulse oximeter (critical for accuracy) ─
  if (now - lastPoxUpdate >= MAX30100_UPDATE_INTERVAL) {
    readMAX30100();  // Keeps the MAX30100 internal buffer fresh
    lastPoxUpdate = now;
  }

  // ── Read all sensors at defined interval ──────────────────────
  if (now - lastSensorRead >= SENSOR_READ_INTERVAL_MS) {
    lastSensorRead = now;

    SensorPayload payload = readAllSensors();

    // ── Run edge processing / sensor fusion ───────────────────
    EmergencyType result = processFrame(payload);

    // ── Handle emergency detection ────────────────────────────
    if (result != SAFE && !emergencySent) {
      // EMERGENCY DETECTED!
      Serial.println();
      Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      Serial.print("!! EMERGENCY: ");
      Serial.println(emergencyTypeToString(result));
      Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      Serial.println();

      // Rapid LED flash for emergency
      digitalWrite(LED_PIN, HIGH);

      // Print detailed information
      Serial.println("─── Emergency Details ───");
      Serial.print("  Worker:    "); Serial.println(WORKER_ID);
      Serial.print("  Type:      "); Serial.println(emergencyTypeToString(result));
      Serial.print("  Heart Rate: "); Serial.print(payload.pulse.heartRate);
      Serial.println(" BPM");
      Serial.print("  SpO2:      "); Serial.print(payload.pulse.spO2);
      Serial.println(" %");
      Serial.print("  Altitude:  "); Serial.print(payload.bmp.altitude);
      Serial.println(" m");
      Serial.print("  Accel:     "); Serial.print(payload.mpu.totalAccel);
      Serial.println(" g");
      Serial.print("  Tilt:      "); Serial.print(payload.mpu.tiltAngle);
      Serial.println(" °");
      if (payload.gps.validFix) {
        Serial.print("  Location:  ");
        Serial.print(payload.gps.latitude, 6);
        Serial.print(", ");
        Serial.println(payload.gps.longitude, 6);
      } else {
        Serial.println("  Location:  GPS fix not available");
      }
      Serial.println("─────────────────────────");

      // Send emergency alert to Firebase
      if (isWiFiConnected()) {
        sendEmergencyAlert(payload, result);
        logEvent("EMERGENCY", emergencyTypeToString(result));
      }

      emergencySent = true;
    }

    // ── If emergency was reset (e.g., via dashboard), allow re-detection ─
    if (result == SAFE && emergencySent) {
      emergencySent = false;
      digitalWrite(LED_PIN, LOW);
    }

    // ── Send periodic status update ─────────────────────────────
    if (now - lastStatusSend >= STATUS_SEND_INTERVAL_MS) {
      lastStatusSend = now;

      if (isWiFiConnected()) {
        sendStatusUpdate(payload, result);
      }

      // Print periodic status to Serial
      Serial.print("[STATUS] Accel=");
      Serial.print(payload.mpu.totalAccel, 2);
      Serial.print("g | Tilt=");
      Serial.print(payload.mpu.tiltAngle, 1);
      Serial.print("° | Alt=");
      Serial.print(payload.bmp.altitude, 1);
      Serial.print("m | HR=");
      Serial.print(payload.pulse.heartRate, 0);
      Serial.print("bpm | SpO2=");
      Serial.print(payload.pulse.spO2, 0);
      Serial.print("% | GPS=");
      Serial.print(payload.gps.validFix ? "OK" : "NO");
      Serial.print(" | Status=");
      Serial.println(emergencyTypeToString(result));
    }
  }

  // ── WiFi reconnection check ───────────────────────────────────
  if (!isWiFiConnected()) {
    static unsigned long lastReconnect = 0;
    if (now - lastReconnect > 30000) {  // Try every 30 sec
      Serial.println("[WIFI] Connection lost. Attempting reconnect...");
      connectWiFi();
      if (isWiFiConnected()) {
        initFirebase();
      }
      lastReconnect = now;
    }
  }
}
