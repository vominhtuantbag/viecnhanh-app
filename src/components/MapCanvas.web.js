import { useEffect, useRef } from 'react';
import { View } from 'react-native';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('Không tải được bản đồ.'));
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  if (window.L) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được bản đồ.'));
    document.body.appendChild(script);
  });
}

function startPoint(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const has =
    latitude != null &&
    longitude != null &&
    latitude !== '' &&
    longitude !== '' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0);
  return {
    lat: has ? lat : 16.047079,
    lng: has ? lng : 108.20623,
    zoom: has ? 16 : 5,
  };
}

export function MapCanvas({ latitude, longitude, onPin }) {
  const hostRef = useRef(null);
  const onPinRef = useRef(onPin);

  useEffect(() => {
    onPinRef.current = onPin;
  }, [onPin]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let map;
    let cancelled = false;
    const start = startPoint(latitude, longitude);

    loadStyle(LEAFLET_CSS)
      .then(() => loadScript(LEAFLET_JS))
      .then(() => {
        if (cancelled || !window.L || !hostRef.current) return;
        const L = window.L;
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        map = L.map(hostRef.current, { zoomControl: true }).setView([start.lat, start.lng], start.zoom);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);
        const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);
        const send = () => {
          const point = marker.getLatLng();
          onPinRef.current?.({ latitude: point.lat, longitude: point.lng });
        };
        marker.on('dragend', send);
        map.on('click', (event) => {
          marker.setLatLng(event.latlng);
          send();
        });
        send();
        setTimeout(() => {
          map?.invalidateSize();
          map?.setView([start.lat, start.lng], start.zoom);
        }, 250);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [latitude, longitude]);

  return <View ref={hostRef} style={{ flex: 1, width: '100%', height: '100%', minHeight: 0 }} />;
}
