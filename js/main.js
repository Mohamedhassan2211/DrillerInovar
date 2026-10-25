import * as api from './api.js';
import * as mapView from './mapView.js';
import { List } from './list.js';
import { measureLand, measureSides, intersects } from './geometry.js';
import { locateLand } from './locate.js';
import { buildLandRecord, saveLandRecord, saveMapImage } from './exporter.js';
import { saveShapefile, loadShapefile } from './shapefile.js';
import { LAND_TYPES, DRAWING_TYPES } from './config.js';

const state = {
  area: null,
  road: null,
  land: null,
  measurement: null,
  addresses: [],
};

const statusBox = document.getElementById('status');
const saveButton = document.getElementById('save-json');
const saveImageButton = document.getElementById('save-image');
const showImageButton = document.getElementById('show-image');
const pickButton = document.getElementById('pick-land');
const drawButton = document.getElementById('draw');
const convertButton = document.getElementById('convert');
const printButton = document.getElementById('print');
const resetLandButton = document.getElementById('reset-land');
const resetDrawingButton = document.getElementById('reset-drawing');
const saveDrawingButton = document.getElementById('save-drawing');
const loadDrawingButton = document.getElementById('load-drawing');
const drawingFile = document.getElementById('drawing-file');
const drawingBlock = document.getElementById('drawing');
const sidesList = document.getElementById('sides');

const areaList = new List('area', area => (area.city ? `${area.name}, ${area.city}` : area.name), selectArea);
const roadList = new List('road', road => road.name, selectRoad);
const landList = new List('land', land => `${land.label} (${LAND_TYPES[land.type]})`, selectLand);
const addressList = new List('address', address => address.label, mapView.showAddress);

let picking = false;
let drawing = false;
let converting = false;
let drawn = null;

saveButton.addEventListener('click', saveLand);
saveImageButton.addEventListener('click', saveImage);
pickButton.addEventListener('click', () => setPicking(!picking));
drawButton.addEventListener('click', () => (drawing ? finishDrawing() : startDrawing()));
convertButton.addEventListener('click', () => setConverting(!converting));
printButton.addEventListener('click', mapView.printMap);
resetLandButton.addEventListener('click', resetLand);
resetDrawingButton.addEventListener('click', resetDrawing);
saveDrawingButton.addEventListener('click', saveDrawing);
loadDrawingButton.addEventListener('click', () => drawingFile.click());
drawingFile.addEventListener('change', loadDrawing);
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

async function selectArea(area) {
  state.area = area;
  resetFrom(2);
  setStatus(`جاري تحميل طرق ${area.name}...`);

  try {
    const roads = await api.getRoads(area);
    if (state.area !== area) return;

    roadList.setItems(roads);
    mapView.showArea(roads);
    setStatus(roads.length ? `${roads.length} طريق في ${area.name}.` : `لا توجد طرق مسجلة في ${area.name}.`);
  } catch (error) {
    showError(error);
  }
}

async function selectRoad(road) {
  state.road = road;
  resetFrom(3);
  mapView.showRoad(road);
  setStatus(`جاري البحث عن العقارات على ${road.name}...`);

  try {
    const lands = await api.getLandsAlongRoad(road);
    if (state.road !== road) return;

    landList.setItems(lands);
    mapView.showRoadLands(lands);
    setStatus(`${lands.length} عقار وقطعة على الطريق. اختر من القائمة.`);
  } catch (error) {
    showError(error);
  }
}

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
    saveImageButton.disabled = false;
    setStatus(`عدد الأضلاع ${state.measurement.sides.length}، وعدد العناوين داخل الأرض ${addresses.length}.`);
  } catch (error) {
    showError(error);
  }
}

function setPicking(on) {
  picking = on;
  pickButton.kind = on ? 'danger' : 'brand';
  pickButton.textContent = on ? 'إلغاء التحديد' : 'تحديد الأرض من الخريطة';
  drawButton.disabled = on;
  loadDrawingButton.disabled = on;
  mapView.setPicking(on ? pickLand : drawn && openDrawnLand);
  setStatus(on ? 'قرّب الخريطة حتى تظهر حدود العقارات، ثم اضغط على الأرض.' : '');
}

async function pickLand(point) {
  setStatus('جاري البحث عن الأرض...');
  try {
    const [land] = await api.getLandsAt(point);
    if (!land) {
      setStatus('لا توجد أرض في هذا المكان. اضغط على أرض أخرى.');
      return;
    }
    setPicking(false);

    setStatus('جاري تحديد المنطقة والطريق...');
    const { area, road, nearest } = locateLand(land, await api.getRoadsAround(land), areaList.items);
    if (area) {
      await areaList.select(area);
      await roadList.select(roadList.items.find(item => item.name === road.name));
    } else {
      resetFrom(1);
      if (road) {
        roadList.setItems([road]);
        await roadList.select(road);
      }
    }

    let item = landList.items.find(item => item.type === land.type && item.id === land.id);
    if (!item) {
      item = land;
      landList.setItems([...landList.items, land]);
    }
    await landList.select(item);
    if (nearest) mapView.showNearestRoad(land, nearest);
  } catch (error) {
    showError(error);
  }
}

async function openDrawnLand(point) {
  setStatus('جاري البحث عن الأرض...');
  try {
    const [land] = (await api.getLandsAt(point)).filter(land => intersects(land.geometry, drawn));
    if (!land) {
      setStatus('لا توجد أرض داخل الرسم في هذا المكان. اضغط على أرض داخل الرسم أو تتقاطع معه.');
      return;
    }
    mapView.showLandPopup(land, measureLand(land.geometry), await api.getAddressesInside(land));
    setStatus(`${LAND_TYPES[land.type]}: ${land.label}`);
  } catch (error) {
    showError(error);
  }
}

function startDrawing() {
  drawn = null;
  saveDrawingButton.disabled = true;
  mapView.setPicking(null);
  setDrawing(true);
  showSides([]);
  mapView.startDrawing(drawingDone);
}

function finishDrawing() {
  mapView.finishDrawing();
  if (drawing) setDrawing(false);
}

function setDrawing(on) {
  drawing = on;
  drawButton.kind = on ? 'danger' : 'brand';
  drawButton.textContent = on ? 'إنهاء الرسم' : 'الرسم على الخريطة';
  pickButton.disabled = on;
  setStatus(on ? 'اضغط على الخريطة لإضافة النقاط، وللإنهاء اضغط مرتين على آخر نقطة أو اضغط "إنهاء الرسم".' : '');
}

function drawingDone(geometry) {
  setDrawing(false);
  drawn = geometry;
  mapView.setPicking(openDrawnLand);
  const sides = measureSides(geometry);
  mapView.showDrawingSides(sides);
  showSides(sides);
  saveDrawingButton.disabled = false;
  setStatus(`تم رسم ${DRAWING_TYPES[geometry.type]}. اضغط على أي أرض داخل الرسم أو تتقاطع معه لعرض بياناتها.`);
}

async function saveDrawing() {
  try {
    await saveShapefile(drawn);
    setStatus('تم حفظ الرسم في الملف drawing.zip.');
  } catch (error) {
    showError(error);
  }
}

async function loadDrawing() {
  const [file] = drawingFile.files;
  drawingFile.value = '';
  setStatus('جاري تحميل الرسم...');
  try {
    drawingDone(mapView.showSavedDrawing(await loadShapefile(file)));
  } catch (error) {
    showError(error);
  }
}

function resetLand() {
  if (picking) setPicking(false);
  resetFrom(1);
  setStatus('تم مسح الاختيارات.');
}

function resetDrawing() {
  drawn = null;
  saveDrawingButton.disabled = true;
  if (drawing) setDrawing(false);
  if (!picking) mapView.setPicking(null);
  mapView.clearDrawing();
  showSides([]);
  setStatus('تم مسح الرسم.');
}

function showSides(sides) {
  drawingBlock.hidden = !sides.length;
  sidesList.replaceChildren(...sides.map((side, i) => {
    const item = document.createElement('calcite-list-item');
    item.label = `الضلع ${i + 1}`;
    item.innerHTML = `<span slot="content-end">${side.length.toFixed(2)} م</span>`;
    item.addEventListener('calciteListItemSelect', () => mapView.showSide(side));
    return item;
  }));
}

function setConverting(on) {
  converting = on;
  convertButton.kind = on ? 'danger' : 'brand';
  convertButton.textContent = on ? 'إغلاق تحويل الإحداثيات' : 'تحويل الإحداثيات';
  mapView.setConverting(on);
  setStatus(on ? 'حرّك الماوس على الخريطة لتظهر إحداثياته بالنظامين، أو اضغط القلم واكتب إحداثيات لتحويلها (XY: خط الطول ثم خط العرض، NZTM: E ثم N).' : '');
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

async function saveImage() {
  const { land } = state;
  setStatus('جاري أخذ صورة الأرض...');
  try {
    const { imageUrl } = await saveMapImage(state.measurement.center);
    if (state.land !== land) return;

    showImageButton.href = imageUrl;
    showImageButton.hidden = false;
    setStatus('تم أخذ صورة الأرض وحفظ بياناتها في images.json. اضغط "عرض الصورة" لفتحها في تبويب جديد.');
  } catch (error) {
    showError(error);
  }
}

function resetFrom(level) {
  if (level <= 1) {
    state.area = null;
    areaList.setItems(areaList.items);
  }
  if (level <= 2) {
    state.road = null;
    roadList.setItems([]);
    mapView.clear('road');
    mapView.clear('areaRoads');
  }
  if (level <= 3) {
    landList.setItems([]);
    mapView.clear('roadLands');
  }

  state.land = null;
  addressList.setItems([]);
  mapView.clear('land');
  mapView.clear('address');
  saveButton.disabled = true;
  saveImageButton.disabled = true;
  showImageButton.hidden = true;
}

function setStatus(text, isError = false) {
  statusBox.textContent = text;
  statusBox.classList.toggle('error', isError);
}

function showError(error) {
  console.error(error);
  setStatus(`حدث خطأ: ${error.message}`, true);
}
