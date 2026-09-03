/*
 * Sensors.cpp
 * SafeGuard: IoT-Based Smart Wearable System
 * ──────────────────────────────────────────
 * Sensor initialization and data reading implementations.
 */

#include "Sensors.h"
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <MAX30100_PulseOximeter.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <math.h>

// ── Sensor objects ──────────────────────────────────────────────

static Adafruit_MPU6050 mpu;
static Adafruit_BMP280  bmp;
static PulseOximeter    pox;
static TinyGPSPlus      gps;
static HardwareSerial   gpsSerial(1);  // UART1 on ESP32

// ── Configuration ───────────────────────────────────────────────

#define GPS_RX_PIN    16
#define GPS_TX_PIN    17
#define GPS_BAUD      9600

#define SEA_LEVEL_HPA 1013.25

static float baselineAltitude = 0.0;

// ── Pulse oximeter callback (required by MAX30100 library) ──────

static void onBeatDetected() {
  // Optional: can toggle an LED or set a flag
}

// ── MPU6050 ─────────────────────────────────────────────────────

bool initMPU6050() {
  if (!mpu.begin()) {
    Serial.println("[SENSOR] MPU6050 initialization FAILED");
    return false;
  }
  // Configure ranges
  mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("[SENSOR] MPU6050 initialized OK");
  return true;
}

MPU6050Data readMPU6050() {
  MPU6050Data data;
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Convert from m/s² to g (divide by 9.81)
  data.accelX = a.acceleration.x / 9.81;
  data.accelY = a.acceleration.y / 9.81;
  data.accelZ = a.acceleration.z / 9.81;

  data.gyroX = g.gyro.x * 57.2958;  // rad/s to deg/s
  data.gyroY = g.gyro.y * 57.2958;
  data.gyroZ = g.gyro.z * 57.2958;

  // Total acceleration magnitude
  data.totalAccel = sqrt(data.accelX * data.accelX +
                         data.accelY * data.accelY +
                         data.accelZ * data.accelZ);

  // Tilt angle from vertical (acos of Z component / magnitude)
  if (data.totalAccel > 0.01) {
    data.tiltAngle = acos(data.accelZ / data.totalAccel) * 57.2958;
  } else {
    data.tiltAngle = 90.0;  // Free-fall → treat as horizontal
  }

  return data;
}

// ── BMP280 ──────────────────────────────────────────────────────

bool initBMP280() {
  if (!bmp.begin(0x76)) {
    // Try alternate I2C address
    if (!bmp.begin(0x77)) {
      Serial.println("[SENSOR] BMP280 initialization FAILED");
      return false;
    }
  }
  // Default oversampling settings
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                  Adafruit_BMP280::SAMPLING_X2,   // temperature
                  Adafruit_BMP280::SAMPLING_X16,  // pressure
                  Adafruit_BMP280::FILTER_X16,
                  Adafruit_BMP280::STANDBY_MS_500);
  Serial.println("[SENSOR] BMP280 initialized OK");
  return true;
}

BMP280Data readBMP280() {
  BMP280Data data;
  data.temperature = bmp.readTemperature();
  data.pressure    = bmp.readPressure() / 100.0;  // Pa to hPa
  data.altitude    = bmp.readAltitude(SEA_LEVEL_HPA);
  return data;
}

void calibrateBMP280Baseline() {
  // Average 10 readings for a stable baseline
  float sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += bmp.readAltitude(SEA_LEVEL_HPA);
    delay(100);
  }
  baselineAltitude = sum / 10.0;
  Serial.print("[SENSOR] BMP280 baseline altitude: ");
  Serial.print(baselineAltitude);
  Serial.println(" m");
}

float getBaselineAltitude() {
  return baselineAltitude;
}

// ── MAX30100 ────────────────────────────────────────────────────

bool initMAX30100() {
  if (!pox.begin()) {
    Serial.println("[SENSOR] MAX30100 initialization FAILED");
    return false;
  }
  pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);
  pox.setOnBeatDetectedCallback(onBeatDetected);
  Serial.println("[SENSOR] MAX30100 initialized OK");
  return true;
}

MAX30100Data readMAX30100() {
  MAX30100Data data;

  // The MAX30100 library needs frequent updates
  pox.update();

  data.heartRate    = pox.getHeartRate();
  data.spO2         = pox.getSpO2();
  data.validReading = (data.heartRate > 0 && data.spO2 > 0);

  return data;
}

// ── NEO-6M GPS ──────────────────────────────────────────────────

void initGPS() {
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[SENSOR] NEO-6M GPS serial initialized on UART1");
}

GPSData readGPS() {
  GPSData data;
  data.validFix   = false;
  data.latitude    = 0.0;
  data.longitude   = 0.0;
  data.speed       = 0.0;
  data.satellites  = 0;
  data.timestamp   = "N/A";

  // Feed characters from GPS serial
  unsigned long start = millis();
  while (millis() - start < 200) {  // 200 ms window
    while (gpsSerial.available() > 0) {
      gps.encode(gpsSerial.read());
    }
  }

  if (gps.location.isValid()) {
    data.validFix  = true;
    data.latitude  = gps.location.lat();
    data.longitude = gps.location.lng();
  }

  if (gps.speed.isValid()) {
    data.speed = gps.speed.kmph();
  }

  data.satellites = gps.satellites.value();

  if (gps.time.isValid() && gps.date.isValid()) {
    char buf[25];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
    data.timestamp = String(buf);
  }

  return data;
}

// ── Combined reading ────────────────────────────────────────────

SensorPayload readAllSensors() {
  SensorPayload payload;
  payload.mpu           = readMPU6050();
  payload.bmp           = readBMP280();
  payload.pulse         = readMAX30100();
  payload.gps           = readGPS();
  payload.readTimestamp  = millis();
  return payload;
}
