const [areaOperator, lengthOperator, projectOperator] = await $arcgis.import([
  '@arcgis/core/geometry/operators/areaOperator.js',
  '@arcgis/core/geometry/operators/lengthOperator.js',
  '@arcgis/core/geometry/operators/projectOperator.js',
]);

await projectOperator.load();

// A vertex where the boundary turns less than this many degrees is not a corner.
// LINZ boundaries often have extra vertices on a straight line where neighbouring lots meet.
const CORNER_MIN_ANGLE = 1;

// The land is in NZTM, so these are planar measurements in meters and square meters
export function measureLand(polygon) {
  return {
    area: areaOperator.execute(polygon),
    perimeter: lengthOperator.execute(polygon),
    sides: polygon.rings.flatMap(ring => ringSides(ring)),
    center: polygon.extent.center,
  };
}

export function toWgs84(point) {
  return projectOperator.execute(point, { wkid: 4326 });
}

const distance = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);

// Splits a ring into sides that run from corner to corner. A curved side is measured along the curve.
function ringSides(ring) {
  // The last point of a ring repeats the first one. Drop it, along with any repeated vertex.
  const points = ring.slice(0, -1).filter((point, i, all) => i === 0 || distance(point, all[i - 1]) > 0.001);
  const count = points.length;
  const at = i => points[(i + count) % count];

  const indexes = points.map((_, i) => i);
  let corners = indexes.filter(i => turnAngle(at(i - 1), at(i), at(i + 1)) >= CORNER_MIN_ANGLE);
  if (corners.length < 2) corners = indexes; // a round shape has no real corners

  return corners.map((start, k) => {
    const end = corners[(k + 1) % corners.length];
    let length = 0;
    for (let i = start; i !== end; i = (i + 1) % count) {
      length += distance(at(i), at(i + 1));
    }
    return { from: points[start], to: points[end], length };
  });
}

// How much the boundary turns at `point`, in degrees (0 = it goes straight on)
function turnAngle(prev, point, next) {
  const before = Math.atan2(point[1] - prev[1], point[0] - prev[0]);
  const after = Math.atan2(next[1] - point[1], next[0] - point[0]);
  const angle = ((Math.abs(before - after) * 180) / Math.PI) % 360;
  return angle > 180 ? 360 - angle : angle;
}
