#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_MPU6050.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

Adafruit_MPU6050 mpu;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);  // ESP32 Serial2 (RX=16, TX=17)

WebServer server(80);

bool mpuOk = false;

// Latest sensor values
float curAccX = 0, curAccY = 0, curAccZ = 1.0;
float curTotalAcc = 1.0;
float curTiltAngle = 0.0;
float curTemp = 25.0; // Default temp
float curPressure = 1013.25; // Default pressure
float curAltitude = 0.0; // Overwritten by GPS later if available
unsigned long lastSensorPrint = 0;

void handleApiData() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  String status = "SAFE";
  bool isEmergency = false;
  
  if (curTiltAngle > 65.0) {
    status = "FALL_DETECTED";
    isEmergency = true;
  }

  String json = "{";
  json += "\"worker_id\":\"ESP32-JALANTH\",";
  json += "\"worker_name\":\"Jalanth ESP32 Node\",";
  json += "\"status\":\"" + status + "\",";
  json += "\"is_emergency\":" + String(isEmergency ? "true" : "false") + ",";
  json += "\"heart_rate\":0,"; // Dummy value for dashboard
  json += "\"spo2\":0,";       // Dummy value for dashboard
  json += "\"vitals_valid\":false,"; // No heart rate sensor attached
  json += "\"accel_total\":" + String(curTotalAcc, 2) + ",";
  json += "\"tilt_angle\":" + String(curTiltAngle, 1) + ",";
  json += "\"is_moving\":" + String((abs(curTotalAcc - 1.0) > 0.15) ? "true" : "false") + ",";
  
  // Use GPS altitude if valid, else default
  if (gps.altitude.isValid()) {
    json += "\"altitude\":" + String(gps.altitude.meters(), 1) + ",";
  } else {
    json += "\"altitude\":" + String(curAltitude, 1) + ",";
  }
  
  json += "\"pressure\":" + String(curPressure, 2) + ",";
  json += "\"temperature\":" + String(curTemp, 1) + ",";
  
  if (gps.location.isValid()) {
    json += "\"latitude\":" + String(gps.location.lat(), 6) + ",";
    json += "\"longitude\":" + String(gps.location.lng(), 6) + ",";
    json += "\"gps_valid\":true,";
  } else {
    json += "\"latitude\":17.385044,"; // Default fallback
    json += "\"longitude\":78.486671,"; // Default fallback
    json += "\"gps_valid\":false,";
  }
  
  if (gps.satellites.isValid()) {
    json += "\"satellites\":" + String(gps.satellites.value());
  } else {
    json += "\"satellites\":0";
  }
  
  json += "}";

  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin();

  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());

  Serial.println("Starting sensor setup...");

  // MPU6050
  if (mpu.begin()) {
    mpuOk = true;
    Serial.println("MPU6050: OK");
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  } else {
    Serial.println("MPU6050: NOT FOUND");
  }

  // GPS
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);  // RX=16, TX=17
  Serial.println("GPS: serial started");

  // Setup HTTP WebServer
  server.on("/api/data", HTTP_GET, handleApiData);
  server.onNotFound([]() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/plain", "SafeGuard ESP32 Active. Poll /api/data for live JSON.");
  });
  server.begin();
  Serial.println("HTTP server started on port 80!");
}

void loop() {
  server.handleClient();

  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  unsigned long now = millis();
  if (now - lastSensorPrint >= 1000) {
    lastSensorPrint = now;

    Serial.println("-----");
    if (mpuOk) {
      sensors_event_t a, g, temp;
      mpu.getEvent(&a, &g, &temp);
      curAccX = a.acceleration.x;
      curAccY = a.acceleration.y;
      curAccZ = a.acceleration.z;
      curTemp = temp.temperature; // use MPU temp for the dashboard
      
      // Calculate acceleration in g units and tilt angle
      float mag = sqrt(curAccX * curAccX + curAccY * curAccY + curAccZ * curAccZ);
      curTotalAcc = mag / 9.80665;
      float zNorm = constrain(curAccZ / mag, -1.0, 1.0);
      curTiltAngle = acos(zNorm) * (180.0 / PI);
      if (isnan(curTiltAngle)) curTiltAngle = 0;

      Serial.print("MPU6050 -> Accel: ");
      Serial.print(curTotalAcc);
      Serial.print("g | Tilt: ");
      Serial.println(curTiltAngle);
    }

    if (gps.location.isValid()) {
      Serial.print("GPS -> Lat: ");
      Serial.print(gps.location.lat(), 6);
      Serial.print(" | Lng: ");
      Serial.print(gps.location.lng(), 6);
      Serial.print(" | Sats: ");
      Serial.println(gps.satellites.value());
    } else {
      Serial.println("GPS -> waiting for fix...");
    }
  }
}
