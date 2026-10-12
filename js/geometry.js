// Measurements on NZTM coordinates. NZTM is projected and in meters,
// so plain planar math gives lengths in meters and areas in square meters.

// Where the boundary turns less than this, the vertex is not a corner.
// LINZ boundaries often have extra vertices on a straight line where neighbouring lots meet.
const CORNER_MIN_ANGLE = 1; // degrees

const distance = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);

export function measureLand(rings) {
  const sides = rings.flatMap(ring => ringSides(ring));
  return {
    sides,
    perimeter: sides.reduce((sum, side) => sum + side.length, 0),
    area: polygonArea(rings),
    center: boundsCenter(rings),
  };
}

// Splits a closed ring into sides that run from corner to corner
function ringSides(ring) {
  // Esri rings repeat the first point at the end. Drop it, along with any duplicate vertices.
  const points = ring.slice(0, -1).filter((point, i, all) => i === 0 || distance(point, all[i - 1]) > 0.001);
  const count = points.length;
  const at = i => points[(i + count) % count];

  // A round shape has no real corners, so every vertex becomes one
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

// Change of direction at `point` in degrees (0 = the line continues straight)
function turnAngle(prev, point, next) {
  const before = Math.atan2(point[1] - prev[1], point[0] - prev[0]);
  const after = Math.atan2(next[1] - point[1], next[0] - point[0]);
  const diff = ((Math.abs(before - after) * 180) / Math.PI) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Shoelace formula. Esri outer rings are clockwise and holes counter-clockwise,
// so summing the signed area of every ring subtracts the holes by itself.
function polygonArea(rings) {
  // NZTM values are in the millions; shifting to a local origin keeps the products precise
  const [ox, oy] = rings[0][0];
  let sum = 0;

  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = [ring[i][0] - ox, ring[i][1] - oy];
      const [x2, y2] = [ring[i + 1][0] - ox, ring[i + 1][1] - oy];
      sum += x1 * y2 - x2 * y1;
    }
  }
  return Math.abs(sum) / 2;
}

function boundsCenter(rings) {
  const points = rings.flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
