import { NZTM } from './config.js';

const [areaOperator, intersectsOperator, lengthOperator, projectOperator] = await $arcgis.import([
  '@arcgis/core/geometry/operators/areaOperator.js',
  '@arcgis/core/geometry/operators/intersectsOperator.js',
  '@arcgis/core/geometry/operators/lengthOperator.js',
  '@arcgis/core/geometry/operators/projectOperator.js',
]);

await projectOperator.load();

const CORNER_MIN_ANGLE = 1;

export function measureLand(polygon) {
  return {
    area: areaOperator.execute(polygon),
    perimeter: lengthOperator.execute(polygon),
    sides: polygon.rings.flatMap(ring => ringSides(ring)),
    center: polygon.extent.center,
  };
}

export function measureSides(geometry) {
  if (geometry.type === 'point') return [];

  const nztm = projectOperator.execute(geometry, NZTM);
  const points = geometry.type === 'polygon' ? nztm.rings[0] : nztm.paths[0];
  return points.slice(1).map((to, i) => ({ from: points[i], to, length: distance(points[i], to) }));
}

export function toWgs84(point) {
  return projectOperator.execute(point, { wkid: 4326 });
}

export function intersects(polygon, drawing) {
  return intersectsOperator.execute(polygon, projectOperator.execute(drawing, NZTM));
}

const distance = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);

function ringSides(ring) {
  const points = ring.slice(0, -1).filter((point, i, all) => i === 0 || distance(point, all[i - 1]) > 0.001);
  const count = points.length;
  const at = i => points[(i + count) % count];

  const indexes = points.map((_, i) => i);
  let corners = indexes.filter(i => turnAngle(at(i - 1), at(i), at(i + 1)) >= CORNER_MIN_ANGLE);
  if (corners.length < 2) corners = indexes;

  return corners.map((start, k) => {
    const end = corners[(k + 1) % corners.length];
    let length = 0;
    for (let i = start; i !== end; i = (i + 1) % count) {
      length += distance(at(i), at(i + 1));
    }
    return { from: points[start], to: points[end], length };
  });
}

function turnAngle(prev, point, next) {
  const before = Math.atan2(point[1] - prev[1], point[0] - prev[0]);
  const after = Math.atan2(next[1] - point[1], next[0] - point[0]);
  const angle = ((Math.abs(before - after) * 180) / Math.PI) % 360;
  return angle > 180 ? 360 - angle : angle;
}
