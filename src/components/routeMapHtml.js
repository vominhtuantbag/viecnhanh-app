function pointJson(point) {
  if (!point || !Number.isFinite(Number(point.latitude)) || !Number.isFinite(Number(point.longitude))) return 'null';
  return JSON.stringify([Number(point.latitude), Number(point.longitude)]);
}

export function routeMapHtml({ from, to, line }) {
  const path = JSON.stringify(Array.isArray(line) ? line : []);
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
    var from = ${pointJson(from)};
    var to = ${pointJson(to)};
    var line = ${path};
    var map = L.map('map', { zoomControl: true }).setView(to || from || [16.047079, 108.20623], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    if (from) {
      L.circleMarker(from, { radius: 8, color: '#0052FF', fillColor: '#0052FF', fillOpacity: 1 })
        .bindTooltip('Bạn', { permanent: true, direction: 'top' }).addTo(map);
    }
    if (to) {
      L.circleMarker(to, { radius: 8, color: '#B54708', fillColor: '#F79009', fillOpacity: 1 })
        .bindTooltip('Việc', { permanent: true, direction: 'top' }).addTo(map);
    }
    var drawn = line.length > 1 ? L.polyline(line, { color: '#0052FF', weight: 5 }).addTo(map) : null;
    var bounds = [];
    if (drawn) bounds.push(drawn.getBounds());
    if (from) bounds.push(L.latLngBounds([from, from]));
    if (to) bounds.push(L.latLngBounds([to, to]));
    if (bounds.length) {
      var box = bounds[0];
      bounds.slice(1).forEach(function (item) { box.extend(item); });
      map.fitBounds(box, { padding: [28, 28] });
    }
    setTimeout(function () { map.invalidateSize(); }, 250);
  </script>
</body>
</html>`;
}
