import { SERVICE_URL, SERVICE_WKID, LAYERS, ROAD_BUFFER_M } from './config.js';

// The server returns at most 1000 records per request, so keep paging until everything is loaded
async function query(layerId, params) {
  const features = [];
  while (true) {
    const body = new URLSearchParams({
      f: 'json',
      where: '1=1',
      outFields: '*',
      outSR: SERVICE_WKID,
      ...params,
      resultOffset: features.length,
    });

    const response = await fetch(`${SERVICE_URL}/${layerId}/query`, { method: 'POST', body });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || `Query failed on layer ${layerId}`);

    features.push(...data.features);
    if (!data.exceededTransferLimit || data.features.length === 0) return features;
  }
}

function spatialFilter(geometry, geometryType) {
  return {
    geometry: JSON.stringify(geometry),
    geometryType,
    inSR: SERVICE_WKID,
    spatialRel: 'esriSpatialRelIntersects',
  };
}

const sqlText = value => `'${String(value).replace(/'/g, "''")}'`;

// Level 1: suburbs / localities of Otago, taken from the address layer
export async function getAreas() {
  const features = await query(LAYERS.addresses, {
    where: 'suburb_locality IS NOT NULL',
    outFields: 'suburb_locality,town_city',
    returnDistinctValues: true,
    returnGeometry: false,
    orderByFields: 'suburb_locality',
  });

  return features.map(({ attributes }) => ({
    name: attributes.suburb_locality,
    city: attributes.town_city,
  }));
}

// Level 2: roads inside the area.
// A road on the boundary of two suburbs has both names in `locality`, e.g. "Maryhill-Mornington".
// A road is stored as several segments, so they are merged to list each name once.
export async function getRoads(area) {
  const where = [
    `locality = ${sqlText(area.name)}`,
    `locality LIKE ${sqlText(`${area.name}-%`)}`,
    `locality LIKE ${sqlText(`%-${area.name}`)}`,
  ].join(' OR ');

  const features = await query(LAYERS.roads, { where, outFields: 'name' });

  const roads = new Map();
  for (const { attributes, geometry } of features) {
    if (!attributes.name) continue;
    if (!roads.has(attributes.name)) roads.set(attributes.name, { name: attributes.name, paths: [] });
    roads.get(attributes.name).paths.push(...geometry.paths);
  }
  return [...roads.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Level 3: properties (layer 0) and parcels (layer 1) within ROAD_BUFFER_M of the road
export async function getLandsAlongRoad(road) {
  const filter = {
    ...spatialFilter({ paths: road.paths }, 'esriGeometryPolyline'),
    distance: ROAD_BUFFER_M,
    units: 'esriSRUnit_Meter',
  };

  const [properties, parcels] = await Promise.all([
    query(LAYERS.properties, filter),
    // The road reserve is a parcel too, so leave it out
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
  return { type, id: a.OBJECTID, label, attributes: a, rings: geometry.rings };
}

// Level 4: address points that fall inside the land
export async function getAddressesInside(land) {
  const features = await query(LAYERS.addresses, {
    outFields: 'address_id,full_address',
    ...spatialFilter({ rings: land.rings }, 'esriGeometryPolygon'),
  });

  return features.map(({ attributes, geometry }) => ({
    id: attributes.address_id,
    label: attributes.full_address,
    point: [geometry.x, geometry.y],
  }));
}
