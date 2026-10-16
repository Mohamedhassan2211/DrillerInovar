import { NZTM, API_URL } from './config.js';
import { toWgs84 } from './geometry.js';

const round = (value, digits = 2) => Number(value.toFixed(digits));
const roundPoint = ([x, y]) => [round(x, 3), round(y, 3)];

function inBothSystems(point) {
  const { latitude, longitude } = toWgs84(point);
  return {
    nztm: { x: round(point.x, 3), y: round(point.y, 3) },
    wgs84: { lat: round(latitude, 7), lng: round(longitude, 7) },
  };
}

export function buildLandRecord({ area, road, land, measurement, addresses }) {
  return {
    savedAt: new Date().toISOString(),
    spatialReference: {
      wkid: NZTM.wkid,
      name: 'NZGD2000 / New Zealand Transverse Mercator 2000',
      units: 'meters',
    },
    // A land picked on the map has no area when its road's locality is not in the area list,
    // and no road either when none is near it (locate.js)
    area: area?.name ?? null,
    road: road?.name ?? null,
    land: {
      type: land.type,
      objectId: land.id,
      label: land.label,
      attributes: land.attributes,
    },
    measurements: {
      areaM2: round(measurement.area),
      areaHa: round(measurement.area / 10000, 4),
      perimeterM: round(measurement.perimeter),
      sides: measurement.sides.map((side, i) => ({
        side: i + 1,
        lengthM: round(side.length),
        from: roundPoint(side.from),
        to: roundPoint(side.to),
      })),
    },
    center: inBothSystems(measurement.center),
    addresses: addresses.map(address => ({
      id: address.id,
      address: address.label,
      ...inBothSystems(address.point),
    })),
    geometry: { rings: land.geometry.rings.map(ring => ring.map(roundPoint)) },
  };
}

// Adds the record to backend/Data/lands.json through the API. Returns { count }, the number of saved lands.
export async function saveLandRecord(record) {
  let response;
  try {
    response = await fetch(`${API_URL}/lands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
  } catch {
    // fetch fails without a response when nothing is listening, i.e. the API is not running
    throw new Error('تعذر الاتصال بالـ API. شغّل مشروع الباك اند من Visual Studio ثم احفظ مرة أخرى.');
  }

  if (!response.ok) throw new Error(`الـ API رد بخطأ ${response.status}`);
  return response.json();
}
