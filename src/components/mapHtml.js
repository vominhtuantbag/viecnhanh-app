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

export function mapHtml(latitude, longitude) {
  const start = startPoint(latitude, longitude);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; }
    .leaflet-control-attribution { font-size: 11px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${start.lat}, ${start.lng}], ${start.zoom});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    });
    var marker = L.marker([${start.lat}, ${start.lng}], { draggable: true }).addTo(map);
    function send() {
      var point = marker.getLatLng();
      var payload = JSON.stringify({
        source: 'viecnhanh-map',
        latitude: point.lat,
        longitude: point.lng
      });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
      else window.parent.postMessage(payload, '*');
    }
    marker.on('dragend', send);
    map.on('click', function (event) {
      marker.setLatLng(event.latlng);
      send();
    });
    send();
    setTimeout(function () { map.invalidateSize(); }, 250);
  </script>
</body>
</html>`;
}

export function readMapMessage(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const latitude = Number(data?.latitude);
    const longitude = Number(data?.longitude);
    if (data?.source !== 'viecnhanh-map') return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}
