import { SERVICE_URL, LAYERS, NZTM, OTAGO_EXTENT } from './config.js';
import { landPopup, addressPopup } from './popup.js';

const [ArcGISMap, Graphic, GraphicsLayer, FeatureLayer, WebTileLayer] = await $arcgis.import([
  '@arcgis/core/Map.js',
  '@arcgis/core/Graphic.js',
  '@arcgis/core/layers/GraphicsLayer.js',
  '@arcgis/core/layers/FeatureLayer.js',
  '@arcgis/core/layers/WebTileLayer.js',
]);

const STYLE = {
  boundary: { type: 'simple-fill', color: [0, 0, 0, 0], outline: { color: '#1e8449', width: '1px' } },
  road: { type: 'simple-line', color: '#1f6fb2', width: '6px' },
  areaRoad: { type: 'simple-line', color: [31, 111, 178, 0.45], width: '3px' },
  roadLand: { type: 'simple-fill', color: [243, 156, 18, 0.15], outline: { color: [243, 156, 18, 0.8], width: '1px' } },
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

const layers = {
  areaRoads: new GraphicsLayer(),
  roadLands: new GraphicsLayer(),
  road: new GraphicsLayer(),
  land: new GraphicsLayer(),
  address: new GraphicsLayer(),
};

const boundaries = new FeatureLayer({
  url: `${SERVICE_URL}/${LAYERS.properties}`,
  renderer: { type: 'simple', symbol: STYLE.boundary },
  minScale: 10000,
  visible: false,
  popupEnabled: false,
});

const osm = new WebTileLayer({
  urlTemplate: 'https://tile.openstreetmap.org/{level}/{col}/{row}.png',
  copyright: '© OpenStreetMap contributors | LINZ, ORC',
});

const mapElement = document.getElementById('map');

mapElement.map = new ArcGISMap({
  basemap: { baseLayers: [osm] },
  layers: [boundaries, layers.roadLands, layers.areaRoads, layers.road, layers.land, layers.address],
});
mapElement.extent = OTAGO_EXTENT;
mapElement.constraints = { maxZoom: 19, rotationEnabled: false };

await mapElement.viewOnReady();

mapElement.popupElement.dockEnabled = true;
mapElement.popupElement.dockOptions = { breakpoint: false, buttonEnabled: false, position: 'top-right' };

let onPick = null;

mapElement.addEventListener('arcgisViewClick', event => {
  if (onPick) onPick(event.detail.mapPoint);
});

function goTo(target) {
  mapElement.goTo(target).catch(() => {});
}

export function clear(name) {
  layers[name].removeAll();
  mapElement.closePopup();
}

export function showArea(roads) {
  layers.areaRoads.addMany(roads.map(road => new Graphic({ geometry: road.geometry, symbol: STYLE.areaRoad })));
  if (roads.length) goTo(roads.map(road => road.geometry));
}

export function showRoadLands(lands) {
  layers.roadLands.addMany(lands.map(land => new Graphic({ geometry: land.geometry, symbol: STYLE.roadLand })));
}

export function showRoad(road) {
  layers.road.removeAll();
  const graphic = new Graphic({ geometry: road.geometry, symbol: STYLE.road });
  layers.road.add(graphic);
  goTo(graphic);
}

export function showLand(land, measurement, addresses) {
  const graphic = new Graphic({
    geometry: land.geometry,
    symbol: STYLE.land,
    ...landPopup(land, measurement, addresses),
  });
  layers.land.add(graphic);

  measurement.sides.forEach((side, i) => {
    const x = (side.from[0] + side.to[0]) / 2;
    const y = (side.from[1] + side.to[1]) / 2;
    layers.land.add(new Graphic({
      geometry: { type: 'point', x, y, spatialReference: NZTM },
      symbol: { ...STYLE.sideLabel, text: `${i + 1} ${side.length.toFixed(2)} m` },
    }));
  });

  goTo(land.geometry.extent.clone().expand(1.5));
  mapElement.openPopup({ features: [graphic] });
}

export function showAddress(address) {
  layers.address.removeAll();
  const graphic = new Graphic({ geometry: address.point, symbol: STYLE.address, ...addressPopup(address) });
  layers.address.add(graphic);
  goTo({ target: graphic, zoom: 19 });
  mapElement.openPopup({ features: [graphic] });
}

export function setPicking(handler) {
  onPick = handler;
  boundaries.visible = handler !== null;
  mapElement.style.cursor = handler ? 'crosshair' : '';
}
