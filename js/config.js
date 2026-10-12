export const SERVICE_URL = 'https://maps.orc.govt.nz/arcgis/rest/services/PropertyExternal/MapServer';

export const LAYERS = {
  properties: 0, // ORC Properties - polygons
  parcels: 1, // LINZ Primary Parcels - polygons
  addresses: 2, // Street Address - points
  roads: 3, // Roads - polylines
};

// The service stores its data in NZGD2000 / NZTM2000 (EPSG:2193): projected, in meters.
// Every query asks for this system so lengths and areas can be calculated in meters.
export const SERVICE_WKID = 2193;

// Service full extent in NZTM meters, used for the initial map view
export const OTAGO_EXTENT = { xmin: 1210890, ymin: 4828530, xmax: 1453710, ymax: 5147079 };

// A parcel counts as facing the road when it is within this distance (m) of the road centerline
export const ROAD_BUFFER_M = 15;

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
