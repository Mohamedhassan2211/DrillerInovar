import { ROAD_BUFFER_M } from './config.js';

const distanceOperator = await $arcgis.import('@arcgis/core/geometry/operators/distanceOperator.js');

// The road and area of a land picked on the map, found from the roads around it (api.getRoadsAround)
// rather than its addresses, so a land with no address gets them too. `areas` is the area list.
export function locateLand(land, roads, areas) {
  if (!roads.length) return { area: null, road: null };

  const byDistance = roads
    .map(road => ({ ...road, distance: distanceOperator.execute(land.geometry, road.geometry) }))
    .sort((a, b) => a.distance - b.distance);

  // A land on a corner faces more than one road, and a land behind others faces none.
  // A property's StreetName tells which road it is on: one it faces if there are any, else any road around.
  const facing = byDistance.filter(road => road.distance <= ROAD_BUFFER_M);
  const candidates = facing.length ? facing : byDistance;
  const road = candidates.find(({ name }) => isStreetName(land.attributes.StreetName, name)) ?? candidates[0];

  // A road on the boundary of two areas has both names in `locality`, e.g. "Musselburgh-Saint Clair".
  // The land then takes the area of the nearest road around it that is in only one of them.
  const names = road.locality.split('-').filter(name => areas.some(area => area.name === name));
  const name = names.length > 1 ? byDistance.find(other => names.includes(other.locality))?.locality ?? names[0] : names[0];

  return { area: areas.find(area => area.name === name) ?? null, road };
}

// ORC properties shorten the street type, e.g. "Argyle St" or "Koreke LANE" for Argyle Street and Koreke Lane
function isStreetName(streetName, roadName) {
  if (!streetName) return false;
  const words = streetName.toLowerCase().split(' ');
  const name = roadName.toLowerCase();
  return words.length === 1 ? name === words[0] : name.startsWith(`${words.slice(0, -1).join(' ')} `);
}
