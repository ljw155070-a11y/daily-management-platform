let map = null;
let geocoder = null;
let editingId = null;
let clusterer = null;
let provincePolygons = [];
let provinceGeoData = [];

const placeList = Array.isArray(INITIAL_PLACES) ? [...INITIAL_PLACES] : [];
const markerMap = new Map();

document.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  bindEvents();
  fetch("/api/provinces")
    .then((r) => r.json())
    .then((geojson) => {
      provinceGeoData = geojson.features.map((f) => {
        const geo = f.geometry;
        let polygons = [];
        if (geo.type === "Polygon") {
          polygons = [geo.coordinates[0]];
        } else if (geo.type === "MultiPolygon") {
          polygons = geo.coordinates.map((p) => p[0]);
        }
        return { name: f.properties.name, polygons };
      });
    })
    .catch(() => {
      provinceGeoData = [];
    })
    .finally(() => waitForKakaoMap(50));
});

function waitForKakaoMap(retries) {
  if (!KAKAO_API_KEY) {
    document.getElementById("map").innerHTML =
      '<div class="map-no-key">' +
      "<strong>" +
      TEXT.mapMissingKeyTitle +
      "</strong>" +
      "<p>" +
      TEXT.mapMissingKeyBody +
      "</p>" +
      "</div>";
    return;
  }

  if (window.kakao && window.kakao.maps && window.kakao.maps.Map) {
    initMap();
    loadInitialMarkers();
    return;
  }

  if (retries <= 0) {
    document.getElementById("map").innerHTML =
      '<div class="map-no-key">' +
      "<strong>" +
      TEXT.mapFailedTitle +
      "</strong>" +
      "<p>" +
      TEXT.mapFailedBody +
      "</p>" +
      "</div>";
    return;
  }

  setTimeout(() => waitForKakaoMap(retries - 1), 200);
}

function initMap() {
  const container = document.getElementById("map");
  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(MAP_LAT, MAP_LNG),
    level: MAP_LEVEL,
    maxLevel: 12,
  });
  geocoder = new kakao.maps.services.Geocoder();

  const KR_BOUNDS = { minLat: 32.5, maxLat: 39.0, minLng: 123.5, maxLng: 132.0 };
  kakao.maps.event.addListener(map, "center_changed", () => {
    const center = map.getCenter();
    let lat = center.getLat();
    let lng = center.getLng();
    let clamped = false;
    if (lat < KR_BOUNDS.minLat) { lat = KR_BOUNDS.minLat; clamped = true; }
    if (lat > KR_BOUNDS.maxLat) { lat = KR_BOUNDS.maxLat; clamped = true; }
    if (lng < KR_BOUNDS.minLng) { lng = KR_BOUNDS.minLng; clamped = true; }
    if (lng > KR_BOUNDS.maxLng) { lng = KR_BOUNDS.maxLng; clamped = true; }
    if (clamped) map.setCenter(new kakao.maps.LatLng(lat, lng));
  });

  if (kakao.maps.MarkerClusterer) {
    clusterer = new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 8,
      styles: [
        {
          width: "44px",
          height: "44px",
          background: "rgba(74,108,247,0.88)",
          borderRadius: "50%",
          color: "#fff",
          fontSize: "14px",
          fontWeight: "700",
          lineHeight: "44px",
          textAlign: "center",
        },
      ],
    });
  }
}

function loadInitialMarkers() {
  placeList.forEach((place) => {
    if (place.latitude && place.longitude) addMarker(place);
  });
  drawProvinceOverlays();
}

function addMarker(place) {
  if (!map || !place.latitude || !place.longitude) return;

  const position = new kakao.maps.LatLng(place.latitude, place.longitude);
  const marker = new kakao.maps.Marker({ position });
  const infoContent =
    '<div style="padding:10px 14px;min-width:160px;font-size:13px;line-height:1.7">' +
    "<b>" +
    escHtml(place.placeName) +
    "</b>" +
    '<span style="margin-left:6px;font-size:11px;padding:1px 6px;border-radius:4px;' +
    (place.category === "RESTAURANT"
      ? 'background:#fef3c7;color:#d97706">'
      : 'background:#eef1fd;color:#4a6cf7">') +
    (place.category === "RESTAURANT" ? TEXT.restaurant : TEXT.destination) +
    "</span>" +
    '<br><span style="color:#9ca3af">' +
    escHtml(place.address) +
    "</span>" +
    (place.review ? "<br><span>" + escHtml(place.review) + "</span>" : "") +
    "</div>";

  const infowindow = new kakao.maps.InfoWindow({
    content: infoContent,
    removable: true,
  });
  kakao.maps.event.addListener(marker, "click", () =>
    infowindow.open(map, marker),
  );
  markerMap.set(place.id, { marker, infowindow });

  if (clusterer) clusterer.addMarker(marker);
  else marker.setMap(map);
}

function removeMarker(id) {
  const entry = markerMap.get(id);
  if (!entry) return;
  entry.infowindow.close();
  if (clusterer) clusterer.removeMarker(entry.marker);
  else entry.marker.setMap(null);
  markerMap.delete(id);
}

function updateMarker(place) {
  removeMarker(place.id);
  if (place.latitude && place.longitude) addMarker(place);
}

/* ── Province overlay ─────────────────────────────────── */

function extractProvince(address) {
  if (!address) return null;
  const rules = [
    ["서울", "서울특별시"],
    ["부산", "부산광역시"],
    ["대구", "대구광역시"],
    ["인천", "인천광역시"],
    ["광주", "광주광역시"],
    ["대전", "대전광역시"],
    ["울산", "울산광역시"],
    ["세종", "세종특별자치시"],
    ["경기", "경기도"],
    ["강원", "강원특별자치도"],
    ["충청북도", "충청북도"],
    ["충북", "충청북도"],
    ["충청남도", "충청남도"],
    ["충남", "충청남도"],
    ["전북특별자치도", "전북특별자치도"],
    ["전라북도", "전북특별자치도"],
    ["전북", "전북특별자치도"],
    ["전라남도", "전라남도"],
    ["전남", "전라남도"],
    ["경상북도", "경상북도"],
    ["경북", "경상북도"],
    ["경상남도", "경상남도"],
    ["경남", "경상남도"],
    ["제주", "제주특별자치도"],
  ];
  for (const [prefix, name] of rules) {
    if (address.startsWith(prefix)) return name;
  }
  return null;
}

function getVisitedProvinces() {
  const visited = new Set();
  placeList.forEach((p) => {
    const prov = extractProvince(p.address);
    if (prov) visited.add(prov);
  });
  return visited;
}

function drawProvinceOverlays() {
  provincePolygons.forEach((p) => p.setMap(null));
  provincePolygons = [];
  if (!map) return;

  const CITY_NAMES = new Set(['서울특별시','부산광역시','대구광역시','인천광역시',
    '광주광역시','대전광역시','울산광역시','세종특별자치시','제주특별자치도']);

  const visited = getVisitedProvinces();
  const sorted = [...provinceGeoData].sort((a, b) => {
    const aCity = CITY_NAMES.has(a.name) ? 1 : 0;
    const bCity = CITY_NAMES.has(b.name) ? 1 : 0;
    return aCity - bCity; // 도 먼저, 광역시 나중에
  });
  sorted.forEach((prov) => {
    if (!prov.polygons || !prov.polygons.length) return;
    const isVisited = visited.has(prov.name);

    const baseOpacity  = isVisited ? 0.35 : 0.20;
    const hoverOpacity = isVisited ? 0.60 : 0.42;

    prov.polygons.forEach((ring) => {
      const path = ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
      const polygon = new kakao.maps.Polygon({
        map,
        path,
        strokeWeight: isVisited ? 2 : 1,
        strokeColor: isVisited ? "#4a6cf7" : "#64748b",
        strokeOpacity: isVisited ? 1.0 : 0.7,
        fillColor: isVisited ? "#4a6cf7" : "#94a3b8",
        fillOpacity: baseOpacity,
      });

      kakao.maps.event.addListener(polygon, "click", () => {
        showProvinceToast(prov.name, isVisited);
      });
      kakao.maps.event.addListener(polygon, "mouseover", () => {
        polygon.setOptions({ fillOpacity: hoverOpacity, strokeWeight: isVisited ? 3 : 2 });
      });
      kakao.maps.event.addListener(polygon, "mouseout", () => {
        polygon.setOptions({ fillOpacity: baseOpacity, strokeWeight: isVisited ? 2 : 1 });
      });

      provincePolygons.push(polygon);
    });
  });
}

function showProvinceToast(provinceName, isVisited) {
  const places = placeList.filter(
    (p) => extractProvince(p.address) === provinceName,
  );
  const travel = places.filter((p) => p.category === "TRAVEL").length;
  const food = places.filter((p) => p.category === "RESTAURANT").length;

  const existing = document.getElementById("province-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "province-toast";

  if (isVisited) {
    toast.innerHTML =
      '<div style="font-size:14px;font-weight:700;margin-bottom:6px">' +
      escHtml(provinceName) +
      " ✅</div>" +
      '<div style="font-size:12px;color:#e0e7ff">총 ' +
      places.length +
      "곳 방문</div>" +
      '<div style="font-size:12px;margin-top:4px">✈ 여행지 ' +
      travel +
      "곳 &nbsp; 🍽 맛집 " +
      food +
      "곳</div>";
  } else {
    toast.innerHTML =
      '<div style="font-size:14px;font-weight:700;margin-bottom:4px">' +
      escHtml(provinceName) +
      "</div>" +
      '<div style="font-size:12px;opacity:0.85">아직 방문하지 않은 지역이에요</div>';
  }

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "36px",
    left: "50%",
    transform: "translateX(-50%)",
    background: isVisited ? "#4a6cf7" : "#475569",
    color: "#fff",
    padding: "14px 22px",
    borderRadius: "12px",
    fontSize: "13px",
    zIndex: "9999",
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    minWidth: "200px",
    textAlign: "center",
    transition: "opacity 0.3s",
  });

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ── Stats card ───────────────────────────────────────── */

function updateStats() {
  const visited = getVisitedProvinces();
  const travel = placeList.filter((p) => p.category === "TRAVEL").length;
  const food = placeList.filter((p) => p.category === "RESTAURANT").length;

  const el = (id) => document.getElementById(id);
  if (el("stat-provinces"))
    el("stat-provinces").innerHTML = visited.size + "<small>/17</small>";
  if (el("stat-total")) el("stat-total").textContent = placeList.length;
  if (el("stat-travel")) el("stat-travel").textContent = travel;
  if (el("stat-food")) el("stat-food").textContent = food;
}

/* ── History list ─────────────────────────────────────── */

function renderHistory() {
  const container = document.getElementById("history-list");
  const countEl = document.getElementById("history-count");
  if (countEl) countEl.textContent = placeList.length;
  updateStats();

  if (!placeList.length) {
    container.innerHTML =
      '<p class="history-empty">' + escHtml(TEXT.historyEmpty) + "</p>";
    return;
  }

  container.innerHTML = placeList
    .map((place) => {
      const isRestaurant = place.category === "RESTAURANT";
      return `
        <div class="history-item" data-id="${place.id}">
            <span class="history-icon">${isRestaurant ? "&#127860;" : "&#9992;"}</span>
            <div class="history-body">
                <span class="history-name">${escHtml(place.placeName)}
                    <span class="category-badge ${isRestaurant ? "badge-restaurant" : "badge-travel"}">
                        ${isRestaurant ? escHtml(TEXT.restaurant) : escHtml(TEXT.destination)}
                    </span>
                </span>
                <span class="history-addr">${escHtml(place.address)}</span>
            </div>
            <div class="history-meta">
                <span class="history-date">${place.createdAt || ""}</span>
                <div class="history-actions">
                    <button class="btn-history-edit" data-id="${place.id}" title="${escHtml(TEXT.editLabel)}">${escHtml(TEXT.editLabel)}</button>
                    <button class="btn-history-del" data-id="${place.id}" title="${escHtml(TEXT.deleteLabel)}">${escHtml(TEXT.deleteLabel)}</button>
                </div>
            </div>
        </div>`;
    })
    .join("");

  container.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => focusMarker(Number(item.dataset.id)));
  });
  container.querySelectorAll(".btn-history-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      editPlace(Number(btn.dataset.id));
    });
  });
  container.querySelectorAll(".btn-history-del").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deletePlace(Number(btn.dataset.id));
    });
  });
}

function focusMarker(id) {
  const place = placeList.find((item) => item.id === id);
  if (!map || !place || !place.latitude || !place.longitude) return;

  map.panTo(new kakao.maps.LatLng(place.latitude, place.longitude));
  map.setLevel(4);
  const entry = markerMap.get(id);
  if (entry) entry.infowindow.open(map, entry.marker);
}

function editPlace(id) {
  const place = placeList.find((p) => p.id === id);
  if (!place) return;

  editingId = id;

  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === place.category);
  });
  document.getElementById("fld-place-name").value = place.placeName || "";
  document.getElementById("fld-address").value = place.address || "";
  document.getElementById("fld-review").value = place.review || "";

  const saveBtn = document.getElementById("btn-save");
  const cancelBtn = document.getElementById("btn-cancel");
  const formTitle = document.querySelector(".panel-form-title span");
  saveBtn.textContent = TEXT.editButton;
  cancelBtn.style.display = "";
  if (formTitle) formTitle.textContent = TEXT.editFormTitle;

  document
    .querySelector(".panel-form")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindEvents() {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".category-btn")
        .forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("btn-addr-search").addEventListener("click", () => {
    new daum.Postcode({
      oncomplete(data) {
        document.getElementById("fld-address").value =
          data.roadAddress || data.jibunAddress;
      },
    }).open();
  });

  document.getElementById("btn-save").addEventListener("click", handleSubmit);
  document.getElementById("btn-cancel").addEventListener("click", resetForm);
}

async function handleSubmit() {
  const category = document.querySelector(".category-btn.active")?.dataset
    .value;
  const placeName = document.getElementById("fld-place-name").value.trim();
  const address = document.getElementById("fld-address").value.trim();
  const review = document.getElementById("fld-review").value.trim();

  if (!placeName) {
    showToast(TEXT.placeNameRequired);
    return;
  }
  if (!address) {
    showToast(TEXT.addressRequired);
    return;
  }

  const saveBtn = document.getElementById("btn-save");
  saveBtn.disabled = true;
  saveBtn.textContent = editingId ? TEXT.editing : TEXT.saving;

  let latitude = null;
  let longitude = null;

  if (geocoder) {
    const coords = await geocodeAddress(address);
    if (coords) {
      latitude = coords.lat;
      longitude = coords.lng;
    } else if (editingId) {
      const existing = placeList.find((p) => p.id === editingId);
      if (existing) {
        latitude = existing.latitude;
        longitude = existing.longitude;
      }
    }
  }

  const payload = { category, placeName, address, review, latitude, longitude };

  if (editingId) await handleUpdate(editingId, payload, saveBtn);
  else await handleSave(payload, saveBtn);
}

async function handleSave(payload, saveBtn) {
  try {
    const res = await fetch("/travel/places", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER]: CSRF_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("save failed");

    const saved = await res.json();
    placeList.unshift(saved);
    if (saved.latitude && saved.longitude) {
      addMarker(saved);
      if (map) {
        map.panTo(new kakao.maps.LatLng(saved.latitude, saved.longitude));
        map.setLevel(4);
      }
    }
    drawProvinceOverlays();
    renderHistory();
    resetForm();
    showToast(TEXT.saved, "success");
  } catch (err) {
    console.error("handleSave error:", err);
    showToast(TEXT.saveFailed);
    saveBtn.textContent = TEXT.saveButton;
  } finally {
    saveBtn.disabled = false;
  }
}

async function handleUpdate(id, payload, saveBtn) {
  try {
    const res = await fetch(`/travel/places/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER]: CSRF_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("update failed");

    const updated = await res.json();
    const idx = placeList.findIndex((p) => p.id === id);
    if (idx !== -1) placeList[idx] = updated;
    updateMarker(updated);
    drawProvinceOverlays();
    renderHistory();
    resetForm();
    showToast(TEXT.updated, "success");
  } catch (err) {
    console.error("handleUpdate error:", err);
    showToast(TEXT.updateFailed);
    saveBtn.textContent = TEXT.editButton;
  } finally {
    saveBtn.disabled = false;
  }
}

async function deletePlace(id) {
  if (!confirm(TEXT.confirmDelete)) return;

  try {
    const res = await fetch(`/travel/places/${id}`, {
      method: "DELETE",
      headers: { [CSRF_HEADER]: CSRF_TOKEN },
    });

    if (!res.ok) throw new Error("delete failed");

    removeMarker(id);
    const idx = placeList.findIndex((p) => p.id === id);
    if (idx !== -1) placeList.splice(idx, 1);
    if (editingId === id) resetForm();
    drawProvinceOverlays();
    renderHistory();
    showToast(TEXT.deleted, "success");
  } catch (err) {
    console.error("deletePlace error:", err);
    showToast(TEXT.deleteFailed);
  }
}

function geocodeAddress(address) {
  return new Promise((resolve) => {
    geocoder.addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result.length > 0) {
        resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
      } else {
        resolve(null);
      }
    });
  });
}

function resetForm() {
  editingId = null;
  document.getElementById("fld-place-name").value = "";
  document.getElementById("fld-address").value = "";
  document.getElementById("fld-review").value = "";
  document
    .querySelectorAll(".category-btn")
    .forEach((btn, i) => btn.classList.toggle("active", i === 0));

  const saveBtn = document.getElementById("btn-save");
  const cancelBtn = document.getElementById("btn-cancel");
  const formTitle = document.querySelector(".panel-form-title span");
  saveBtn.textContent = TEXT.saveButton;
  cancelBtn.style.display = "none";
  if (formTitle) formTitle.textContent = TEXT.formTitle;
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg, type = "error") {
  const existing = document.getElementById("toast-msg");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast-msg";
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "28px",
    left: "50%",
    transform: "translateX(-50%)",
    background: type === "success" ? "#22c55e" : "#ef4444",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "0.875rem",
    fontWeight: "600",
    zIndex: "9999",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    transition: "opacity 0.3s",
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}
