/*
 * MapWidget.jsx – Live GPS Location Map (Google Maps API + OpenStreetMap Fallback)
 * ══════════════════════════════════════════════════════════════════════════════════
 * Features professional dark/hybrid map styling, pulsing worker marker, accuracy circle,
 * satellite count indicator, and live telemetry HUD.
 */

import { useEffect, useRef, useState } from 'react';

// Leaflet dynamic reference
let L = null;

// Custom sleek dark styling for Google Maps
const GOOGLE_DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a99ad' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#141b2d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#090d16' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3b82f6' }] }
];

export default function MapWidget({ latitude, longitude, gpsValid, status, workerName, satellites = 0 }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const infoWindowRef = useRef(null);

  // Default API Key provided by user
  const defaultKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY';
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('safeguard_gmaps_key') || defaultKey;
  });

  const [mapReady, setMapReady] = useState(false);
  const [provider, setProvider] = useState(() => {
    const saved = localStorage.getItem('safeguard_map_provider');
    if (saved) return saved;
    return 'leaflet'; // Guaranteed instant dark vector/satellite tiles
  });
  const [mapTypeId, setMapTypeId] = useState('roadmap'); // roadmap | satellite | hybrid
  const [googleError, setGoogleError] = useState(null);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState(apiKey);

  const isEmergency = status !== 'SAFE';
  const lat = latitude || 17.3850;
  const lng = longitude || 78.4867;

  const toggleProvider = (newProvider) => {
    setProvider(newProvider);
    localStorage.setItem('safeguard_map_provider', newProvider);
    setMapReady(false);
    setGoogleError(null);
  };

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    const cleaned = tempKeyInput.trim();
    setApiKey(cleaned);
    localStorage.setItem('safeguard_gmaps_key', cleaned);
    setShowKeyConfig(false);
    setMapReady(false);
    setGoogleError(null);
  };

  // Load Google Maps JS Script dynamically
  const loadGoogleMapsScript = (key) => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
        return;
      }
      const scriptId = 'google-maps-api-script';
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google.maps));
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')));
        return;
      }
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=__googleMapsCallback`;
      script.async = true;
      script.defer = true;
      window.__googleMapsCallback = () => {
        resolve(window.google.maps);
      };
      script.onerror = () => reject(new Error('Invalid API Key or network issue loading Google Maps'));
      document.head.appendChild(script);
    });
  };

  // Custom HTML Marker Overlay class for Google Maps
  const createHTMLOverlayClass = (gmaps) => {
    return class HTMLMapMarker extends gmaps.OverlayView {
      constructor(latlng, mapInstance, currentStatus, wName, onClick) {
        super();
        this.latlng = latlng;
        this.status = currentStatus;
        this.workerName = wName;
        this.onClick = onClick;
        this.div = null;
        this.setMap(mapInstance);
      }
      onAdd() {
        this.div = document.createElement('div');
        this.div.className = 'custom-map-marker';
        this.div.style.position = 'absolute';
        this.div.style.cursor = 'pointer';
        this.updateHTML();
        this.div.addEventListener('click', () => {
          if (this.onClick) this.onClick();
        });
        const panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(this.div);
      }
      draw() {
        if (!this.div) return;
        const projection = this.getProjection();
        const pos = projection.fromLatLngToDivPixel(this.latlng);
        if (pos) {
          this.div.style.left = `${pos.x - 20}px`;
          this.div.style.top = `${pos.y - 20}px`;
        }
      }
      onRemove() {
        if (this.div && this.div.parentNode) {
          this.div.parentNode.removeChild(this.div);
        }
        this.div = null;
      }
      setPosition(latlng) {
        this.latlng = latlng;
        this.draw();
      }
      setStatus(newStatus) {
        this.status = newStatus;
        this.updateHTML();
      }
      updateHTML() {
        if (!this.div) return;
        const emergency = this.status !== 'SAFE';
        const color = emergency ? '#ef4444' : '#38bdf8';
        const glow = emergency ? 'rgba(239, 68, 68, 0.7)' : 'rgba(56, 189, 248, 0.5)';
        this.div.innerHTML = `
          <div class="marker-outer" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; position: relative;">
            <div class="marker-inner" style="width: 16px; height: 16px; border-radius: 50%; background: ${color}; box-shadow: 0 0 16px ${glow}; border: 2px solid #fff; z-index: 2;"></div>
            <div class="marker-pulse" style="position: absolute; width: 38px; height: 38px; border-radius: 50%; border: 2px solid ${color}; animation: markerPulseAnim 1.8s ease-out infinite; z-index: 1;"></div>
          </div>
        `;
      }
    };
  };

  // Initialize Map
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;

      if (mapRef.current) {
        if (markerRef.current && markerRef.current.setMap) markerRef.current.setMap(null);
        if (circleRef.current && circleRef.current.setMap) circleRef.current.setMap(null);
        if (provider === 'leaflet' && mapRef.current.remove) {
          mapRef.current.remove();
        }
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        infoWindowRef.current = null;
      }
      setMapReady(false);

      if (provider === 'google') {
        if (!apiKey) {
          setGoogleError('Please enter a Google Maps API Key.');
          return;
        }
        try {
          window.gm_authFailure = () => {
            console.error('Google Maps Auth Failure');
            if (!cancelled) {
              setGoogleError('Maps API Key error or restricted domain. Switching to OpenStreetMap.');
              setProvider('leaflet');
            }
          };
          const gmaps = await loadGoogleMapsScript(apiKey);
          if (cancelled || !mapContainerRef.current) return;

          const map = new gmaps.Map(mapContainerRef.current, {
            center: { lat, lng },
            zoom: 17,
            styles: mapTypeId === 'roadmap' ? GOOGLE_DARK_MAP_STYLES : null,
            mapTypeId: mapTypeId,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
          });

          const infoWindow = new gmaps.InfoWindow({
            content: getPopupHTML(lat, lng, status, workerName, isEmergency, satellites),
          });

          const HTMLMarker = createHTMLOverlayClass(gmaps);
          const marker = new HTMLMarker(
            new gmaps.LatLng(lat, lng),
            map,
            status,
            workerName,
            () => {
              infoWindow.setPosition({ lat, lng });
              infoWindow.open(map);
            }
          );

          const circleColor = isEmergency ? '#ef4444' : '#38bdf8';
          const circle = new gmaps.Circle({
            strokeColor: circleColor,
            strokeOpacity: 0.8,
            strokeWeight: 1.5,
            fillColor: circleColor,
            fillOpacity: isEmergency ? 0.2 : 0.12,
            map,
            center: { lat, lng },
            radius: gpsValid ? 10 : 35,
          });

          mapRef.current = map;
          markerRef.current = marker;
          circleRef.current = circle;
          infoWindowRef.current = infoWindow;
          setMapReady(true);
        } catch (err) {
          console.error('Google Maps error:', err);
          if (!cancelled) {
            setGoogleError(err.message || 'Error loading Google Maps API');
          }
        }
      } else {
        // Leaflet / OpenStreetMap Fallback
        try {
          L = (await import('leaflet')).default;
          await import('leaflet/dist/leaflet.css');
        } catch (e) {
          console.warn('Leaflet not available:', e);
          return;
        }

        if (cancelled || !mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 17,
          zoomControl: true,
          attributionControl: true,
        });

        const tileUrl = mapTypeId === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileUrl, {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const markerIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `
            <div class="marker-outer">
              <div class="marker-inner" id="map-marker-dot"></div>
              <div class="marker-pulse" id="map-marker-pulse"></div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
        marker.bindPopup(getPopupHTML(lat, lng, status, workerName, isEmergency, satellites));

        const circle = L.circle([lat, lng], {
          radius: gpsValid ? 10 : 35,
          color: isEmergency ? '#ef4444' : '#38bdf8',
          fillColor: isEmergency ? '#ef4444' : '#38bdf8',
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(map);

        mapRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        setMapReady(true);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (markerRef.current && markerRef.current.setMap) markerRef.current.setMap(null);
      if (circleRef.current && circleRef.current.setMap) circleRef.current.setMap(null);
      if (provider === 'leaflet' && mapRef.current && mapRef.current.remove) {
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
  }, [provider, apiKey, mapTypeId]); // eslint-disable-line react-hooks/exhaustive-deps

  function getPopupHTML(lLat, lLng, lStatus, lName, lEmg, lSats) {
    return `
      <div style="font-family: Inter, sans-serif; min-width: 180px; color: #0f172a; padding: 4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <strong style="font-size: 13px; color: #0f172a;">👷 ${lName || 'Worker'}</strong>
          <span style="font-size: 10px; padding: 2px 6px; border-radius: 999px; background: ${lEmg ? '#fee2e2' : '#e0f2fe'}; color: ${lEmg ? '#dc2626' : '#0369a1'}; font-weight:700;">
            🛰️ ${lSats || 0} sats
          </span>
        </div>
        <div style="font-size: 11px; color: #475569; margin-bottom: 6px; font-family: monospace;">
          📍 ${Number(lLat).toFixed(6)}, ${Number(lLng).toFixed(6)}
        </div>
        <div style="font-size: 11px; color: ${lEmg ? '#dc2626' : '#16a34a'}; font-weight: 700; display:flex; align-items:center; gap: 4px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${lEmg ? '#dc2626' : '#16a34a'}; display:inline-block;"></span>
          ${lStatus}
        </div>
      </div>
    `;
  }

  // Update map position on data change
  useEffect(() => {
    if (!mapReady || !mapRef.current || !latitude || !longitude) return;

    if (provider === 'google' && window.google && mapRef.current.panTo) {
      const gLatLng = new window.google.maps.LatLng(latitude, longitude);
      if (markerRef.current) {
        markerRef.current.setPosition(gLatLng);
        if (markerRef.current.setStatus) markerRef.current.setStatus(status);
      }
      if (circleRef.current) {
        circleRef.current.setCenter(gLatLng);
        const color = isEmergency ? '#ef4444' : '#38bdf8';
        circleRef.current.setOptions({
          strokeColor: color,
          fillColor: color,
          fillOpacity: isEmergency ? 0.2 : 0.12,
          radius: gpsValid ? 10 : 35,
        });
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.setContent(getPopupHTML(latitude, longitude, status, workerName, isEmergency, satellites));
      }
    } else if (provider === 'leaflet' && L) {
      const pos = [latitude, longitude];
      if (markerRef.current) {
        markerRef.current.setLatLng(pos);
        markerRef.current.setPopupContent(getPopupHTML(latitude, longitude, status, workerName, isEmergency, satellites));
      }
      if (circleRef.current) {
        circleRef.current.setLatLng(pos);
        const color = isEmergency ? '#ef4444' : '#38bdf8';
        circleRef.current.setStyle({
          color,
          fillColor: color,
          fillOpacity: isEmergency ? 0.2 : 0.12,
        });
        circleRef.current.setRadius(gpsValid ? 10 : 35);
      }

      const dot = document.getElementById('map-marker-dot');
      const pulse = document.getElementById('map-marker-pulse');
      if (dot && pulse) {
        if (isEmergency) {
          dot.style.background = '#ef4444';
          dot.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.7)';
          pulse.style.borderColor = '#ef4444';
        } else {
          dot.style.background = '#38bdf8';
          dot.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.5)';
          pulse.style.borderColor = '#38bdf8';
        }
      }
    }
  }, [latitude, longitude, mapReady, status, workerName, isEmergency, provider, satellites, gpsValid]);

  const recenterMap = () => {
    if (!mapReady || !mapRef.current) return;
    if (provider === 'google' && window.google) {
      mapRef.current.panTo(new window.google.maps.LatLng(lat, lng));
    } else if (provider === 'leaflet') {
      mapRef.current.panTo([lat, lng], { animate: true });
    }
  };

  return (
    <div className="map-widget glass-card">
      <div className="map-widget__header">
        <div className="map-widget__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>📍</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Live GPS Telemetry</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {provider === 'google' ? 'Google Maps JavaScript API' : 'OpenStreetMap Vector'}
            </div>
          </div>
          {!gpsValid && (
            <span className="badge badge--warning" style={{ marginLeft: 6, fontSize: '0.65rem' }}>
              GPS Waiting Fix
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Map Type Switcher */}
          <div className="map-pill-toggle">
            <button
              type="button"
              onClick={() => setMapTypeId('roadmap')}
              className={`map-pill-btn ${mapTypeId === 'roadmap' ? 'map-pill-btn--active' : ''}`}
            >
              Dark Map
            </button>
            <button
              type="button"
              onClick={() => setMapTypeId('hybrid')}
              className={`map-pill-btn ${mapTypeId === 'hybrid' ? 'map-pill-btn--active' : ''}`}
            >
              Satellite
            </button>
          </div>

          {/* Provider Switcher */}
          <div className="map-pill-toggle">
            <button
              type="button"
              onClick={() => toggleProvider('google')}
              className={`map-pill-btn ${provider === 'google' ? 'map-pill-btn--active-brand' : ''}`}
              title="Use Google Maps API"
            >
              🌐 Google Maps
            </button>
            <button
              type="button"
              onClick={() => toggleProvider('leaflet')}
              className={`map-pill-btn ${provider === 'leaflet' ? 'map-pill-btn--active-brand' : ''}`}
              title="Use OpenStreetMap Fallback"
            >
              🗺️ OSM
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="sim-btn"
            style={{ padding: '4px 8px', fontSize: '0.7rem' }}
            title="Configure Google Maps API Key"
          >
            🔑 Key
          </button>

          <button
            type="button"
            onClick={recenterMap}
            className="sim-btn sim-btn--safe"
            style={{ padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700 }}
          >
            🎯 Center
          </button>
        </div>
      </div>

      {/* API Key Modal / Banner */}
      {showKeyConfig && (
        <form onSubmit={handleSaveApiKey} style={{
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>Google Maps Key:</span>
          <input
            type="text"
            value={tempKeyInput}
            onChange={(e) => setTempKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            style={{
              flex: 1,
              minWidth: '220px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '0.75rem',
              fontFamily: 'monospace'
            }}
          />
          <button type="submit" className="sim-btn sim-btn--safe" style={{ fontSize: '0.75rem' }}>Save Key</button>
          <button type="button" onClick={() => setShowKeyConfig(false)} className="sim-btn" style={{ fontSize: '0.75rem' }}>Cancel</button>
        </form>
      )}

      {/* Map view body */}
      <div className="map-widget__body" style={{ position: 'relative' }}>
        <div ref={mapContainerRef} id="map-container" style={{ width: '100%', height: '100%' }} />

        {/* Telemetry overlay HUD bar inside map */}
        <div className="map-hud-overlay">
          <div className="map-hud-item">
            <span className="map-hud-label">GPS COORDS</span>
            <span className="map-hud-val">{latitude?.toFixed(5) || '—'}°N, {longitude?.toFixed(5) || '—'}°E</span>
          </div>
          <div className="map-hud-item">
            <span className="map-hud-label">SATELLITES</span>
            <span className="map-hud-val" style={{ color: satellites >= 4 ? '#38bdf8' : '#fbbf24' }}>
              {satellites} / 12
            </span>
          </div>
          <div className="map-hud-item">
            <span className="map-hud-label">FIX STATUS</span>
            <span className="map-hud-val" style={{ color: gpsValid ? '#4ade80' : '#fbbf24' }}>
              {gpsValid ? '3D Active Fix ✓' : 'Acquiring Sats...'}
            </span>
          </div>
        </div>

        {provider === 'google' && googleError && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px', textAlign: 'center', background: 'rgba(10, 14, 26, 0.96)', color: '#ef4444', zIndex: 10
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontSize: '1rem' }}>Google Maps Notice</h4>
            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', maxWidth: '360px', marginBottom: '16px' }}>
              {googleError}
            </p>
            <button
              type="button"
              onClick={() => toggleProvider('leaflet')}
              className="sim-btn sim-btn--safe"
              style={{ padding: '8px 20px', fontWeight: 600 }}
            >
              Switch to OpenStreetMap Vector Map
            </button>
          </div>
        )}

        {!mapReady && !googleError && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '0.85rem', zIndex: 5
          }}>
            Loading {provider === 'google' ? 'Google Maps Telemetry...' : 'OpenStreetMap Vector...'}
          </div>
        )}
      </div>

      <style>{`
        .custom-map-marker {
          background: transparent !important;
          border: none !important;
        }
        .marker-outer {
          position: relative;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .marker-inner {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 16px rgba(56, 189, 248, 0.5);
          border: 2px solid #fff;
          z-index: 2;
          transition: background 0.3s, box-shadow 0.3s;
        }
        .marker-pulse {
          position: absolute;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 2px solid #38bdf8;
          opacity: 0;
          z-index: 1;
          animation: markerPulseAnim 1.8s ease-out infinite;
          transition: border-color 0.3s;
        }
        @keyframes markerPulseAnim {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        .map-pill-toggle {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          padding: 2px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .map-pill-btn {
          padding: 4px 10px;
          border-radius: 999px;
          border: none;
          font-size: 0.68rem;
          font-weight: 600;
          cursor: pointer;
          background: transparent;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .map-pill-btn--active {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
        .map-pill-btn--active-brand {
          background: var(--gradient-brand);
          color: #fff;
          box-shadow: 0 2px 10px rgba(56, 189, 248, 0.3);
        }
        .map-hud-overlay {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          background: rgba(6, 8, 15, 0.88);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          z-index: 4;
          pointer-events: none;
          flex-wrap: wrap;
        }
        .map-hud-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .map-hud-label {
          font-size: 0.55rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
        }
        .map-hud-val {
          font-size: 0.75rem;
          font-family: var(--font-mono);
          font-weight: 600;
          color: var(--text-primary);
        }
        @media (max-width: 600px) {
          .map-hud-overlay {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }
        }
      `}</style>
    </div>
  );
}
