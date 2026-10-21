import { ROAD_BUFFER_M } from './config.js';

const distanceOperator = await $arcgis.import('@arcgis/core/geometry/operators/distanceOperator.js');

export function locateLand(land, roads, areas) {
  if (!roads.length) return { area: null, road: null, nearest: null };

  const byDistance = roads
    .map(road => ({ ...road, distance: distanceOperator.execute(land.geometry, road.geometry) }))
    .sort((a, b) => a.distance - b.distance);

  const facing = byDistance.filter(road => road.distance <= ROAD_BUFFER_M);
  const candidates = facing.length ? facing : byDistance;
  const road = candidates.find(({ name }) => isStreetName(land.attributes.StreetName, name)) ?? candidates[0];

  const names = road.locality.split('-').filter(name => areas.some(area => area.name === name));
  const name = names.length > 1 ? byDistance.find(other => names.includes(other.locality))?.locality ?? names[0] : names[0];

  return { area: areas.find(area => area.name === name) ?? null, road, nearest: byDistance[0] };
}

function isStreetName(streetName, roadName) {
  if (!streetName) return false;
  const words = streetName.toLowerCase().split(' ');
  const name = roadName.toLowerCase();
  return words.length === 1 ? name === words[0] : name.startsWith(`${words.slice(0, -1).join(' ')} `);
}
