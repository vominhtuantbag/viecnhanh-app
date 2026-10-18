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
      if (window.L) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Không tải được bản đồ.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được bản đồ.'));
    document.body.appendChild(script);
  });
}

function asPair(point) {
  const lat = Number(point?.latitude);
  const lng = Number(point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

export function RouteMapCanvas({ from, to, line }) {
  const hostRef = useRef(null);
  const lineKey = JSON.stringify(line || []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let map;
    let cancelled = false;
    const fromPair = asPair(from);
    const toPair = asPair(to);
    const path = JSON.parse(lineKey);

    loadStyle(LEAFLET_CSS)
      .then(() => loadScript(LEAFLET_JS))
      .then(() => {
        if (cancelled || !window.L || !hostRef.current) return;
        const L = window.L;
        map = L.map(hostRef.current, { zoomControl: true }).setView(toPair || fromPair || [16.047079, 108.20623], 12);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);
        if (fromPair) {
          L.circleMarker(fromPair, { radius: 8, color: '#0052FF', fillColor: '#0052FF', fillOpacity: 1 })
            .bindTooltip('Bạn', { permanent: true, direction: 'top' })
            .addTo(map);
        }
        if (toPair) {
          L.circleMarker(toPair, { radius: 8, color: '#B54708', fillColor: '#F79009', fillOpacity: 1 })
            .bindTooltip('Việc', { permanent: true, direction: 'top' })
            .addTo(map);
        }
        const drawn = path.length > 1 ? L.polyline(path, { color: '#0052FF', weight: 5 }).addTo(map) : null;
        const spots = [];
        if (drawn) spots.push(drawn.getBounds());
        if (fromPair) spots.push(L.latLngBounds([fromPair, fromPair]));
        if (toPair) spots.push(L.latLngBounds([toPair, toPair]));
        let box = null;
        if (spots.length) {
          box = spots[0];
          spots.slice(1).forEach((spot) => box.extend(spot));
          map.fitBounds(box, { padding: [28, 28] });
        }
        setTimeout(() => {
          if (!map) return;
          map.invalidateSize();
          if (box) map.fitBounds(box, { padding: [28, 28] });
        }, 250);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [from, lineKey, to]);

  return <View ref={hostRef} style={{ flex: 1, width: '100%', height: '100%', minHeight: 0 }} />;
}
