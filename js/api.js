import { SERVICE_URL, LAYERS, NZTM, ROAD_BUFFER_M, ROAD_SEARCH_M } from './config.js';

const [{ executeForIds, executeQueryJSON }, Polyline] = await $arcgis.import([
  '@arcgis/core/rest/query.js',
  '@arcgis/core/geometry/Polyline.js',
]);

// The server returns at most 1000 features per request, and its paging doesn't work with distance
// queries (a long road can have more than 1000 lands). So ask for the ids of all the matching
// features first, which has no limit, then load the features 1000 at a time.
async function query(layerId, { outFields = ['*'], ...filter }) {
  const url = `${SERVICE_URL}/${layerId}`;
  const ids = await executeForIds(url, filter);

  const batches = [];
  for (let i = 0; i < ids.length; i += 1000) {
    batches.push(executeQueryJSON(url, {
      objectIds: ids.slice(i, i + 1000),
      outFields,
      returnGeometry: true,
      outSpatialReference: NZTM,
    }));
  }
  const results = await Promise.all(batches);
  return results.flatMap(result => result.features);
}

const sqlText = value => `'${value.replace(/'/g, "''")}'`;

// Level 1: suburbs and localities, taken from the addresses. There are about 430, so one request is enough.
export async function getAreas() {
  const { features } = await executeQueryJSON(`${SERVICE_URL}/${LAYERS.addresses}`, {
    where: 'suburb_locality IS NOT NULL',
    outFields: ['suburb_locality', 'town_city'],
    returnDistinctValues: true,
    orderByFields: ['suburb_locality'],
  });

  return features.map(({ attributes }) => ({
    name: attributes.suburb_locality,
    city: attributes.town_city,
  }));
}

// Level 2: roads of the area.
// A road on the boundary of two areas has both names in `locality`, e.g. "Maryhill-Mornington".
// A road is stored as several segments, so they are joined into one line per name.
export async function getRoads(area) {
  const where = [
    `locality = ${sqlText(area.name)}`,
    `locality LIKE ${sqlText(`${area.name}-%`)}`,
    `locality LIKE ${sqlText(`%-${area.name}`)}`,
  ].join(' OR ');

  const features = await query(LAYERS.roads, { where, outFields: ['name'] });

  const paths = new Map();
  for (const { attributes, geometry } of features) {
    if (!attributes.name) continue;
    if (!paths.has(attributes.name)) paths.set(attributes.name, []);
    paths.get(attributes.name).push(...geometry.paths);
  }

  return [...paths.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, geometry: new Polyline({ paths: paths.get(name), spatialReference: NZTM }) }));
}

// Level 3: lands within ROAD_BUFFER_M of the road
export function getLandsAlongRoad(road) {
  return getLands({ geometry: road.geometry, distance: ROAD_BUFFER_M, units: 'meters' });
}

// Picking on the map: lands under the clicked point
export function getLandsAt(point) {
  return getLands({ geometry: point });
}

// Properties first, then parcels. The road reserve is a parcel too, so it is left out.
async function getLands(filter) {
  const [properties, parcels] = await Promise.all([
    query(LAYERS.properties, filter),
    query(LAYERS.parcels, { ...filter, where: "parcel_intent <> 'Road'" }),
  ]);

  const byLabel = (a, b) => a.label.localeCompare(b.label, 'en', { numeric: true });
  return [
    ...properties.map(feature => toLand(feature, 'property')).sort(byLabel),
    ...parcels.map(feature => toLand(feature, 'parcel')).sort(byLabel),
  ];
}

function toLand({ attributes: a, geometry }, type) {
  let label;
  if (type === 'property') {
    const street = a.StreetName === 'Unknown' ? '' : a.StreetName ?? '';
    label = `${a.HouseNumber ?? ''}${a.HouseNumberExtension ?? ''} ${street}`.trim()
      || a.ValuationReference || `Property ${a.OBJECTID}`;
  } else {
    label = a.appellation || `Parcel ${a.id}`;
  }
  return { type, id: a.OBJECTID, label, attributes: a, geometry };
}

// Picking on the map: road segments around the land, which tell its road and area (locate.js)
export async function getRoadsAround(land) {
  for (const distance of ROAD_SEARCH_M) {
    const features = await query(LAYERS.roads, {
      where: 'name IS NOT NULL',
      outFields: ['name', 'locality'],
      geometry: land.geometry,
      distance,
      units: 'meters',
    });

    if (features.length) {
      return features.map(({ attributes, geometry }) => ({
        name: attributes.name,
        locality: attributes.locality,
        geometry,
      }));
    }
  }
  return [];
}

// Level 4: addresses inside the land
export async function getAddressesInside(land) {
  const features = await query(LAYERS.addresses, {
    outFields: ['address_id', 'full_address'],
    geometry: land.geometry,
  });

  return features.map(({ attributes, geometry }) => ({
    id: attributes.address_id,
    label: attributes.full_address,
    point: geometry,
  }));
}
