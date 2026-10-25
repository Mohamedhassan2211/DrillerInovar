import { toWgs84 } from './geometry.js';

const WGS84 = { wkid: 4326 };
const FILE_NAMES = { point: 'drawing', polyline: 'drawing', polygon: 'drawing' };

function toGeoJson(geometry) {
  const { type, x, y, paths, rings } = toWgs84(geometry);
  if (type === 'point') return { type: 'Point', coordinates: [x, y] };
  if (type === 'polyline') return { type: 'LineString', coordinates: paths[0] };
  return { type: 'Polygon', coordinates: rings };
}

function fromGeoJson({ type, coordinates }) {
  const spatialReference = WGS84;
  if (type === 'Point') return { type: 'point', x: coordinates[0], y: coordinates[1], spatialReference };
  if (type === 'LineString') return { type: 'polyline', paths: [coordinates], spatialReference };
  if (type === 'MultiLineString') return { type: 'polyline', paths: coordinates, spatialReference };
  if (type === 'Polygon') return { type: 'polygon', rings: coordinates, spatialReference };
  throw new Error(type);
}

export async function saveShapefile(geometry) {
  const features = [{ type: 'Feature', geometry: toGeoJson(geometry), properties: {} }];
  const zip = await shpwrite.zip({ type: 'FeatureCollection', features }, { outputType: 'blob', types: FILE_NAMES });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(zip);
  link.download = 'drawing.zip';
  link.click();
}

export async function loadShapefile(file) {
  try {
    const { features } = await shp(await file.arrayBuffer());
    return fromGeoJson(features[0].geometry);
  } catch {
    throw new Error('تعذر قراءة الرسم. اختر ملف zip تم حفظه من زر "حفظ الرسم".');
  }
}
