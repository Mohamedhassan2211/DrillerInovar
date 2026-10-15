import { OTAGO_EXTENT } from './config.js';
import { toLatLng } from './projection.js';
import { landPopupHtml, addressPopupHtml } from './popup.js';

const [ArcGISMap, Basemap, Graphic, GraphicsLayer, WebTileLayer, Extent, promiseUtils] = await $arcgis.import([
  '@arcgis/core/Map.js',
  '@arcgis/core/Basemap.js',
  '@arcgis/core/Graphic.js',
  '@arcgis/core/layers/GraphicsLayer.js',
  '@arcgis/core/layers/WebTileLayer.js',
  '@arcgis/core/geometry/Extent.js',
  '@arcgis/core/core/promiseUtils.js',
]);

const STYLE = {
  road: { type: 'simple-line', color: '#1f6fb2', width: '6px' },
  land: { type: 'simple-fill', color: [192, 57, 43, 0.25], outline: { color: '#c0392b', width: '3px' } },
  address: { type: 'simple-marker', size: '14px', color: [165, 105, 189, 0.9], outline: { color: '#6c3483', width: '2px' } },
  sideLabel: {
    type: 'text',
    color: '#c0392b',
    backgroundColor: [255, 255, 255, 0.92],
    borderLineColor: '#c0392b',
    borderLineSize: 1,
    font: { size: '11px' },
  },
};

// Space kept between an open popup and the map edge, in pixels
const AUTO_PAN_PADDING = 5;

// The map draws popups inside its shadow DOM, which style.css doesn't reach, so their content adopts popup.css
const popupStyles = new CSSStyleSheet();
fetch(new URL('../css/popup.css', import.meta.url))
  .then(response => response.text())
  .then(css => popupStyles.replaceSync(css))
  .catch(console.error);

// The map draws only what is picked from the lists
const layers = {
  road: new GraphicsLayer({ id: 'road' }),
  land: new GraphicsLayer({ id: 'land' }),
  address: new GraphicsLayer({ id: 'address' }),
};

const mapElement = document.getElementById('map');

mapElement.map = new ArcGISMap({
  basemap: new Basemap({
    baseLayers: [
      new WebTileLayer({
        urlTemplate: 'https://tile.openstreetmap.org/{level}/{col}/{row}.png',
        copyright: '© OpenStreetMap | LINZ, ORC',
      }),
    ],
  }),
  layers: [layers.road, layers.land, layers.address],
});
mapElement.constraints = { maxZoom: 19, rotationEnabled: false };

const [south, west] = toLatLng([OTAGO_EXTENT.xmin, OTAGO_EXTENT.ymin]);
const [north, east] = toLatLng([OTAGO_EXTENT.xmax, OTAGO_EXTENT.ymax]);
mapElement.extent = new Extent({ xmin: west, ymin: south, xmax: east, ymax: north });

await mapElement.viewOnReady();

// Popups open above their anchor (panToPopup() makes room for them) and have only a close button
mapElement.popup = {
  alignment: 'top-center',
  dockOptions: { buttonEnabled: false },
  visibleElements: { actionBar: false },
};

// The map's own popup handling is off (popup-disabled in index.html), so a click on the map just closes the popup
mapElement.addEventListener('arcgisViewClick', () => mapElement.closePopup());

// Service geometry is in NZTM meters; the map takes WGS84 lng/lat and projects it to Web Mercator itself
const toLngLat = point => toLatLng(point).reverse();
const toPolyline = paths => ({ type: 'polyline', paths: paths.map(path => path.map(toLngLat)) });
const toPolygon = rings => ({ type: 'polygon', rings: rings.map(ring => ring.map(toLngLat)) });

function toPoint(point) {
  const [latitude, longitude] = toLatLng(point);
  return { type: 'point', latitude, longitude };
}

// goTo() and openPopup() reject with an AbortError when a newer call replaces them
function ignoreAbort(error) {
  if (!promiseUtils.isAbortError(error)) console.error(error);
}

function addGraphic(layer, geometry, symbol) {
  const graphic = new Graphic({ geometry, symbol });
  layer.add(graphic);
  return graphic;
}

function goTo(target) {
  return mapElement.goTo(target).catch(ignoreAbort);
}

async function openPopup(html, location) {
  const content = document.createElement('div');
  const root = content.attachShadow({ mode: 'open' });
  root.adoptedStyleSheets = [popupStyles];
  root.innerHTML = html;

  try {
    await mapElement.openPopup({ content, location });
    await new Promise(requestAnimationFrame); // let the popup lay out before measuring it
    panToPopup();
  } catch (error) {
    ignoreAbort(error);
  }
}

// Pans the map until the open popup fits inside it
function panToPopup() {
  const { popup } = mapElement;
  if (!popup.visible || popup.currentDockPosition) return; // a docked popup doesn't point at the map
  const box = popup.container.getBoundingClientRect();
  const view = mapElement.getBoundingClientRect();

  let dx = Math.max(box.right + AUTO_PAN_PADDING - view.right, 0);
  if (box.left - dx - AUTO_PAN_PADDING < view.left) dx = box.left - AUTO_PAN_PADDING - view.left;
  let dy = Math.max(box.bottom + AUTO_PAN_PADDING - view.bottom, 0);
  if (box.top - dy - AUTO_PAN_PADDING < view.top) dy = box.top - AUTO_PAN_PADDING - view.top;
  if (!dx && !dy) return;

  // goTo() pans only to a Point instance, not a plain object. Screen y grows downward and map y northward.
  const center = mapElement.center.clone();
  center.x += dx * mapElement.resolution;
  center.y -= dy * mapElement.resolution;
  goTo(center);
}

export function clear(name) {
  layers[name].removeAll();
  mapElement.closePopup();
}

// The service has no area boundaries, so the map zooms to the area's roads without drawing them
export function showArea(roads) {
  if (roads.length) goTo(new Graphic({ geometry: toPolyline(roads.flatMap(road => road.paths)) }));
}

export function showRoad(road) {
  layers.road.removeAll();
  goTo(addGraphic(layers.road, toPolyline(road.paths), STYLE.road));
}

// Draws the land with a length label on every side, then opens its popup
export function showLand(land, measurement, addresses) {
  const polygon = addGraphic(layers.land, toPolygon(land.rings), STYLE.land);

  measurement.sides.forEach((side, i) => {
    const middle = [(side.from[0] + side.to[0]) / 2, (side.from[1] + side.to[1]) / 2];
    addGraphic(layers.land, toPoint(middle), { ...STYLE.sideLabel, text: `${i + 1} ${side.length.toFixed(2)} m` });
  });

  // Open the popup on the top edge so it doesn't cover the side labels.
  // Wait for the zoom to finish, or the popup is placed against the old view.
  // The margin around the land leaves room for the side labels.
  const { extent } = polygon.geometry;
  const top = extent.center.clone();
  top.y = extent.ymax;
  goTo(extent.clone().expand(1.5)).then(() => {
    if (polygon.layer) openPopup(landPopupHtml(land, measurement, addresses), top); // the land is still selected
  });
}

export function showAddress(address) {
  layers.address.removeAll();
  const point = addGraphic(layers.address, toPoint(address.point), STYLE.address);
  goTo({ target: point, zoom: 19 }).then(() => {
    if (point.layer) openPopup(addressPopupHtml(address), point.geometry); // the address is still selected
  });
}
