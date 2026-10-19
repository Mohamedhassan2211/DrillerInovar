export const SERVICE_URL = 'https://maps.orc.govt.nz/arcgis/rest/services/PropertyExternal/MapServer';

export const API_URL = 'http://localhost:5000/api';

export const LAYERS = {
  properties: 0,
  parcels: 1,
  addresses: 2,
  roads: 3,
};

export const NZTM = { wkid: 2193 };

export const OTAGO_EXTENT = { xmin: 1210890, ymin: 4828530, xmax: 1453710, ymax: 5147079, spatialReference: NZTM };

export const ROAD_BUFFER_M = 15;

export const ROAD_SEARCH_M = [250, 5000];

export const LAND_TYPES = {
  property: 'عقار',
  parcel: 'قطعة أرض',
};

export const DRAWING_TYPES = {
  point: 'نقطة',
  polyline: 'خط',
  polygon: 'مضلع',
};

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
