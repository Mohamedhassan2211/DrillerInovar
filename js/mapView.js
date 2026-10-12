import { OTAGO_EXTENT } from './config.js';
import { toLatLng } from './projection.js';
import { landPopupHtml, addressPopupHtml, escapeHtml } from './popup.js';

const STYLE = {
  road: { color: '#566573', weight: 3, opacity: 0.7 },
  selectedRoad: { color: '#1f6fb2', weight: 6, opacity: 1 },
  property: { color: '#1e8449', weight: 1, fillOpacity: 0.15 },
  parcel: { color: '#ca6f1e', weight: 1, fillOpacity: 0.1, dashArray: '4 3' },
  selectedLand: { color: '#c0392b', weight: 3, fillOpacity: 0.25 },
  address: { radius: 7, color: '#6c3483', weight: 2, fillColor: '#a569bd', fillOpacity: 0.9 },
};

const map = L.map('map');

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap | LINZ, ORC',
}).addTo(map);

L.control.scale({ imperial: false }).addTo(map);

map.fitBounds([
  toLatLng([OTAGO_EXTENT.xmin, OTAGO_EXTENT.ymin]),
  toLatLng([OTAGO_EXTENT.xmax, OTAGO_EXTENT.ymax]),
]);

const layers = {
  roads: L.featureGroup().addTo(map),
  lands: L.featureGroup().addTo(map),
  selection: L.featureGroup().addTo(map),
};

const roadLines = new Map();
const addressMarkers = new Map();

// Service geometry is in NZTM meters; Leaflet needs lat/lng
const toLatLngs = rings => rings.map(ring => ring.map(toLatLng));

export function clear(name) {
  layers[name].clearLayers();
}

export function showRoads(roads, onClick) {
  roadLines.clear();
  for (const road of roads) {
    const line = L.polyline(toLatLngs(road.paths), STYLE.road)
      .bindTooltip(escapeHtml(road.name), { sticky: true })
      .on('click', () => onClick(road))
      .addTo(layers.roads);
    roadLines.set(road, line);
  }

  if (roads.length) map.fitBounds(layers.roads.getBounds());
}

export function highlightRoad(road) {
  roadLines.forEach((line, key) => line.setStyle(key === road ? STYLE.selectedRoad : STYLE.road));
  roadLines.get(road).bringToFront();
}

export function showLands(lands, onClick) {
  for (const land of lands) {
    L.polygon(toLatLngs(land.rings), STYLE[land.type])
      .bindTooltip(escapeHtml(land.label), { sticky: true })
      .on('click', () => onClick(land))
      .addTo(layers.lands);
  }

  if (lands.length) map.fitBounds(layers.lands.getBounds());
}

// Draws the land with a length label on every side and its addresses, then opens its popup
export function showSelectedLand(land, measurement, addresses) {
  const polygon = L.polygon(toLatLngs(land.rings), STYLE.selectedLand).addTo(layers.selection);

  measurement.sides.forEach((side, i) => {
    const middle = [(side.from[0] + side.to[0]) / 2, (side.from[1] + side.to[1]) / 2];
    L.marker(toLatLng(middle), {
      interactive: false,
      icon: L.divIcon({
        className: 'side-label',
        html: `<span><b>${i + 1}</b> ${side.length.toFixed(2)} m</span>`,
        iconSize: null,
      }),
    }).addTo(layers.selection);
  });

  addressMarkers.clear();
  for (const address of addresses) {
    const marker = L.circleMarker(toLatLng(address.point), STYLE.address)
      .bindPopup(addressPopupHtml(address))
      .addTo(layers.selection);
    addressMarkers.set(address, marker);
  }

  // Open the popup on the top edge so it doesn't cover the side labels.
  // Wait for the zoom to finish, or the popup auto-pan is measured against the old view.
  const bounds = polygon.getBounds();
  polygon.bindPopup(landPopupHtml(land, measurement, addresses), { maxWidth: 380, maxHeight: 420 });
  map.once('moveend', () => polygon.openPopup([bounds.getNorth(), bounds.getCenter().lng]));
  map.fitBounds(bounds, { maxZoom: 19, padding: [60, 60] });
}

export function focusAddress(address) {
  const marker = addressMarkers.get(address);
  map.setView(marker.getLatLng(), 19);
  marker.openPopup();
}
