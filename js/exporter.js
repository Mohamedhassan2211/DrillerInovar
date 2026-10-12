import { SERVICE_WKID } from './config.js';
import { toLatLng } from './projection.js';

const round = (value, digits = 2) => Number(value.toFixed(digits));
const roundPoint = ([x, y]) => [round(x, 3), round(y, 3)];

function inBothSystems(point) {
  const [lat, lng] = toLatLng(point);
  return {
    nztm: { x: round(point[0], 3), y: round(point[1], 3) },
    wgs84: { lat: round(lat, 7), lng: round(lng, 7) },
  };
}

export function buildLandRecord({ area, road, land, measurement, addresses }) {
  return {
    savedAt: new Date().toISOString(),
    spatialReference: {
      wkid: SERVICE_WKID,
      name: 'NZGD2000 / New Zealand Transverse Mercator 2000',
      units: 'meters',
    },
    area: area.name,
    road: road.name,
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
    geometry: { rings: land.rings.map(ring => ring.map(roundPoint)) },
  };
}

export function downloadJson(data, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
