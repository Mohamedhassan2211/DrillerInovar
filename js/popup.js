import { LAND_TYPES, POPUP_FIELDS } from './config.js';
import { toWgs84 } from './geometry.js';

// Unicode isolate marks work like dir="auto": English addresses and coordinates
// keep their order inside the Arabic popup
const isolate = text => `\u2068${text}\u2069`;

const formatNumber = (value, digits = 2) =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatNztm = point => `E ${point.x.toFixed(2)} / N ${point.y.toFixed(2)}`;

function formatWgs84(point) {
  const { latitude, longitude } = toWgs84(point);
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

// Builds a popup out of sections of [label, value] rows. Each section is shown as a table.
// The popup tables read their values from the graphic's attributes, so every row gets one.
function popup(title, sections) {
  const attributes = {};
  const content = sections.map(([sectionTitle, rows]) => ({
    type: 'fields',
    title: sectionTitle,
    fieldInfos: rows.map(([label, value]) => {
      const fieldName = `row${Object.keys(attributes).length}`;
      attributes[fieldName] = isolate(value);
      return { fieldName, label };
    }),
  }));
  return { attributes, popupTemplate: { title, content } };
}

export function landPopup(land, measurement, addresses) {
  const info = Object.entries(POPUP_FIELDS[land.type])
    .filter(([field]) => (land.attributes[field] ?? '') !== '')
    .map(([field, label]) => {
      const value = land.attributes[field];
      return [label, typeof value === 'number' ? value.toLocaleString('en-US') : value];
    });

  const addressRows = addresses.length
    ? addresses.map(address => ['العنوان', address.label])
    : [['العنوان', 'لا يوجد عنوان مسجل داخل الأرض']];

  return popup(`${LAND_TYPES[land.type]}: ${isolate(land.label)}`, [
    [null, [...addressRows, ...info]],
    ['القياسات', [
      ['المساحة', `${formatNumber(measurement.area)} م² (${formatNumber(measurement.area / 10000, 4)} هكتار)`],
      ['المحيط', `${formatNumber(measurement.perimeter)} م`],
      ['عدد الأضلاع', measurement.sides.length],
    ]],
    ['أطوال الأضلاع', measurement.sides.map((side, i) => [`الضلع ${i + 1}`, `${formatNumber(side.length)} م`])],
    ['الموقع (منتصف الأرض)', [
      ['NZTM2000', formatNztm(measurement.center)],
      ['WGS84', formatWgs84(measurement.center)],
    ]],
  ]);
}

export function addressPopup(address) {
  return popup(isolate(address.label), [
    [null, [
      ['NZTM2000', formatNztm(address.point)],
      ['WGS84', formatWgs84(address.point)],
    ]],
  ]);
}
