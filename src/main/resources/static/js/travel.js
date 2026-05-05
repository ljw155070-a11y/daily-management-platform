function getCsrfToken() {
  const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : CSRF_TOKEN;
}

let map = null;
let geocoder = null;
let editingId = null;
let clusterer = null;
let publicClusterer = null;
let provincePolygons = [];
let provinceGeoData = [];
let cityGeoData = [];
let currentBoundaryLevel = 'province';

const placeList = Array.isArray(INITIAL_PLACES) ? [...INITIAL_PLACES] : [];
const publicAttractions = [];
const allPublicAttractions = [];
const regionFetchCache = new Map(); // key: province, value: { data, expiry }
const REGION_CACHE_TTL_MS = 30 * 60 * 1000;
const PUBLIC_CARD_BATCH = 30;
let publicListRenderedCount = 0;
let publicListObserver = null;
const markerMap = new Map();
const publicMarkerMap = new Map();
let selectedMarkerOverlay = null;

let selectedPublicAttractionId = null;
let mapRegisterOverlay = null;
let lastPolygonClickMs = 0;
let regionLoadVersion = 0; // incremented on every loadAttractionsByRegion call; stale calls self-cancel
let selectedMapLatLng = null;
let selectedExistingImageUrl = "";

const REGION_ADDRESS_PREFIX_MAP = {
  "서울특별시": ["서울특별시", "서울"],
  "부산광역시": ["부산광역시", "부산"],
  "대구광역시": ["대구광역시", "대구"],
  "인천광역시": ["인천광역시", "인천"],
  "광주광역시": ["광주광역시", "광주"],
  "대전광역시": ["대전광역시", "대전"],
  "울산광역시": ["울산광역시", "울산"],
  "세종특별자치시": ["세종특별자치시", "세종"],
  "경기도": ["경기도", "경기"],
  "강원특별자치도": ["강원특별자치도", "강원도", "강원"],
  "충청북도": ["충청북도", "충북"],
  "충청남도": ["충청남도", "충남"],
  "전북특별자치도": ["전북특별자치도", "전라북도", "전북"],
  "전라남도": ["전라남도", "전남"],
  "경상북도": ["경상북도", "경북"],
  "경상남도": ["경상남도", "경남"],
  "제주특별자치도": ["제주특별자치도", "제주도", "제주"],
};

document.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  renderPublicAttractions();
  bindEvents();

  fetch("/api/provinces")
    .then((response) => (response.ok ? response.json() : { features: [] }))
    .then((geojson) => {
      provinceGeoData = Array.isArray(geojson.features)
        ? geojson.features.map((feature) => normalizeProvinceFeature(feature))
        : [];
    })
    .catch(() => {
      provinceGeoData = [];
    })
    .finally(() => {
      updateStats();
      waitForKakaoMap(50);
    });
});

function normalizeProvinceFeature(feature) {
  const geometry = feature.geometry || {};
  let polygons = [];

  if (geometry.type === "Polygon") {
    polygons = [geometry.coordinates[0]];
  } else if (geometry.type === "MultiPolygon") {
    polygons = geometry.coordinates.map((polygon) => polygon[0]);
  }

  return {
    name: feature.properties?.name || "",
    polygons,
  };
}

function waitForKakaoMap(retries) {
  const mapElement = document.getElementById("map");
  if (!mapElement) {
    return;
  }

  if (!KAKAO_API_KEY) {
    mapElement.innerHTML =
      '<div class="map-no-key"><strong>' +
      escHtml(TEXT.mapMissingKeyTitle) +
      "</strong><p>" +
      escHtml(TEXT.mapMissingKeyBody) +
      "</p></div>";
    return;
  }

  if (window.kakao && window.kakao.maps && window.kakao.maps.Map) {
    initMap();
    loadInitialMarkers();
    return;
  }

  if (retries <= 0) {
    mapElement.innerHTML =
      '<div class="map-no-key"><strong>' +
      escHtml(TEXT.mapFailedTitle) +
      "</strong><p>" +
      escHtml(TEXT.mapFailedBody) +
      "</p></div>";
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

  const bounds = { minLat: 32.5, maxLat: 39.0, minLng: 123.5, maxLng: 132.0 };
  kakao.maps.event.addListener(map, "center_changed", () => {
    const center = map.getCenter();
    let lat = center.getLat();
    let lng = center.getLng();
    let clamped = false;

    if (lat < bounds.minLat) {
      lat = bounds.minLat;
      clamped = true;
    }
    if (lat > bounds.maxLat) {
      lat = bounds.maxLat;
      clamped = true;
    }
    if (lng < bounds.minLng) {
      lng = bounds.minLng;
      clamped = true;
    }
    if (lng > bounds.maxLng) {
      lng = bounds.maxLng;
      clamped = true;
    }

    if (clamped) {
      map.setCenter(new kakao.maps.LatLng(lat, lng));
    }
  });

  kakao.maps.event.addListener(map, "click", (mouseEvent) => {
    hideMapRegisterOverlay();
    if (Date.now() - lastPolygonClickMs < 300) return; // 폴리곤 클릭 직후 map click 억제
    loadAttractionsByLocation(mouseEvent.latLng);
  });
  kakao.maps.event.addListener(map, "rightclick", (mouseEvent) => {
    showMapRegisterOverlay(mouseEvent.latLng);
  });

  if (kakao.maps.MarkerClusterer) {
    clusterer = new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 8,
      styles: [clusterStyle("#4a6cf7")],
    });

    publicClusterer = new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 8,
      styles: [clusterStyle("#f97316")],
    });
  }
}

function showMapRegisterOverlay(latLng) {
  if (!map) return;
  hideMapRegisterOverlay();

  const pin = document.createElement("div");
  pin.className = "map-register-pin";

  const menu = document.createElement("div");
  menu.className = "map-context-menu";

  // 장소 등록 버튼
  const regBtn = document.createElement("button");
  regBtn.type = "button";
  regBtn.className = "map-context-btn";
  regBtn.textContent = "📍 여기에 장소 등록";
  regBtn.addEventListener("click", () => preparePlaceFromMap(latLng));

  menu.appendChild(regBtn);

  const dot = document.createElement("div");
  dot.className = "map-register-dot";

  pin.appendChild(menu);
  pin.appendChild(dot);

  mapRegisterOverlay = new kakao.maps.CustomOverlay({
    position: latLng,
    xAnchor: 0.5,
    yAnchor: 1.0,
    content: pin,
    clickable: true,
  });
  mapRegisterOverlay.setMap(map);
}

function hideMapRegisterOverlay() {
  if (mapRegisterOverlay) {
    mapRegisterOverlay.setMap(null);
    mapRegisterOverlay = null;
  }
}

function clusterStyle(color) {
  return {
    width: "44px",
    height: "44px",
    background: color,
    borderRadius: "50%",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: "44px",
    textAlign: "center",
  };
}

function loadInitialMarkers() {
  placeList.forEach((place) => {
    if (place.latitude && place.longitude) {
      addSavedMarker(place);
    }
  });
  drawProvinceOverlays();
}

function addSavedMarker(place) {
  if (!map || !place.latitude || !place.longitude) {
    return;
  }

  const position = new kakao.maps.LatLng(place.latitude, place.longitude);
  const marker = new kakao.maps.Marker({ position });
  const infoContent = buildMapInfoWindowHtml({
    title: place.placeName,
    badgeLabel: place.category === "RESTAURANT" ? TEXT.restaurant : TEXT.destination,
    badgeClass: place.category === "RESTAURANT" ? "map-info-window__badge--restaurant" : "map-info-window__badge--travel",
    address: place.address,
    review: place.review,
    imageUrl: place.imageUrl,
  });

  const infowindow = new kakao.maps.InfoWindow({
    content: infoContent,
    removable: true,
    disableAutoPan: true,
  });

  kakao.maps.event.addListener(marker, "click", () => {
    openInfoWindowWithBounds(infowindow, marker, position);
    showMarkerFocus(position, "#4a6cf7");
  });
  markerMap.set(place.id, { marker, infowindow });

  if (clusterer) {
    clusterer.addMarker(marker);
  } else {
    marker.setMap(map);
  }
}

// Shared MarkerImage — created once and reused for every public attraction marker
let _publicMarkerImage = null;
function getPublicMarkerImage() {
  if (!_publicMarkerImage) {
    const svg = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">' +
        '<path fill="#f97316" d="M15 0C7.27 0 1 6.27 1 14c0 11.2 14 28 14 28s14-16.8 14-28C29 6.27 22.73 0 15 0z"/>' +
        '<circle cx="15" cy="14" r="6" fill="white"/>' +
      "</svg>"
    );
    _publicMarkerImage = new kakao.maps.MarkerImage(
      "data:image/svg+xml;charset=UTF-8," + svg,
      new kakao.maps.Size(30, 42),
      { offset: new kakao.maps.Point(15, 42) }
    );
  }
  return _publicMarkerImage;
}

// Creates marker + infowindow and stores in publicMarkerMap.
// nodraw=true: add to clusterer without triggering redraw (call clusterer.redraw() manually after batch).
// nodraw=false (default): add and redraw immediately (for single-marker additions).
function addPublicMarker(attraction, nodraw = false) {
  if (!map || !attraction.latitude || !attraction.longitude || publicMarkerMap.has(attraction.contentId)) {
    return;
  }

  const markerImage = getPublicMarkerImage();

  const position = new kakao.maps.LatLng(attraction.latitude, attraction.longitude);
  const marker = new kakao.maps.Marker({ position, image: markerImage });
  const infoContent = buildMapInfoWindowHtml({
    title: attraction.title,
    badgeLabel: "API",
    badgeClass: "map-info-window__badge--api",
    address: attraction.address || "",
    review: "",
    imageUrl: attraction.imageUrl,
  });

  const infowindow = new kakao.maps.InfoWindow({
    content: infoContent,
    removable: true,
    disableAutoPan: true,
  });

  kakao.maps.event.addListener(marker, "click", async () => {
    await ensurePublicAttractionPosition(attraction, true);
    const targetPosition = marker.getPosition();
    openInfoWindowWithBounds(infowindow, marker, targetPosition);
    showMarkerFocus(targetPosition, "#f97316");
    selectPublicAttraction(attraction.contentId, { pan: false, openInfo: false, scroll: true });
  });
  publicMarkerMap.set(attraction.contentId, { marker, infowindow });

  if (publicClusterer) {
    publicClusterer.addMarker(marker, nodraw);
  } else {
    marker.setMap(map);
  }
}

function removeSavedMarker(id) {
  const entry = markerMap.get(id);
  if (!entry) {
    return;
  }

  entry.infowindow.close();
  if (clusterer) {
    clusterer.removeMarker(entry.marker);
  } else {
    entry.marker.setMap(null);
  }
  markerMap.delete(id);
}

function buildMapInfoWindowHtml({ title, badgeLabel, badgeClass, address, review, imageUrl }) {
  const area  = extractSearchArea(address);
  const query = encodeURIComponent([area, title].filter(Boolean).join(" ").trim() || title || "");
  const urls  = {
    youtube: "https://www.youtube.com/results?search_query=" + query,
    naver:   "https://search.naver.com/search.naver?query=" + query,
    google:  "https://www.google.com/search?q=" + query,
  };

  return (
    '<div class="map-info-window">' +
    (imageUrl
      ? '<img class="map-info-window__image" src="' + escHtml(imageUrl) + '" alt="' + escHtml(title) + '">'
      : "") +
    '<div class="map-info-window__title-row"><b class="map-info-window__title">' +
    escHtml(title) +
    '</b><span class="map-info-window__badge ' + badgeClass + '">' +
    escHtml(badgeLabel) +
    "</span></div>" +
    '<div class="map-info-window__address-row">' +
    '<span class="map-info-window__address">' + escHtml(address || "") + '</span>' +
    (address
      ? '<button class="map-info-window__copy-btn" type="button" onclick="copyAddr(this,\'' +
        encodeURIComponent(address) + '\')">복사</button>'
      : "") +
    "</div>" +
    (review ? '<div class="map-info-window__review">' + escHtml(review) + "</div>" : "") +
    '<div class="map-info-window__search-row">' +
    '<span class="map-info-window__search-label">장소 리뷰 찾아보기</span>' +
    '<div class="map-info-window__search-icons">' +
    '<a class="map-info-window__search-btn" href="' + escHtml(urls.youtube) + '" target="_blank" rel="noopener noreferrer" title="유튜브 검색">' +
    '<img class="map-info-window__search-icon" src="/images/youtube.ico" alt="YouTube"></a>' +
    '<a class="map-info-window__search-btn" href="' + escHtml(urls.naver) + '" target="_blank" rel="noopener noreferrer" title="네이버 검색">' +
    '<img class="map-info-window__search-icon" src="/images/naver.ico" alt="Naver"></a>' +
    '<a class="map-info-window__search-btn" href="' + escHtml(urls.google) + '" target="_blank" rel="noopener noreferrer" title="구글 검색">' +
    '<img class="map-info-window__search-icon" src="/images/google.ico" alt="Google"></a>' +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

function extractSearchArea(address) {
  if (!address) {
    return "";
  }

  const tokens = String(address).trim().split(/\s+/);
  const guOrGun = tokens.find((token) => token.endsWith("구") || token.endsWith("군"));
  if (guOrGun) {
    return guOrGun;
  }

  const city = tokens.find((token) => token.endsWith("시"));
  return city || "";
}

function updateSavedMarker(place) {
  removeSavedMarker(place.id);
  if (place.latitude && place.longitude) {
    addSavedMarker(place);
  }
}

function extractProvince(address) {
  if (!address) {
    return null;
  }

  for (const [canonicalName, prefixes] of Object.entries(REGION_ADDRESS_PREFIX_MAP)) {
    if (prefixes.some((prefix) => String(address).startsWith(prefix))) {
      return canonicalName;
    }
  }

  return null;
}

function getVisitedProvinces() {
  const visited = new Set();
  placeList.forEach((place) => {
    const province = extractProvince(place.address);
    if (province) visited.add(province);
  });
  return visited;
}

function extractCity(address) {
  if (!address) return null;
  const m = String(address).match(
    /^(.+?(?:특별시|광역시|특별자치시|특별자치도|도))\s+(.+?(?:시|군|구))/
  );
  return m ? m[1] + ' ' + m[2] : null;
}

function getVisitedCities() {
  const visited = new Set();
  placeList.forEach((place) => {
    const city = extractCity(place.address);
    if (city) visited.add(city);
  });
  return visited;
}

function drawProvinceOverlays() {
  provincePolygons.forEach((polygon) => polygon.setMap(null));
  provincePolygons = [];
  if (!map) return;

  const isCity = currentBoundaryLevel === 'city';
  const geoData = isCity ? cityGeoData : provinceGeoData;
  if (!geoData.length) return;

  const visited = isCity ? getVisitedCities() : getVisitedProvinces();

  let sorted = [...geoData];
  if (!isCity) {
    const metroNames = new Set([
      "서울특별시", "부산광역시", "대구광역시", "인천광역시",
      "광주광역시", "대전광역시", "울산광역시", "세종특별자치시", "제주특별자치도",
    ]);
    sorted.sort((a, b) => (metroNames.has(a.name) ? 1 : 0) - (metroNames.has(b.name) ? 1 : 0));
  }

  sorted.forEach((region) => {
    if (!region.polygons || !region.polygons.length) return;

    const isVisited = visited.has(region.name);
    const baseOpacity  = isVisited ? 0.35 : 0.2;
    const hoverOpacity = isVisited ? 0.6  : 0.42;

    region.polygons.forEach((ring) => {
      const path = ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
      const polygon = new kakao.maps.Polygon({
        map,
        path,
        strokeWeight:  isVisited ? 2 : 1,
        strokeColor:   isVisited ? "#4a6cf7" : "#64748b",
        strokeOpacity: isVisited ? 1 : 0.7,
        fillColor:     isVisited ? "#4a6cf7" : "#94a3b8",
        fillOpacity:   baseOpacity,
      });

      kakao.maps.event.addListener(polygon, "click", () => {
        const now = Date.now();
        // 경계 근처 클릭 시 인접 폴리곤 click이 연속 발화하는 것을 막는다.
        // 첫 번째 폴리곤 click만 처리하고, 50ms 이내 중복 발화는 무시.
        if (now - lastPolygonClickMs < 50) return;
        lastPolygonClickMs = now;
        const normalizedRegionName = normalizeRegionName(region.name);
        showRegionToast(normalizedRegionName, isCity);
        loadAttractionsByRegion(normalizedRegionName);
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

function setBoundaryLevel(level) {
  if (currentBoundaryLevel === level) return;
  currentBoundaryLevel = level;

  document.getElementById('btn-level-province')?.classList.toggle('active', level === 'province');
  document.getElementById('btn-level-city')?.classList.toggle('active', level === 'city');

  if (level === 'city' && !cityGeoData.length) {
    const btn = document.getElementById('btn-level-city');
    if (btn) { btn.disabled = true; btn.textContent = '로딩 중...'; }

    fetch('/api/cities')
      .then((r) => r.ok ? r.json() : { features: [] })
      .then((geojson) => {
        cityGeoData = Array.isArray(geojson.features)
          ? geojson.features.map((f) => normalizeProvinceFeature(f))
          : [];
        drawProvinceOverlays();
        updateStats();
      })
      .catch(() => {
        currentBoundaryLevel = 'province';
        document.getElementById('btn-level-province')?.classList.add('active');
        document.getElementById('btn-level-city')?.classList.remove('active');
        showToast('시/군/구 경계 데이터를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = '시/군/구'; }
      });
  } else {
    drawProvinceOverlays();
    updateStats();
  }
}

function showRegionToast(regionName, isCityLevel) {
  const places = placeList.filter((place) =>
    isCityLevel
      ? extractCity(place.address) === regionName
      : extractProvince(place.address) === regionName
  );
  const travelCount = places.filter((p) => p.category === "TRAVEL").length;
  const foodCount   = places.filter((p) => p.category === "RESTAURANT").length;
  const isVisited   = places.length > 0;

  const displayName = isCityLevel
    ? regionName.replace(/^.+?(?:특별시|광역시|특별자치시|특별자치도|도)\s+/, '')
    : regionName;

  const existing = document.getElementById("province-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "province-toast";
  toast.innerHTML = isVisited
    ? '<div style="font-size:14px;font-weight:700;margin-bottom:6px">' +
      escHtml(displayName) + '</div>' +
      '<div style="font-size:12px;color:#e0e7ff">저장한 장소 ' + escHtml(String(places.length)) + '개</div>' +
      '<div style="font-size:12px;margin-top:4px">여행지 ' + escHtml(String(travelCount)) + '개 · 맛집 ' + escHtml(String(foodCount)) + '개</div>'
    : '<div style="font-size:14px;font-weight:700;margin-bottom:4px">' +
      escHtml(displayName) + '</div>' +
      '<div style="font-size:12px;opacity:0.85">' + escHtml(TEXT.provinceNoSaved) + '</div>';

  Object.assign(toast.style, {
    position: "fixed", bottom: "36px", left: "50%", transform: "translateX(-50%)",
    background: isVisited ? "#4a6cf7" : "#475569",
    color: "#fff", padding: "14px 22px", borderRadius: "12px",
    fontSize: "13px", zIndex: "9999",
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)", minWidth: "200px",
    textAlign: "center", transition: "opacity 0.3s",
  });

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const LEVEL_TIERS = [
  { min: 1,  max: 5,   title: "동네 산책자" },
  { min: 6,  max: 10,  title: "초보 여행자" },
  { min: 11, max: 20,  title: "지역 탐험가" },
  { min: 21, max: 35,  title: "문화 수집가" },
  { min: 36, max: 50,  title: "인사이트 여행자" },
  { min: 51, max: 70,  title: "세계 관찰자" },
  { min: 71, max: 90,  title: "전문 마스터" },
  { min: 91, max: 100, title: "월드 인플루언서" },
];

function getUserLevel() {
  const lv = Math.max(1, Math.min(placeList.length, 100));
  const tier = LEVEL_TIERS.find((t) => lv >= t.min && lv <= t.max) || LEVEL_TIERS[0];
  const progress = tier.max === tier.min ? 100
    : Math.round(((lv - tier.min) / (tier.max - tier.min)) * 100);
  return { lv, title: tier.title, progress, tierMax: tier.max };
}

function updateStats() {
  const isCity = currentBoundaryLevel === 'city';
  const visited = isCity ? getVisitedCities() : getVisitedProvinces();
  const total   = isCity ? cityGeoData.length || '?' : 17;
  const travelCount = placeList.filter((p) => p.category === "TRAVEL").length;
  const foodCount   = placeList.filter((p) => p.category === "RESTAURANT").length;

  setHtml("stat-provinces", `${visited.size}<small>/${total}</small>`);
  setText("stat-provinces-label", isCity ? "방문 시군구" : "방문 시도");
  setText("stat-total", String(placeList.length));
  setText("stat-travel", String(travelCount));
  setText("stat-food", String(foodCount));

  const { lv, title, progress } = getUserLevel();
  setText("stat-level-lv", `Lv.${lv}`);
  setText("stat-level-title", title);
  const bar = document.getElementById("stat-level-bar");
  if (bar) bar.style.width = `${progress}%`;
}

function renderHistory() {
  const container = document.getElementById("history-list");
  const countElement = document.getElementById("history-count");
  if (!container) {
    return;
  }

  if (countElement) {
    countElement.textContent = String(placeList.length);
  }
  updateStats();

  if (!placeList.length) {
    container.innerHTML = '<p class="history-empty">' + escHtml(TEXT.historyEmpty) + "</p>";
    return;
  }

  container.innerHTML = placeList
    .map((place) => {
      const restaurant = place.category === "RESTAURANT";
      return `
        <div class="history-item" data-id="${place.id}">
          ${place.imageUrl
            ? `<img class="history-thumb" src="${escHtml(place.imageUrl)}" alt="${escHtml(place.placeName)}">`
            : '<div class="history-thumb history-thumb--empty">IMG</div>'}
          <div class="history-body">
            <span class="history-name">${escHtml(place.placeName)}
              <span class="category-badge ${restaurant ? "badge-restaurant" : "badge-travel"}">
                ${escHtml(restaurant ? TEXT.restaurant : TEXT.destination)}
              </span>
            </span>
            <span class="history-addr">${escHtml(place.address)}</span>
          </div>
          <div class="history-meta">
            <span class="history-date">${escHtml(place.createdAt || "")}</span>
            <div class="history-actions">
              <button class="btn-history-edit" data-id="${place.id}" title="${escHtml(TEXT.editLabel)}">${escHtml(TEXT.editLabel)}</button>
              <button class="btn-history-del" data-id="${place.id}" title="${escHtml(TEXT.deleteLabel)}">${escHtml(TEXT.deleteLabel)}</button>
            </div>
          </div>
        </div>`;
    })
    .join("");

  container.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => focusSavedMarker(Number(item.dataset.id)));
  });
  container.querySelectorAll(".btn-history-edit").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      editPlace(Number(button.dataset.id));
    });
  });
  container.querySelectorAll(".btn-history-del").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deletePlace(Number(button.dataset.id));
    });
  });
}

function buildPublicCardHtml(attraction) {
  return `<div class="public-item ${String(attraction.contentId) === String(selectedPublicAttractionId) ? "is-active" : ""}" data-content-id="${escHtml(attraction.contentId)}">
    ${attraction.imageUrl
      ? `<img class="public-thumb" src="${escHtml(attraction.imageUrl)}" alt="${escHtml(attraction.title)}" loading="lazy">`
      : '<div class="public-thumb public-thumb--empty">TRIP</div>'}
    <div class="public-body">
      <span class="public-name">${escHtml(attraction.title)}</span>
      <span class="public-address">${escHtml(attraction.address || TEXT.publicNoAddress)}</span>
    </div>
  </div>`;
}

function bindPublicCardEvents(container) {
  container.querySelectorAll(".public-item").forEach((item) => {
    item.addEventListener("click", () => selectPublicAttraction(item.dataset.contentId, { pan: true, scroll: false }));
  });
}

function detachPublicListObserver() {
  if (publicListObserver) {
    publicListObserver.disconnect();
    publicListObserver = null;
  }
}

function attachPublicListObserver(container) {
  if (publicListRenderedCount >= publicAttractions.length) return;
  const sentinel = document.createElement("div");
  sentinel.className = "public-list-sentinel";
  container.appendChild(sentinel);
  publicListObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) appendMorePublicCards();
  }, { threshold: 0.1 });
  publicListObserver.observe(sentinel);
}

function appendMorePublicCards() {
  detachPublicListObserver();
  const container = document.getElementById("public-list");
  if (!container) return;
  const sentinel = container.querySelector(".public-list-sentinel");
  if (sentinel) sentinel.remove();

  const slice = publicAttractions.slice(publicListRenderedCount, publicListRenderedCount + PUBLIC_CARD_BATCH);
  const frag = document.createDocumentFragment();
  const tmp = document.createElement("div");
  tmp.innerHTML = slice.map(buildPublicCardHtml).join("");
  while (tmp.firstChild) frag.appendChild(tmp.firstChild);
  container.appendChild(frag);
  bindPublicCardEvents(container);
  publicListRenderedCount += slice.length;
  attachPublicListObserver(container);
}

function renderPublicAttractions() {
  const container = document.getElementById("public-list");
  if (!container) return;

  detachPublicListObserver();
  container.classList.remove("is-loading");

  if (!TOUR_API_ENABLED) {
    renderPublicPreview(null);
    container.innerHTML = '<p class="public-empty">' + escHtml(TEXT.publicApiMissing) + "</p>";
    return;
  }

  if (!publicAttractions.length) {
    renderPublicPreview(null);
    container.innerHTML = '<p class="public-empty">' + escHtml(TEXT.publicEmpty) + "</p>";
    return;
  }

  if (!publicAttractions.some((item) => String(item.contentId) === String(selectedPublicAttractionId))) {
    selectedPublicAttractionId = publicAttractions[0].contentId;
  }

  // Render first batch only — rest loads as user scrolls
  publicListRenderedCount = Math.min(PUBLIC_CARD_BATCH, publicAttractions.length);
  container.innerHTML = publicAttractions.slice(0, publicListRenderedCount).map(buildPublicCardHtml).join("");
  bindPublicCardEvents(container);

  renderPublicPreview(publicAttractions.find((item) => String(item.contentId) === String(selectedPublicAttractionId)) || null);

  attachPublicListObserver(container);
}

function renderPublicPreview(attraction) {
  const preview = document.getElementById("public-preview");
  if (!preview) {
    return;
  }

  if (!attraction) {
    preview.classList.remove("is-visible");
    preview.innerHTML = "";
    return;
  }

  preview.classList.add("is-visible");
  preview.innerHTML = `
    ${attraction.imageUrl
      ? `<img class="public-preview-image" src="${escHtml(attraction.imageUrl)}" alt="${escHtml(attraction.title)}">`
      : '<div class="public-preview-empty">TRIP</div>'}
    <div class="public-preview-body">
      <span class="public-preview-badge">추천 여행지</span>
      <p class="public-preview-title">${escHtml(attraction.title)}</p>
      <p class="public-preview-address">${escHtml(attraction.address || TEXT.publicNoAddress)}</p>
    </div>
  `;
}

async function focusSavedMarker(id) {
  const place = placeList.find((item) => item.id === id);
  if (!map || !place) {
    return;
  }

  await ensureSavedPlacePosition(place, true);
  if (!place.latitude || !place.longitude) {
    return;
  }

  const target = new kakao.maps.LatLng(place.latitude, place.longitude);
  map.setLevel(4);
  map.setCenter(target);
  showMarkerFocus(target, "#4a6cf7");
  const entry = markerMap.get(id);
  if (entry) {
    openInfoWindowWithBounds(entry.infowindow, entry.marker, target);
  }
}

async function ensureSavedPlacePosition(place, forceRefresh = false) {
  if (!place || !place.address || !geocoder || (!forceRefresh && place.positionVerified)) {
    return;
  }

  place.positionVerified = true;

  const coords = await geocodeAddress(place.address);
  if (!coords) {
    return;
  }

  const changed = place.latitude !== coords.lat || place.longitude !== coords.lng;
  place.latitude = coords.lat;
  place.longitude = coords.lng;

  const entry = markerMap.get(place.id);
  if (entry) {
    entry.marker.setPosition(new kakao.maps.LatLng(coords.lat, coords.lng));
  }

  if (changed) {
    drawProvinceOverlays();
  }
}

async function focusPublicAttraction(contentId) {
  const attraction = publicAttractions.find((item) => String(item.contentId) === String(contentId));
  if (!map || !attraction) {
    return;
  }

  await ensurePublicAttractionPosition(attraction, true);

  let target = null;
  const entry = publicMarkerMap.get(attraction.contentId);
  if (entry?.marker) {
    target = entry.marker.getPosition();
  } else {
    if (!attraction.latitude || !attraction.longitude) {
      return;
    }
    target = new kakao.maps.LatLng(attraction.latitude, attraction.longitude);
  }

  map.setLevel(6);
  map.setCenter(target);
  showMarkerFocus(target, "#f97316");
  if (entry) {
    openInfoWindowWithBounds(entry.infowindow, entry.marker, target);
  }
}

function showMarkerFocus(position, color) {
  if (!map || !position) {
    return;
  }

  if (selectedMarkerOverlay) {
    selectedMarkerOverlay.setMap(null);
    selectedMarkerOverlay = null;
  }

  const ring = document.createElement("div");
  ring.className = "map-marker-focus";
  ring.style.setProperty("--focus-color", color);

  selectedMarkerOverlay = new kakao.maps.CustomOverlay({
    position,
    xAnchor: 0.5,
    yAnchor: 1,
    content: ring,
    clickable: false,
  });
  selectedMarkerOverlay.setMap(map);
}

function openInfoWindowWithBounds(infowindow, marker, position) {
  infowindow.open(map, marker);
  window.requestAnimationFrame(() => keepInfoWindowInBounds(position));
}

function keepInfoWindowInBounds(position) {
  if (!map || !position) {
    return;
  }

  const projection = map.getProjection();
  if (!projection) {
    return;
  }

  const point = projection.containerPointFromCoords(position);
  if (!point) {
    return;
  }

  const mapElement = document.getElementById("map");
  const width = mapElement?.clientWidth || 0;
  const height = mapElement?.clientHeight || 0;
  if (!width || !height) {
    return;
  }

  const margins = {
    left: 170,
    right: 170,
    top: 180,
    bottom: 70,
  };

  let deltaX = 0;
  let deltaY = 0;

  if (point.x < margins.left) {
    deltaX = margins.left - point.x;
  } else if (point.x > width - margins.right) {
    deltaX = width - margins.right - point.x;
  }

  if (point.y < margins.top) {
    deltaY = margins.top - point.y;
  } else if (point.y > height - margins.bottom) {
    deltaY = height - margins.bottom - point.y;
  }

  if (deltaX !== 0 || deltaY !== 0) {
    map.panBy(-deltaX, -deltaY);
  }
}

function selectPublicAttraction(contentId, options = {}) {
  selectedPublicAttractionId = contentId;
  renderPublicAttractions();

  if (options.pan) {
    focusPublicAttraction(contentId);
  }

  if (options.scroll) {
    const item = document.querySelector(`.public-item[data-content-id="${CSS.escape(String(contentId))}"]`);
    item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

async function ensurePublicAttractionPosition(attraction, forceRefresh = false) {
  if (!attraction || !attraction.address || !geocoder || (!forceRefresh && attraction.positionVerified)) {
    return;
  }

  attraction.positionVerified = true;

  const coords = await geocodeAddress(attraction.address);
  if (!coords) {
    return;
  }

  attraction.latitude = coords.lat;
  attraction.longitude = coords.lng;

  const entry = publicMarkerMap.get(attraction.contentId);
  if (entry) {
    entry.marker.setPosition(new kakao.maps.LatLng(coords.lat, coords.lng));
  }
}

function openForm(modeTitle) {
  const overlay = document.getElementById("map-form-overlay");
  const formTitle = document.querySelector(".panel-form-title span");
  if (overlay) {
    overlay.classList.add("is-open");
  }
  if (formTitle) {
    formTitle.textContent = modeTitle;
  }
}

function closeForm() {
  const overlay = document.getElementById("map-form-overlay");
  if (overlay) {
    overlay.classList.remove("is-open");
  }
}

function editPlace(id) {
  const place = placeList.find((item) => item.id === id);
  if (!place) {
    return;
  }

  editingId = id;
  selectedMapLatLng = place.latitude && place.longitude ? { lat: place.latitude, lng: place.longitude } : null;
  selectedExistingImageUrl = place.imageUrl || "";

  document.querySelectorAll(".category-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === place.category);
  });
  document.getElementById("fld-place-name").value = place.placeName || "";
  document.getElementById("fld-address").value = place.address || "";
  document.getElementById("fld-review").value = place.review || "";
  document.getElementById("fld-image").value = "";

  renderPlaceImagePreview(selectedExistingImageUrl);

  const saveButton = document.getElementById("btn-save");
  const cancelButton = document.getElementById("btn-cancel");
  saveButton.textContent = TEXT.editButton;
  cancelButton.style.display = "";
  openForm(TEXT.editFormTitle);
}

async function preparePlaceFromMap(latLng) {
  resetForm({ keepClosed: true });
  selectedMapLatLng = {
    lat: latLng.getLat(),
    lng: latLng.getLng(),
  };
  hideMapRegisterOverlay();
  openForm(TEXT.formTitle);

  const addressInput = document.getElementById("fld-address");
  const nameInput = document.getElementById("fld-place-name");
  if (addressInput) {
    addressInput.value = TEXT.addressLoading;
  }

  const resolvedAddress = await reverseGeocode(latLng);
  if (addressInput) {
    addressInput.value = resolvedAddress || "";
  }

  if (!resolvedAddress) {
    showToast(TEXT.addressResolveFailed);
  } else {
    showToast(TEXT.placePrepared, "success");
  }

  nameInput?.focus();
}

function bindEvents() {
  document.querySelectorAll(".category-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".category-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  const searchButton = document.getElementById("btn-addr-search");
  if (searchButton) {
    searchButton.addEventListener("click", () => {
      new daum.Postcode({
        oncomplete(data) {
          document.getElementById("fld-address").value = data.roadAddress || data.jibunAddress || "";
        },
      }).open();
    });
  }

  const saveButton = document.getElementById("btn-save");
  const cancelButton = document.getElementById("btn-cancel");
  const closeButton = document.getElementById("btn-form-close");
  const imageInput = document.getElementById("fld-image");
  if (saveButton) {
    saveButton.addEventListener("click", handleSubmit);
  }
  if (cancelButton) {
    cancelButton.addEventListener("click", () => resetForm());
  }
  if (closeButton) {
    closeButton.addEventListener("click", () => resetForm());
  }
  if (imageInput) {
    imageInput.addEventListener("change", handleImageChange);
  }

  const syncButton = document.getElementById("btn-sync-public");
  if (syncButton) {
    syncButton.addEventListener("click", syncPublicAttractions);
  }
}


async function syncPublicAttractions() {
  const statusElement = document.getElementById("public-status");
  const syncButton = document.getElementById("btn-sync-public");
  if (!syncButton || !statusElement) {
    return;
  }

  if (!TOUR_API_ENABLED) {
    statusElement.textContent = TEXT.publicApiMissing;
    return;
  }

  syncButton.disabled = true;
  syncButton.textContent = TEXT.publicSyncing;
  setPublicLoadingState("전국 공공 여행지를 새로 모으고 있어요. 잠시만 기다려주세요.");

  try {
    const response = await fetch("/api/tourism/attractions/sync", {
      method: "POST",
      headers: {
        [CSRF_HEADER]: getCsrfToken(),
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || TEXT.publicFailed);
    }

    regionFetchCache.clear();
    statusElement.textContent = `${TEXT.publicSyncDone} 활성 ${data.activeCount ?? data.syncedCount ?? 0}건`;
    showToast(`${TEXT.publicSyncDone} (${data.syncedCount ?? 0}건)`, "success");
  } catch (error) {
    console.error("syncPublicAttractions error:", error);
    statusElement.textContent = error.message || TEXT.publicFailed;
    showToast(error.message || TEXT.publicFailed);
  } finally {
    clearPublicLoadingState();
    syncButton.disabled = false;
    syncButton.textContent = TEXT.publicSyncButton;
  }
}

function loadAttractionsByLocation(latLng) {
  if (!geocoder) { showToast("지도가 준비되지 않았습니다."); return; }

  geocoder.coord2RegionCode(latLng.getLng(), latLng.getLat(), (result, status) => {
    if (status !== kakao.maps.services.Status.OK || !result.length) {
      showToast("지역 정보를 가져오지 못했습니다.");
      return;
    }
    const h = result.find((r) => r.region_type === "H") || result[0];
    const regionName = currentBoundaryLevel === "city" && h.region_2depth_name
      ? h.region_1depth_name + " " + h.region_2depth_name
      : h.region_1depth_name;
    hideMapRegisterOverlay();
    loadAttractionsByRegion(regionName);
  });
}

async function loadAttractionsByRegion(regionName) {
  if (!TOUR_API_ENABLED) { showToast(TEXT.publicApiMissing); return; }

  const myVersion = ++regionLoadVersion;

  const normalizedRegionName = normalizeRegionName(regionName);
  const province = normalizedRegionName.includes(" ")
    ? normalizedRegionName.split(" ")[0]
    : normalizedRegionName;

  // Client-side cache: instant on re-click same region
  const hit = regionFetchCache.get(province);
  if (hit && Date.now() < hit.expiry) {
    if (myVersion !== regionLoadVersion) return; // superseded while reading cache
    await applyAttractionResult(hit.data, normalizedRegionName, myVersion, true);
    return;
  }

  setPublicLoadingState("이 지역에 여행갈 곳을 찾고 있어요\n잠시만 기다려주세요.");

  try {
    const res = await fetch("/api/tourism/attractions/region?province=" + encodeURIComponent(province));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || TEXT.publicFailed);

    if (myVersion !== regionLoadVersion) return; // newer click arrived while fetching

    regionFetchCache.set(province, { data, expiry: Date.now() + REGION_CACHE_TTL_MS });
    await applyAttractionResult(data, normalizedRegionName, myVersion, false);
  } catch (e) {
    if (myVersion !== regionLoadVersion) return;
    console.error("loadAttractionsByRegion error:", e);
    showToast(e.message || TEXT.publicFailed);
    const statusEl = document.getElementById("public-status");
    if (statusEl) statusEl.textContent = TEXT.publicFailed;
  } finally {
    if (myVersion === regionLoadVersion) clearPublicLoadingState();
  }
}

async function applyAttractionResult(data, normalizedRegionName, version, fromCache) {
  if (version !== regionLoadVersion) return;

  // 시/군/구 레벨(이름에 공백 포함)만 클라이언트 주소 필터 적용.
  // 도(province) 레벨은 서버가 area_code로 이미 정확히 필터링하므로 그대로 사용.
  const filtered = normalizedRegionName.includes(" ")
    ? filterAttractionsByRegion(data, normalizedRegionName)
    : (Array.isArray(data) ? data : []);
  publicAttractions.splice(0, publicAttractions.length, ...filtered);
  clearPublicMarkers();
  selectedPublicAttractionId = filtered[0]?.contentId ?? null;

  renderPublicAttractions();

  const statusEl = document.getElementById("public-status");
  if (statusEl) statusEl.textContent = `${normalizedRegionName} 여행지 ${filtered.length}개를 표시했습니다.`;
  showToast(`${normalizedRegionName} 여행지 ${filtered.length}개 표시`, "success");

  if (fromCache) clearPublicLoadingState();

  await renderPublicMarkersInBatches(filtered, version);
}

const CLEAN_REGION_ADDRESS_PREFIX_MAP = {
  "서울특별시": ["서울특별시", "서울"],
  "부산광역시": ["부산광역시", "부산"],
  "대구광역시": ["대구광역시", "대구"],
  "인천광역시": ["인천광역시", "인천"],
  "광주광역시": ["광주광역시", "광주"],
  "대전광역시": ["대전광역시", "대전"],
  "울산광역시": ["울산광역시", "울산"],
  "세종특별자치시": ["세종특별자치시", "세종"],
  "경기도": ["경기도", "경기"],
  "강원특별자치도": ["강원특별자치도", "강원도", "강원"],
  "충청북도": ["충청북도", "충북"],
  "충청남도": ["충청남도", "충남"],
  "전북특별자치도": ["전북특별자치도", "전라북도", "전북"],
  "전라남도": ["전라남도", "전남"],
  "경상북도": ["경상북도", "경북"],
  "경상남도": ["경상남도", "경남"],
  "제주특별자치도": ["제주특별자치도", "제주도", "제주"],
};

function getRegionAddressPrefixes(regionName) {
  const normalized = normalizeRegionName(regionName);
  if (!normalized) {
    return [];
  }

  if (normalized.includes(" ")) {
    return [normalized];
  }

  return CLEAN_REGION_ADDRESS_PREFIX_MAP[normalized] || [normalized];
}

function normalizeRegionName(regionName) {
  const normalized = String(regionName || "").trim();
  if (!normalized) {
    return "";
  }

  if (CLEAN_REGION_ADDRESS_PREFIX_MAP[normalized]) {
    return normalized;
  }

  for (const [canonicalName, prefixes] of Object.entries(CLEAN_REGION_ADDRESS_PREFIX_MAP)) {
    if (prefixes.includes(normalized)) {
      return canonicalName;
    }
  }

  return normalized;
}

async function loadAttractionsInBounds() {
  if (!map) return;
  if (!TOUR_API_ENABLED) { showToast(TEXT.publicApiMissing); return; }

  const btn = document.getElementById("btn-attract-bounds");
  const statusEl = document.getElementById("public-status");
  if (btn) { btn.disabled = true; btn.textContent = "불러오는 중..."; }

  try {
    if (!publicAttractions.length) {
      showToast("먼저 지도에서 지역을 클릭해 여행지를 불러오세요.");
      return;
    }

    const bounds = map.getBounds();
    const inBounds = publicAttractions.filter(
      (a) => a.latitude && a.longitude &&
        bounds.contain(new kakao.maps.LatLng(a.latitude, a.longitude))
    );

    clearPublicMarkers();
    inBounds.forEach(addPublicMarker);

    selectedPublicAttractionId = inBounds[0]?.contentId ?? null;
    renderPublicAttractions();

    if (statusEl) statusEl.textContent = `현재 화면 내 여행지 ${inBounds.length}개를 표시했습니다.`;
    showToast(`현재 범위 내 여행지 ${inBounds.length}개 표시`, "success");
  } catch (e) {
    console.error("loadAttractionsInBounds error:", e);
    showToast(e.message || TEXT.publicFailed);
  } finally {
    clearPublicLoadingState();
    if (btn) { btn.disabled = false; btn.textContent = "📍 현재 범위 여행지 추천"; }
  }
}

function filterAttractionsByRegion(attractions, regionName) {
  if (!Array.isArray(attractions)) {
    return [];
  }

  const prefixes = getRegionAddressPrefixes(regionName);
  return attractions.filter((item) => {
    if (!item?.address) {
      return false;
    }
    return prefixes.some((prefix) => item.address.startsWith(prefix));
  });
}

function getRegionAddressPrefixes(regionName) {
  const normalized = normalizeRegionName(regionName);
  if (!normalized) {
    return [];
  }

  if (normalized.includes(" ")) {
    return [normalized];
  }

  return REGION_ADDRESS_PREFIX_MAP[normalized] || [normalized];
}

function normalizeRegionName(regionName) {
  const normalized = String(regionName || "").trim();
  if (!normalized) {
    return "";
  }

  if (REGION_ADDRESS_PREFIX_MAP[normalized]) {
    return normalized;
  }

  for (const [canonicalName, prefixes] of Object.entries(REGION_ADDRESS_PREFIX_MAP)) {
    if (prefixes.includes(normalized)) {
      return canonicalName;
    }
  }

  return normalized;
}

function setPublicLoadingState(message) {
  const statusEl = document.getElementById("public-status");
  const listEl = document.getElementById("public-list");
  const previewEl = document.getElementById("public-preview");
  if (statusEl) {
    statusEl.textContent = message;
  }
    if (previewEl) {
      previewEl.classList.remove("is-visible");
      previewEl.innerHTML = "";
    }
    if (listEl) {
        listEl.classList.add("is-loading");
        listEl.innerHTML = `
          <div class="public-loading-card">
          <div class="public-loading-scene" aria-hidden="true">
            <svg class="public-loading-illustration" viewBox="0 0 180 110" role="presentation">
              <g class="public-loading-spark public-loading-spark--left">
                <rect x="22" y="46" width="18" height="10" rx="4"></rect>
              </g>
              <g class="public-loading-spark public-loading-spark--right">
                <rect x="142" y="42" width="16" height="10" rx="4"></rect>
              </g>
              <g class="public-loading-paper-piece public-loading-paper-piece--left">
                <rect x="34" y="32" width="18" height="12" rx="4"></rect>
              </g>
              <g class="public-loading-paper-piece public-loading-paper-piece--right">
                <rect x="130" y="28" width="18" height="12" rx="4"></rect>
              </g>

              <g class="public-loading-suitcase-lid">
                <rect x="52" y="42" width="76" height="20" rx="10"></rect>
              </g>
              <g class="public-loading-bunny-group">
                <ellipse class="public-loading-bunny-shadow" cx="92" cy="86" rx="31" ry="8"></ellipse>
                <ellipse class="public-loading-bunny-body" cx="92" cy="62" rx="24" ry="18"></ellipse>
                <ellipse class="public-loading-bunny-head" cx="92" cy="48" rx="15" ry="13"></ellipse>
                <rect class="public-loading-bunny-ear" x="80" y="20" width="9" height="24" rx="5"></rect>
                <rect class="public-loading-bunny-ear public-loading-bunny-ear--right" x="96" y="18" width="9" height="26" rx="5"></rect>
                <rect class="public-loading-bunny-ear-inner" x="83" y="24" width="3" height="14" rx="2"></rect>
                <rect class="public-loading-bunny-ear-inner" x="99" y="22" width="3" height="16" rx="2"></rect>
                <circle class="public-loading-bunny-eye" cx="87" cy="48" r="1.8"></circle>
                <circle class="public-loading-bunny-eye" cx="97" cy="48" r="1.8"></circle>
                <circle class="public-loading-bunny-nose" cx="92" cy="53" r="1.7"></circle>
                <rect class="public-loading-bunny-paw public-loading-bunny-paw--left" x="69" y="65" width="15" height="8" rx="4"></rect>
                <rect class="public-loading-bunny-paw public-loading-bunny-paw--right" x="100" y="64" width="15" height="8" rx="4"></rect>
                <circle class="public-loading-bunny-tail" cx="113" cy="63" r="6"></circle>
              </g>
              <g class="public-loading-suitcase-base">
                <rect x="48" y="62" width="84" height="26" rx="12"></rect>
                <rect x="80" y="56" width="20" height="8" rx="4"></rect>
              </g>
            </svg>
          </div>
          <div class="public-loading-title">${escHtml(message)}</div>
          <div class="public-loading-subtitle">가방을 뒤적이며 여행지를 고르고 있어요...</div>
        </div>
      `;
  }
}

function clearPublicLoadingState() {
  const listEl = document.getElementById("public-list");
  listEl?.classList.remove("is-loading");
  if (listEl?.querySelector(".public-loading-card")) {
    listEl.innerHTML = "";
  }
}

function clearPublicMarkers() {
  publicMarkerMap.forEach((entry) => entry.infowindow.close());
  if (publicClusterer) {
    const markers = [...publicMarkerMap.values()].map((e) => e.marker);
    if (markers.length > 0) {
      markers.forEach((m, i) => publicClusterer.removeMarker(m, i < markers.length - 1));
    }
  } else {
    publicMarkerMap.forEach((entry) => entry.marker.setMap(null));
  }
  publicMarkerMap.clear();
}

function nextFrame() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

async function renderPublicMarkersInBatches(attractions, version, batchSize = 50) {
  for (let i = 0; i < attractions.length; i += batchSize) {
    if (version !== regionLoadVersion) return;
    attractions.slice(i, i + batchSize).forEach((a) => addPublicMarker(a, true));
    await nextFrame();
  }
  if (version !== regionLoadVersion) return;
  if (publicClusterer) publicClusterer.redraw();
}

function handleImageChange() {
  const input = document.getElementById("fld-image");
  const file = input?.files?.[0];
  if (!file) {
    renderPlaceImagePreview(selectedExistingImageUrl);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    renderPlaceImagePreview(reader.result);
  };
  reader.readAsDataURL(file);
}

async function handleSubmit() {
  const category = document.querySelector(".category-btn.active")?.dataset.value || "TRAVEL";
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

  const saveButton = document.getElementById("btn-save");
  saveButton.disabled = true;
  saveButton.textContent = editingId ? TEXT.editing : TEXT.saving;

  let latitude = null;
  let longitude = null;
  if (geocoder) {
    const coords = await geocodeAddress(address);
    if (coords) {
      latitude = coords.lat;
      longitude = coords.lng;
    }
  }
  if ((latitude === null || longitude === null) && selectedMapLatLng) {
    latitude = selectedMapLatLng.lat;
    longitude = selectedMapLatLng.lng;
  }
  if ((latitude === null || longitude === null) && editingId) {
    const existing = placeList.find((place) => place.id === editingId);
    if (existing) {
      latitude = existing.latitude;
      longitude = existing.longitude;
    }
  }

  const formData = new FormData();
  formData.append("category", category);
  formData.append("placeName", placeName);
  formData.append("address", address);
  formData.append("review", review);
  if (latitude !== null && latitude !== undefined) {
    formData.append("latitude", String(latitude));
  }
  if (longitude !== null && longitude !== undefined) {
    formData.append("longitude", String(longitude));
  }
  const imageFile = document.getElementById("fld-image").files?.[0];
  if (imageFile) {
    formData.append("imageFile", imageFile);
  }

  if (editingId) {
    await handleUpdate(editingId, formData, saveButton);
  } else {
    await handleSave(formData, saveButton);
  }
}

async function handleSave(formData, saveButton) {
  try {
    const response = await fetch("/travel/places", {
      method: "POST",
      headers: {
        [CSRF_HEADER]: getCsrfToken(),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("save failed");
    }

    const saved = await response.json();
    placeList.unshift(saved);
    if (saved.latitude && saved.longitude) {
      addSavedMarker(saved);
      if (map) {
        const target = new kakao.maps.LatLng(saved.latitude, saved.longitude);
        map.setLevel(4);
        map.setCenter(target);
      }
    }
    drawProvinceOverlays();
    renderHistory();
    resetForm();
    showToast(TEXT.saved, "success");
  } catch (error) {
    console.error("handleSave error:", error);
    showToast(TEXT.saveFailed);
    saveButton.textContent = TEXT.saveButton;
  } finally {
    saveButton.disabled = false;
  }
}

async function handleUpdate(id, formData, saveButton) {
  try {
    const response = await fetch(`/travel/places/${id}`, {
      method: "PATCH",
      headers: {
        [CSRF_HEADER]: getCsrfToken(),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("update failed");
    }

    const updated = await response.json();
    const index = placeList.findIndex((place) => place.id === id);
    if (index !== -1) {
      placeList[index] = updated;
    }
    updateSavedMarker(updated);
    drawProvinceOverlays();
    renderHistory();
    resetForm();
    showToast(TEXT.updated, "success");
  } catch (error) {
    console.error("handleUpdate error:", error);
    showToast(TEXT.updateFailed);
    saveButton.textContent = TEXT.editButton;
  } finally {
    saveButton.disabled = false;
  }
}

async function deletePlace(id) {
  if (!confirm(TEXT.confirmDelete)) {
    return;
  }

  try {
    const response = await fetch(`/travel/places/${id}`, {
      method: "DELETE",
      headers: { [CSRF_HEADER]: CSRF_TOKEN },
    });

    if (!response.ok) {
      throw new Error("delete failed");
    }

    removeSavedMarker(id);
    const index = placeList.findIndex((place) => place.id === id);
    if (index !== -1) {
      placeList.splice(index, 1);
    }
    if (editingId === id) {
      resetForm();
    }
    drawProvinceOverlays();
    renderHistory();
    showToast(TEXT.deleted, "success");
  } catch (error) {
    console.error("deletePlace error:", error);
    showToast(TEXT.deleteFailed);
  }
}

function geocodeAddress(address) {
  return new Promise((resolve) => {
    if (!geocoder) {
      resolve(null);
      return;
    }

    geocoder.addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result.length > 0) {
        resolve({
          lat: parseFloat(result[0].y),
          lng: parseFloat(result[0].x),
        });
      } else {
        resolve(null);
      }
    });
  });
}

function reverseGeocode(latLng) {
  return new Promise((resolve) => {
    if (!geocoder) {
      resolve("");
      return;
    }

    geocoder.coord2Address(latLng.getLng(), latLng.getLat(), (result, status) => {
      if (status === kakao.maps.services.Status.OK && result.length > 0) {
        const address = result[0].road_address?.address_name || result[0].address?.address_name || "";
        resolve(address);
      } else {
        resolve("");
      }
    });
  });
}


function renderPlaceImagePreview(imageUrlOrDataUrl) {
  const preview = document.getElementById("place-image-preview");
  if (!preview) {
    return;
  }

  if (!imageUrlOrDataUrl) {
    preview.classList.remove("is-visible");
    preview.innerHTML = "";
    return;
  }

  preview.classList.add("is-visible");
  preview.innerHTML = `<img src="${escHtml(imageUrlOrDataUrl)}" alt="${escHtml(TEXT.imageLabel)}">`;
}

function resetForm(options = {}) {
  editingId = null;
  selectedMapLatLng = null;
  selectedExistingImageUrl = "";

  document.getElementById("fld-place-name").value = "";
  document.getElementById("fld-address").value = "";
  document.getElementById("fld-review").value = "";
  document.getElementById("fld-image").value = "";

  document.querySelectorAll(".category-btn").forEach((button, index) => {
    button.classList.toggle("active", index === 0);
  });

  renderPlaceImagePreview("");

  const saveButton = document.getElementById("btn-save");
  const cancelButton = document.getElementById("btn-cancel");
  const formTitle = document.querySelector(".panel-form-title span");
  saveButton.textContent = TEXT.saveButton;
  cancelButton.style.display = "none";
  if (formTitle) {
    formTitle.textContent = TEXT.formTitle;
  }
  if (!options.keepClosed) {
    closeForm();
  }
}

function escHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, type = "error") {
  const existing = document.getElementById("toast-msg");
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = "toast-msg";
  toast.textContent = message;
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

function copyAddr(btn, encoded) {
  const text = decodeURIComponent(encoded);
  navigator.clipboard.writeText(text).then(function () {
    btn.textContent = "✓";
    setTimeout(function () { btn.textContent = "복사"; }, 1500);
  }).catch(function () {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); btn.textContent = "✓"; setTimeout(function () { btn.textContent = "복사"; }, 1500); }
    catch (_) { btn.textContent = "실패"; }
    document.body.removeChild(ta);
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setHtml(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.innerHTML = value;
  }
}
