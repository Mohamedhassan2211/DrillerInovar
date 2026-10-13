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
  road: { type: 'simple-line', color: [86, 101, 115, 0.7], width: '3px' },
  selectedRoad: { type: 'simple-line', color: '#1f6fb2', width: '6px' },
  property: { type: 'simple-fill', color: [30, 132, 73, 0.15], outline: { color: '#1e8449', width: '1px' } },
  parcel: { type: 'simple-fill', color: [202, 111, 30, 0.1], outline: { color: '#ca6f1e', width: '1px', style: 'short-dash' } },
  selectedLand: { type: 'simple-fill', color: [192, 57, 43, 0.25], outline: { color: '#c0392b', width: '3px' } },
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

const layers = {
  roads: new GraphicsLayer({ id: 'roads' }),
  lands: new GraphicsLayer({ id: 'lands' }),
  selection: new GraphicsLayer({ id: 'selection' }),
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
  layers: [layers.roads, layers.lands, layers.selection],
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

const roadLines = new Map();
const addressPoints = new Map();

// Service geometry is in NZTM meters; the map takes WGS84 lng/lat and projects it to Web Mercator itself
const toLngLat = point => toLatLng(point).reverse();
const toPolyline = paths => ({ type: 'polyline', paths: paths.map(path => path.map(toLngLat)) });
const toPolygon = rings => ({ type: 'polygon', rings: rings.map(ring => ring.map(toLngLat)) });

function toPoint(point) {
  const [latitude, longitude] = toLatLng(point);
  return { type: 'point', latitude, longitude };
}

// goTo(), openPopup() and the debounced hover reject with an AbortError when a newer call replaces them
function ignoreAbort(error) {
  if (!promiseUtils.isAbortError(error)) console.error(error);
}

// What a graphic does under the mouse: its tooltip text and its click handler.
// Graphics without an entry (the side labels) are not interactive.
const behaviors = new WeakMap();

function addGraphic(layer, geometry, symbol, behavior) {
  const graphic = new Graphic({ geometry, symbol });
  if (behavior) behaviors.set(graphic, behavior);
  layer.add(graphic);
  return graphic;
}

// The topmost interactive graphic under the pointer. Graphics below it don't react.
async function graphicAt(screenPoint) {
  const { results } = await mapElement.hitTest(screenPoint, { include: Object.values(layers) });
  return results.map(result => result.graphic).find(graphic => behaviors.has(graphic));
}

// A click on a graphic runs its handler, and a click anywhere else closes the popup
mapElement.addEventListener('arcgisViewClick', async ({ detail: event }) => {
  const graphic = await graphicAt(event);
  if (graphic) behaviors.get(graphic).onClick(event.mapPoint);
  else mapElement.closePopup();
});

// Sticky tooltip over roads and lands. It follows the pointer and flips to the left on the right half of the map.
const tooltip = document.createElement('div');
tooltip.className = 'map-tooltip';
tooltip.hidden = true;
mapElement.append(tooltip);

const updateHover = promiseUtils.debounce(async event => {
  const graphic = await graphicAt(event);
  const text = graphic && behaviors.get(graphic).tooltip;
  mapElement.style.cursor = graphic ? 'pointer' : '';
  tooltip.hidden = !text;
  if (text) {
    tooltip.textContent = text;
    tooltip.style.left = `${event.x}px`;
    tooltip.style.top = `${event.y}px`;
    tooltip.classList.toggle('left', event.x > mapElement.clientWidth / 2);
  }
});

mapElement.addEventListener('arcgisViewPointerMove', ({ detail: event }) => updateHover(event).catch(ignoreAbort));

mapElement.addEventListener('arcgisViewPointerLeave', () => {
  tooltip.hidden = true;
  mapElement.style.cursor = '';
});

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
  tooltip.hidden = true;
  if (name === 'selection') mapElement.closePopup();
}

export function showRoads(roads, onClick) {
  roadLines.clear();
  for (const road of roads) {
    const line = addGraphic(layers.roads, toPolyline(road.paths), STYLE.road, {
      tooltip: road.name,
      onClick: () => onClick(road),
    });
    roadLines.set(road, line);
  }

  if (roads.length) goTo(layers.roads.graphics);
}

export function highlightRoad(road) {
  roadLines.forEach((line, key) => (line.symbol = key === road ? STYLE.selectedRoad : STYLE.road));
  layers.roads.graphics.reorder(roadLines.get(road), layers.roads.graphics.length - 1); // bring to front
}

export function showLands(lands, onClick) {
  for (const land of lands) {
    addGraphic(layers.lands, toPolygon(land.rings), STYLE[land.type], {
      tooltip: land.label,
      onClick: () => onClick(land),
    });
  }

  if (lands.length) goTo(layers.lands.graphics);
}

// Draws the land with a length label on every side and its addresses, then opens its popup
export function showSelectedLand(land, measurement, addresses) {
  const html = landPopupHtml(land, measurement, addresses);
  const polygon = addGraphic(layers.selection, toPolygon(land.rings), STYLE.selectedLand, {
    onClick: location => openPopup(html, location),
  });

  measurement.sides.forEach((side, i) => {
    const middle = [(side.from[0] + side.to[0]) / 2, (side.from[1] + side.to[1]) / 2];
    addGraphic(layers.selection, toPoint(middle), { ...STYLE.sideLabel, text: `${i + 1} ${side.length.toFixed(2)} m` });
  });

  addressPoints.clear();
  for (const address of addresses) {
    const point = addGraphic(layers.selection, toPoint(address.point), STYLE.address, {
      onClick: () => openPopup(addressPopupHtml(address), point.geometry),
    });
    addressPoints.set(address, point);
  }

  // Open the popup on the top edge so it doesn't cover the side labels.
  // Wait for the zoom to finish, or the popup is placed against the old view.
  // The margin around the land leaves room for the side labels.
  const { extent } = polygon.geometry;
  const top = extent.center.clone();
  top.y = extent.ymax;
  goTo(extent.clone().expand(1.5)).then(() => {
    if (polygon.layer) openPopup(html, top); // the land is still selected
  });
}

export function focusAddress(address) {
  const point = addressPoints.get(address);
  goTo({ target: point, zoom: 19 }).then(() => {
    if (point.layer) openPopup(addressPopupHtml(address), point.geometry); // the address is still shown
  });
}
