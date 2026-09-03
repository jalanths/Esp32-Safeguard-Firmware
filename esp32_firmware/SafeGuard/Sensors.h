/*
 * Sensors.h
 * SafeGuard: IoT-Based Smart Wearable System
 * ──────────────────────────────────────────
 * Declarations for sensor initialization and data reading.
 * Sensors: MPU6050, BMP280, MAX30100, NEO-6M GPS
 */

#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>

// ── Sensor data structures ──────────────────────────────────────

struct MPU6050Data {
  float accelX, accelY, accelZ;   // Acceleration in g
  float gyroX, gyroY, gyroZ;     // Angular velocity in deg/s
  float totalAccel;               // Magnitude of acceleration vector
  float tiltAngle;                // Tilt angle from vertical (degrees)
};

struct BMP280Data {
  float temperature;   // °C
  float pressure;      // hPa
  float altitude;      // meters (calculated from pressure)
};

struct MAX30100Data {
  float heartRate;     // BPM
  float spO2;          // Percentage
  bool  validReading;  // Whether the sensor has a finger detected
};

struct GPSData {
  double latitude;
  double longitude;
  float  speed;        // km/h
  int    satellites;
  bool   validFix;
  String timestamp;    // UTC time string
};

// Combined sensor payload
struct SensorPayload {
  MPU6050Data  mpu;
  BMP280Data   bmp;
  MAX30100Data pulse;
  GPSData      gps;
  unsigned long readTimestamp;
};

// ── Function prototypes ─────────────────────────────────────────

bool initMPU6050();
bool initBMP280();
bool initMAX30100();
void initGPS();

MPU6050Data  readMPU6050();
BMP280Data   readBMP280();
MAX30100Data readMAX30100();
GPSData      readGPS();
SensorPayload readAllSensors();

// Calibration helpers
void calibrateBMP280Baseline();
float getBaselineAltitude();

#endif // SENSORS_H
