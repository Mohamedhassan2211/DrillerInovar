import * as api from './api.js';
import * as mapView from './mapView.js';
import { List } from './list.js';
import { measureLand } from './geometry.js';
import { locateLand } from './locate.js';
import { buildLandRecord, saveLandRecord } from './exporter.js';
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
const pickButton = document.getElementById('pick-land');

const areaList = new List('area', area => (area.city ? `${area.name}, ${area.city}` : area.name), selectArea);
const roadList = new List('road', road => road.name, selectRoad);
const landList = new List('land', land => `${land.label} (${LAND_TYPES[land.type]})`, selectLand);
const addressList = new List('address', address => address.label, mapView.showAddress);

let picking = false;

saveButton.addEventListener('click', saveLand);
pickButton.addEventListener('click', () => setPicking(!picking));
loadAreas();

async function loadAreas() {
  setStatus('جاري تحميل المناطق...');
  try {
    const areas = await api.getAreas();
    areaList.setItems(areas);
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

    roadList.setItems(roads);
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

    landList.setItems(lands);
    setStatus(`${lands.length} عقار وقطعة على الطريق. اختر من القائمة.`);
  } catch (error) {
    showError(error);
  }
}

// Level 3 -> 4: the addresses inside the land, then the land on the map with its measurements
async function selectLand(land) {
  resetFrom(4);
  state.land = land;
  setStatus('جاري البحث عن العناوين داخل الأرض...');

  try {
    const addresses = await api.getAddressesInside(land);
    if (state.land !== land) return;

    state.measurement = measureLand(land.geometry);
    state.addresses = addresses;
    addressList.setItems(addresses);
    mapView.showLand(land, state.measurement, addresses);
    saveButton.disabled = false;
    setStatus(`عدد الأضلاع ${state.measurement.sides.length}، وعدد العناوين داخل الأرض ${addresses.length}.`);
  } catch (error) {
    showError(error);
  }
}

// Picking a land on the map instead of going through the lists. The button turns it on and off.
function setPicking(on) {
  picking = on;
  pickButton.kind = on ? 'danger' : 'brand';
  pickButton.textContent = on ? 'إلغاء التحديد' : 'تحديد الأرض من الخريطة';
  mapView.setPicking(on ? pickLand : null);
  setStatus(on ? 'قرّب الخريطة حتى تظهر حدود العقارات، ثم اضغط على الأرض.' : '');
}

// Finds the land under the clicked point, then picks its area, road and land in the lists
async function pickLand(point) {
  setStatus('جاري البحث عن الأرض...');
  try {
    const [land] = await api.getLandsAt(point); // a property if there is one, else the parcel
    if (!land) {
      setStatus('لا توجد أرض في هذا المكان. اضغط على أرض أخرى.');
      return;
    }
    setPicking(false);

    // The roads around the land give its area and road, whether or not it has an address
    setStatus('جاري تحديد المنطقة والطريق...');
    const { area, road } = locateLand(land, await api.getRoadsAround(land), areaList.items);
    if (area) {
      await areaList.select(area);
      // The area's list has the whole road, not only its segments around the land
      await roadList.select(roadList.items.find(item => item.name === road.name));
    } else {
      resetFrom(1);
      if (road) {
        roadList.setItems([road]);
        await roadList.select(road);
      }
    }

    // A land farther than ROAD_BUFFER_M from its road is not in the road's list
    let item = landList.items.find(item => item.type === land.type && item.id === land.id);
    if (!item) {
      item = land;
      landList.setItems([...landList.items, land]);
    }
    landList.select(item);
  } catch (error) {
    showError(error);
  }
}

async function saveLand() {
  setStatus('جاري الحفظ...');
  try {
    const { count } = await saveLandRecord(buildLandRecord(state));
    setStatus(`تم حفظ الأرض في lands.json، وعدد الأراضي المحفوظة الآن ${count}.`);
  } catch (error) {
    showError(error);
  }
}

// Clears the given level and every level after it
function resetFrom(level) {
  if (level <= 1) {
    state.area = null;
    areaList.setItems(areaList.items); // keeps the list, drops the choice
  }
  if (level <= 2) {
    state.road = null;
    roadList.setItems([]);
    mapView.clear('road');
  }
  if (level <= 3) {
    landList.setItems([]);
  }

  state.land = null;
  addressList.setItems([]);
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
