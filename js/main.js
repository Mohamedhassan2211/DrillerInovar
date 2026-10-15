import * as api from './api.js';
import * as mapView from './mapView.js';
import { Autocomplete } from './autocomplete.js';
import { measureLand } from './geometry.js';
import { buildLandRecord, downloadJson } from './exporter.js';
import { LAND_TYPES } from './config.js';

const state = {
  area: null,
  road: null,
  land: null,
  measurement: null,
  addresses: [],
};

const statusBox = document.getElementById('status');
const saveButton = document.getElementById('save-json');

const areaInput = new Autocomplete(
  document.getElementById('area'),
  area => (area.city ? `${area.name}, ${area.city}` : area.name),
  selectArea
);
const roadInput = new Autocomplete(document.getElementById('road'), road => road.name, selectRoad);
const landInput = new Autocomplete(
  document.getElementById('land'),
  land => `${land.label} (${LAND_TYPES[land.type]})`,
  selectLand
);
const addressInput = new Autocomplete(
  document.getElementById('address'),
  address => address.label,
  mapView.showAddress
);

saveButton.addEventListener('click', saveLand);
loadAreas();

async function loadAreas() {
  setStatus('جاري تحميل المناطق...');
  try {
    const areas = await api.getAreas();
    areaInput.setItems(areas);
    setStatus(`${areas.length} منطقة. اكتب اسم المنطقة أو اخترها من القائمة.`);
  } catch (error) {
    showError(error);
  }
}

// Level 1 -> 2: roads inside the selected area
async function selectArea(area) {
  state.area = area;
  resetFrom(2);
  setStatus(`جاري تحميل طرق ${area.name}...`);

  try {
    const roads = await api.getRoads(area);
    if (state.area !== area) return; // another area was picked while loading

    roadInput.setItems(roads);
    mapView.showArea(roads);
    setStatus(roads.length ? `${roads.length} طريق في ${area.name}.` : `لا توجد طرق مسجلة في ${area.name}.`);
  } catch (error) {
    showError(error);
  }
}

// Level 2 -> 3: properties and parcels facing the selected road
async function selectRoad(road) {
  state.road = road;
  resetFrom(3);
  mapView.showRoad(road);
  setStatus(`جاري البحث عن العقارات على ${road.name}...`);

  try {
    const lands = await api.getLandsAlongRoad(road);
    if (state.road !== road) return;

    landInput.setItems(lands);
    setStatus(`${lands.length} عقار وقطعة على الطريق. اختر من القائمة.`);
  } catch (error) {
    showError(error);
  }
}

// Level 3 -> 4: load the addresses inside the land, then draw it with its measurements
async function selectLand(land) {
  resetFrom(4);
  state.land = land;
  setStatus('جاري البحث عن العناوين داخل الأرض...');

  try {
    const addresses = await api.getAddressesInside(land);
    if (state.land !== land) return;

    state.measurement = measureLand(land.rings);
    state.addresses = addresses;
    addressInput.setItems(addresses);
    mapView.showLand(land, state.measurement, addresses);
    saveButton.disabled = false;
    setStatus(`عدد الأضلاع ${state.measurement.sides.length}، وعدد العناوين داخل الأرض ${addresses.length}.`);
  } catch (error) {
    showError(error);
  }
}

function saveLand() {
  const fileName = `${state.land.type}-${state.land.id}.json`;
  downloadJson(buildLandRecord(state), fileName);
  setStatus(`تم حفظ البيانات في ${fileName}`);
}

// Clears the given level and every level after it
function resetFrom(level) {
  if (level <= 2) {
    state.road = null;
    roadInput.setItems([]);
    mapView.clear('road');
  }
  if (level <= 3) {
    landInput.setItems([]);
  }

  state.land = null;
  addressInput.setItems([]);
  mapView.clear('land');
  mapView.clear('address');
  saveButton.disabled = true;
}

function setStatus(text, isError = false) {
  statusBox.textContent = text;
  statusBox.classList.toggle('error', isError);
}

function showError(error) {
  console.error(error);
  setStatus(`حدث خطأ: ${error.message}`, true);
}
