/*
 * useWebSerial.js – Web Serial API Hook for Direct Arduino ESP32 USB Connection
 * ══════════════════════════════════════════════════════════════════════════════════
 * Directly connects to the ESP32 via USB Serial (115200 baud) and parses the exact
 * output format from the user's calibrated MPU6050 Arduino firmware:
 *   - "MPU[X:<ax> Y:<ay> Z:<az>] | Sats: <n> | Lat: <lat> | Lng: <lng> | Alt: <alt>m"
 *   - "MPU6050 -> Accel: <x> <y> <z>"    (legacy format, still supported)
 *   - "BMP280 -> Temp: <t> C | Pressure: <p> hPa | Altitude: <a> m"
 *   - "MAX30100 -> Heart Rate: <hr> bpm | SpO2: <spo2> %"
 *   - "GPS -> Lat: <lat> | Lng: <lng> | Sats: <sats>"
 *
 * MPU6050 calibration offsets (applied on ESP32 side):
 *   Accel: ax=0.9137  ay=0.1390  az=1.2667  (m/s²)
 *   Gyro:  gx=-0.1111 gy=0.0318  gz=-0.0053 (rad/s)
 */

import { useState, useRef, useCallback } from 'react';

export function useWebSerial(onEventLog) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSupported] = useState(() => 'serial' in navigator);
  const [serialError, setSerialError] = useState(null);

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const keepReadingRef = useRef(false);

  // Parsed live data state
  const [serialData, setSerialData] = useState({
    worker_id:    'ESP32-JALANTH',
    worker_name:  'Jalanth ESP32 Node',
    status:       'SAFE',
    is_emergency: false,
    heart_rate:   0,
    spo2:         0,
    vitals_valid: false,
    accel_total:  1.0,
    tilt_angle:   0.0,
    is_moving:    false,
    ax:           0.0,
    ay:           0.0,
    az:           9.81,
    gx:           0.0,
    gy:           0.0,
    gz:           0.0,
    altitude:     0.0,
    pressure:     1013.25,
    temperature:  25.0,
    latitude:     17.3850,
    longitude:    78.4867,
    gps_valid:    false,
    satellites:   0,
    timestamp:    new Date().toISOString(),
  });

  const parseSerialLine = useCallback((line) => {
    const clean = line.trim();
    if (!clean) return;

    setSerialData((prev) => {
      const next = { ...prev, timestamp: new Date().toISOString() };

      // 1. Parse BMP280 -> Temp: 28.5 C | Pressure: 1012.34 hPa | Altitude: 540.2 m
      if (clean.includes('BMP280 ->')) {
        const tempMatch = clean.match(/Temp:\s*([0-9.-]+)/i);
        const pressMatch = clean.match(/Pressure:\s*([0-9.-]+)/i);
        const altMatch = clean.match(/Altitude:\s*([0-9.-]+)/i);

        if (tempMatch) next.temperature = parseFloat(tempMatch[1]);
        if (pressMatch) next.pressure = parseFloat(pressMatch[1]);
        if (altMatch) next.altitude = parseFloat(altMatch[1]);
      }

      // 2. Parse MAX30100 -> Heart Rate: 76 bpm | SpO2: 98 %
      else if (clean.includes('MAX30100 ->')) {
        const hrMatch = clean.match(/Heart Rate:\s*([0-9.-]+)/i);
        const spo2Match = clean.match(/SpO2:\s*([0-9.-]+)/i);

        if (hrMatch) {
          const hr = parseFloat(hrMatch[1]);
          next.heart_rate = hr;
        }
        if (spo2Match) {
          const spo2 = parseFloat(spo2Match[1]);
          next.spo2 = spo2;
        }
        if (next.heart_rate > 30 && next.spo2 > 60) {
          next.vitals_valid = true;
        }
      }

      // 3a. Parse new calibrated format: MPU[X:<ax> Y:<ay> Z:<az>] | Sats: ...
      else if (clean.startsWith('MPU[')) {
        const xMatch = clean.match(/X:\s*([0-9.-]+)/);
        const yMatch = clean.match(/Y:\s*([0-9.-]+)/);
        const zMatch = clean.match(/Z:\s*([0-9.-]+)/);
        if (xMatch && yMatch && zMatch) {
          const ax = parseFloat(xMatch[1]);
          const ay = parseFloat(yMatch[1]);
          const az = parseFloat(zMatch[1]);
          if (!isNaN(ax) && !isNaN(ay) && !isNaN(az)) {
            next.ax = ax;
            next.ay = ay;
            next.az = az;
            // These values are already calibrated (offsets subtracted on ESP32)
            // and in m/s², so convert to g
            const mag = Math.sqrt(ax * ax + ay * ay + az * az);
            const accelG = mag / 9.80665;
            next.accel_total = Math.round(accelG * 100) / 100;

            const zNorm = Math.min(1.0, Math.max(-1.0, az / mag));
            const tiltDeg = Math.acos(zNorm) * (180 / Math.PI);
            next.tilt_angle = !isNaN(tiltDeg) ? Math.round(tiltDeg * 10) / 10 : 0;
            next.is_moving = Math.abs(accelG - 1.0) > 0.15;
          }
        }
        // Also parse Sats/Lat/Lng/Alt from the same line
        const satsMatch = clean.match(/Sats:\s*([0-9]+)/);
        const latMatch = clean.match(/Lat:\s*([0-9.-]+)/);
        const lngMatch = clean.match(/Lng:\s*([0-9.-]+)/);
        const altMatch = clean.match(/Alt:\s*([0-9.-]+)/);
        if (satsMatch) next.satellites = parseInt(satsMatch[1], 10);
        if (latMatch && lngMatch) {
          const latVal = parseFloat(latMatch[1]);
          const lngVal = parseFloat(lngMatch[1]);
          if (latVal !== 0 || lngVal !== 0) {
            next.latitude = latVal;
            next.longitude = lngVal;
            next.gps_valid = true;
          }
        }
        if (altMatch) next.altitude = parseFloat(altMatch[1]);
      }

      // 3b. Parse legacy format: MPU6050 -> Accel: x y z
      else if (clean.includes('MPU6050 -> Accel:')) {
        const parts = clean.split('Accel:')[1]?.trim().split(/\s+/);
        if (parts && parts.length >= 3) {
          const ax = parseFloat(parts[0]);
          const ay = parseFloat(parts[1]);
          const az = parseFloat(parts[2]);
          if (!isNaN(ax) && !isNaN(ay) && !isNaN(az)) {
            next.ax = ax;
            next.ay = ay;
            next.az = az;
            const mag = Math.sqrt(ax * ax + ay * ay + az * az);
            const accelG = mag > 5.0 ? mag / 9.80665 : mag;
            next.accel_total = Math.round(accelG * 100) / 100;

            const zNorm = Math.min(1.0, Math.max(-1.0, (mag > 5.0 ? az / 9.80665 : az) / accelG));
            const tiltDeg = Math.acos(zNorm) * (180 / Math.PI);
            next.tilt_angle = !isNaN(tiltDeg) ? Math.round(tiltDeg * 10) / 10 : 0;
            next.is_moving = Math.abs(accelG - 1.0) > 0.15;
          }
        }
      }

      // 4. Parse GPS -> Lat: 17.385000 | Lng: 78.486700 | Sats: 8
      else if (clean.includes('GPS ->')) {
        if (clean.includes('waiting for fix')) {
          next.gps_valid = false;
        } else {
          const latMatch = clean.match(/Lat:\s*([0-9.-]+)/i);
          const lngMatch = clean.match(/Lng:\s*([0-9.-]+)/i);
          const satsMatch = clean.match(/Sats:\s*([0-9]+)/i);

          if (latMatch && lngMatch) {
            const latVal = parseFloat(latMatch[1]);
            const lngVal = parseFloat(lngMatch[1]);
            if (latVal !== 0 || lngVal !== 0) {
              next.latitude = latVal;
              next.longitude = lngVal;
              next.gps_valid = true;
            }
          }
          if (satsMatch) next.satellites = parseInt(satsMatch[1], 10);
        }
      }

      // Check safety thresholds
      if (next.vitals_valid && (next.heart_rate < 40 || next.heart_rate > 150 || next.spo2 < 88)) {
        next.status = 'MEDICAL_EMERGENCY';
        next.is_emergency = true;
      } else if (next.tilt_angle > 65) {
        next.status = 'FALL_DETECTED';
        next.is_emergency = true;
      } else if (next.status !== 'SAFE') {
        // Auto reset if normalized
        next.status = 'SAFE';
        next.is_emergency = false;
      }

      return next;
    });
  }, []);

  const connectSerial = useCallback(async () => {
    if (!('serial' in navigator)) {
      setSerialError('Web Serial API is not supported in this browser. Use Google Chrome or Microsoft Edge.');
      return;
    }

    try {
      setSerialError(null);
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      portRef.current = port;
      setIsConnected(true);
      keepReadingRef.current = true;

      if (onEventLog) {
        onEventLog({
          id: `usb-${Date.now()}`,
          type: 'SYSTEM',
          message: 'Connected to ESP32 via USB Serial @ 115200 baud',
          timestamp: new Date().toISOString(),
          severity: 'safe'
        });
      }

      // Read loop
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      readerRef.current = { reader, readableStreamClosed };

      let buffer = '';
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || ''; // keep incomplete line in buffer
          for (const line of lines) {
            parseSerialLine(line);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        console.error('Serial connection error:', err);
        setSerialError(`Connection failed: ${err.message || err}`);
      }
      setIsConnected(false);
    }
  }, [parseSerialLine, onEventLog]);

  const disconnectSerial = useCallback(async () => {
    keepReadingRef.current = false;
    try {
      if (readerRef.current && readerRef.current.reader) {
        await readerRef.current.reader.cancel();
      }
      if (portRef.current) {
        await portRef.current.close();
      }
    } catch (err) {
      console.error('Error closing serial port:', err);
    } finally {
      portRef.current = null;
      readerRef.current = null;
      setIsConnected(false);
    }
  }, []);

  return {
    isSupported,
    isConnected,
    serialError,
    serialData,
    connectSerial,
    disconnectSerial,
  };
}
