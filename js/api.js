import { SERVICE_URL, LAYERS, NZTM, ROAD_BUFFER_M, ROAD_SEARCH_M, PAGE_SIZE } from './config.js';

const [{ executeForIds, executeQueryJSON }, Polyline] = await $arcgis.import([
  '@arcgis/core/rest/query.js',
  '@arcgis/core/geometry/Polyline.js',
]);

async function query(layerId, { outFields = ['*'], ...filter }) {
  const url = `${SERVICE_URL}/${layerId}`;
  const options = { outFields, returnGeometry: true, outSpatialReference: NZTM };

  const [firstPage, ids] = await Promise.all([
    executeQueryJSON(url, { ...filter, ...options, num: PAGE_SIZE }),
    executeForIds(url, filter),
  ]);
  if (!firstPage.exceededTransferLimit) return firstPage.features;

  const pages = [];
  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    pages.push(executeQueryJSON(url, { ...options, objectIds: ids.slice(i, i + PAGE_SIZE) }));
  }
  const results = await Promise.all(pages);
  return results.flatMap(result => result.features);
}

const sqlText = value => `'${value.replace(/'/g, "''")}'`;

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

export function getLandsAlongRoad(road) {
  return getLands({ geometry: road.geometry, distance: ROAD_BUFFER_M, units: 'meters' });
}

export function getLandsAt(point) {
  return getLands({ geometry: point });
}

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
