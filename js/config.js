export const SERVICE_URL = 'https://maps.orc.govt.nz/arcgis/rest/services/PropertyExternal/MapServer';

// The backend API (backend/OtagoApi.slnx), run from Visual Studio
export const API_URL = 'http://localhost:5000/api';

export const LAYERS = {
  properties: 0, // ORC Properties (polygons)
  parcels: 1, // LINZ Primary Parcels (polygons)
  addresses: 2, // Street Address (points)
  roads: 3, // Roads (lines)
};

// The service data is in NZTM2000, in meters, so lengths and areas are measured in it
export const NZTM = { wkid: 2193 };

// The service extent, shown when the map opens
export const OTAGO_EXTENT = { xmin: 1210890, ymin: 4828530, xmax: 1453710, ymax: 5147079, spatialReference: NZTM };

// A land faces a road when it is within this distance (m) of it
export const ROAD_BUFFER_M = 15;

// How far (m) to look for the road of a land picked on the map.
// The second distance is used only when nothing is found within the first (remote rural land).
export const ROAD_SEARCH_M = [250, 5000];

export const LAND_TYPES = {
  property: 'عقار',
  parcel: 'قطعة أرض',
};

// Attributes shown in the land popup
export const POPUP_FIELDS = {
  property: {
    ValuationReference: 'رقم التقييم',
    LegalDescription: 'الوصف القانوني',
    CertificateOfTitle: 'رقم السند',
    RatingAuthority: 'المجلس المحلي',
    LandValue: 'قيمة الأرض (NZD)',
    CapitalValue: 'القيمة الإجمالية (NZD)',
    Hectares: 'المساحة المسجلة (هكتار)',
  },
  parcel: {
    appellation: 'الوصف القانوني',
    titles: 'رقم السند',
    parcel_intent: 'نوع القطعة',
    land_district: 'المنطقة المساحية',
    survey_area: 'المساحة المسجلة (م²)',
    calc_area: 'المساحة المحسوبة (م²)',
  },
};
