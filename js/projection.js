// The service data and all measurements use EPSG:2193 (NZTM2000): projected, x/y in meters.
// Leaflet expects EPSG:4326 (WGS84): geographic, lat/lng in degrees.

proj4.defs(
  'EPSG:2193',
  '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 ' +
    '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

const nztm = proj4('EPSG:4326', 'EPSG:2193');

// Metric -> geographic: [x, y] -> [lat, lng]
export function toLatLng([x, y]) {
  const [lng, lat] = nztm.inverse([x, y]);
  return [lat, lng];
}
