/*
 * useFirebase.js – Real Hardware Data Hook (Firebase + Direct Wi-Fi Support)
 * ════════════════════════════════════════════════════════════════════════════
 * Reads live data from either:
 *   1. Direct ESP32 Local Wi-Fi IP address (No Firebase/Cloud needed!)
 *   2. Firebase Realtime Database
 */

import { useState, useEffect, useCallback } from 'react';
import { onValue, workersRef, eventsRef, set, push, isFirebaseConfigured } from '../firebase';

const STANDBY_HARDWARE_DATA = {
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
  pressure:     1013.2,
  temperature:  0.0,
  latitude:     17.3850,
  longitude:    78.4867,
  speed:        0.0,
  gps_valid:    false,
  satellites:   0,
  timestamp:    new Date().toISOString(),
};

export function useFirebase(workerId = 'WRK-001') {
  const [data, setData] = useState(STANDBY_HARDWARE_DATA);
  const [directIp, setDirectIp] = useState(() => {
    return localStorage.getItem('safeguard_esp32_ip') || '';
  });
  const [directConnected, setDirectConnected] = useState(false);

  const [events, setEvents] = useState([
    {
      id: 'sys-init',
      type: 'SYSTEM',
      message: directIp
        ? `Polling direct ESP32 Wi-Fi API at http://${directIp}/api/data...`
        : isFirebaseConfigured
        ? 'Connected to Firebase – Awaiting live ESP32 sensor stream...'
        : 'Hardware Standby – Enter your ESP32 Wi-Fi IP address below or connect Firebase.',
      timestamp: new Date().toISOString(),
      severity: 'info',
    }
  ]);

  // 1. Direct Local Wi-Fi Polling (No Firebase needed!)
  useEffect(() => {
    if (!directIp) {
      setDirectConnected(false);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const cleanIp = directIp.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        const res = await fetch(`http://${cleanIp}/api/data`, { cache: 'no-store' });
        if (res.ok) {
          const liveJson = await res.json();
          setData(prev => ({
            ...STANDBY_HARDWARE_DATA,
            ...liveJson,
            timestamp: new Date().toISOString()
          }));
          setDirectConnected(true);
        } else {
          setDirectConnected(false);
        }
      } catch (err) {
        setDirectConnected(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [directIp]);

  // 2. Firebase Realtime Database Listener (if configured and not using direct IP)
  useEffect(() => {
    if (!isFirebaseConfigured || directIp) return;

    const workerNode = workersRef(workerId);
    if (!workerNode) return;

    const unsubscribe = onValue(workerNode, (snapshot) => {
      if (snapshot.exists()) {
        const liveData = snapshot.val();
        setData({
          ...STANDBY_HARDWARE_DATA,
          ...liveData,
        });
      }
    });

    return () => unsubscribe();
  }, [workerId, directIp]);

  // Listen to Firebase event log
  useEffect(() => {
    if (!isFirebaseConfigured || directIp) return;

    const eventsNode = eventsRef(workerId);
    if (!eventsNode) return;

    const unsubscribe = onValue(eventsNode, (snapshot) => {
      if (snapshot.exists()) {
        const eventsData = snapshot.val();
        const eventsList = Object.entries(eventsData)
          .map(([key, val]) => ({
            id: key,
            ...val,
            severity: val.type === 'SYSTEM' ? 'info' : 
                     val.type === 'SAFE' ? 'safe' : 'danger'
          }))
          .sort((a, b) => (b.device_ms || 0) - (a.device_ms || 0))
          .slice(0, 50);
          
        setEvents(eventsList);
      }
    });

    return () => unsubscribe();
  }, [workerId, directIp]);

  // Update ESP32 Direct IP
  const updateDirectIp = useCallback((newIp) => {
    setDirectIp(newIp);
    if (newIp) {
      localStorage.setItem('safeguard_esp32_ip', newIp);
    } else {
      localStorage.removeItem('safeguard_esp32_ip');
    }
  }, []);

  const resetToSafe = useCallback(() => {
    setData(prev => ({ ...prev, status: 'SAFE', is_emergency: false }));
  }, []);

  const triggerEvent = () => {
    alert("Simulation triggers are disabled in Live Hardware Mode.");
  };

  return { data, events, triggerEvent, resetToSafe, directIp, updateDirectIp, directConnected };
}
