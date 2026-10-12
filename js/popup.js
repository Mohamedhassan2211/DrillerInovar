import { LAND_TYPES, POPUP_FIELDS } from './config.js';
import { toLatLng } from './projection.js';

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const formatNumber = (value, digits = 2) =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const row = (label, value) => `<tr><th>${label}</th><td dir="auto">${value}</td></tr>`;

// A service point (NZTM meters) written in each system
const formatNztm = ([x, y]) => `E ${x.toFixed(2)} / N ${y.toFixed(2)}`;

function formatWgs84(point) {
  const [lat, lng] = toLatLng(point);
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function landPopupHtml(land, measurement, addresses) {
  const info = Object.entries(POPUP_FIELDS[land.type])
    .filter(([field]) => (land.attributes[field] ?? '') !== '')
    .map(([field, label]) => {
      const value = land.attributes[field];
      return row(label, typeof value === 'number' ? value.toLocaleString('en-US') : escapeHtml(value));
    })
    .join('');

  const sides = measurement.sides
    .map((side, i) => `<tr><td>${i + 1}</td><td>${formatNumber(side.length)} م</td></tr>`)
    .join('');

  const addressText = addresses.length
    ? addresses.map(address => escapeHtml(address.label)).join('<br>')
    : 'لا يوجد عنوان مسجل داخل الأرض';

  return `
    <div class="land-popup">
      <h3>${LAND_TYPES[land.type]}: <bdi>${escapeHtml(land.label)}</bdi></h3>
      <table>${info}</table>

      <h4>القياسات</h4>
      <table>
        ${row('المساحة', `${formatNumber(measurement.area)} م² (${formatNumber(measurement.area / 10000, 4)} هكتار)`)}
        ${row('المحيط', `${formatNumber(measurement.perimeter)} م`)}
        ${row('عدد الأضلاع', measurement.sides.length)}
      </table>

      <h4>أطوال الأضلاع</h4>
      <table>
        <tr><th>الضلع</th><th>الطول</th></tr>
        ${sides}
      </table>

      <h4>العنوان</h4>
      <p dir="auto">${addressText}</p>

      <h4>الموقع (منتصف الأرض)</h4>
      <table>
        ${row('NZTM2000', formatNztm(measurement.center))}
        ${row('WGS84', formatWgs84(measurement.center))}
      </table>
    </div>`;
}

export function addressPopupHtml(address) {
  return `
    <div class="address-popup">
      <b>${escapeHtml(address.label)}</b><br>
      NZTM: ${formatNztm(address.point)}<br>
      WGS84: ${formatWgs84(address.point)}
    </div>`;
}
