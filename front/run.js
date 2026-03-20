const WX_URL  = "https://api.open-meteo.com/v1/forecast";
const GEO_URL = "https://nominatim.openstreetmap.org/reverse";

let currentUnit  = "C";//"celsius" or "fahrenheit"
let lastCoords   = null; //lat,lon
let weatherData  = null;//open-meteo
let leafletMap   = null;
let mapMarker    = null;

const $ = id => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(`screen-${name}`).classList.add("active");
}

function toF(c) { return (c * 9/5 + 32).toFixed(1); }
function displayTemp(c) {
  const val = currentUnit === "C" ? Math.round(c) : Math.round(toF(c));
  return `${val}°${currentUnit}`;
}

const WIND_DIRS = ["N","NE","L","SE","S","SO","O","NO"];
function windDir(deg) { return WIND_DIRS[Math.round(deg / 45) % 8]; }

//timeformat "00:00"
function fmtHour(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

//dateformat "Wed, 20 Mar"
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short"
  });
}

// WMO code
// Ref: https://open-meteo.com/en/docs#weathervariables
function wmoInfo(code) {
  const map = {
    0:  { emoji: "☀️",  desc: "Clear sky" },
    1:  { emoji: "🌤",  desc: "Mostly clear" },
    2:  { emoji: "⛅",  desc: "Partly cloudy" },
    3:  { emoji: "☁️",  desc: "Cloudy" },
    45: { emoji: "🌫",  desc: "Fog" },
    48: { emoji: "🌫",  desc: "Freezing fog" },
    51: { emoji: "🌦",  desc: "Light drizzle" },
    53: { emoji: "🌦",  desc: "Drizzle" },
    55: { emoji: "🌧",  desc: "Heavy drizzle" },
    61: { emoji: "🌧",  desc: "Light rain" },
    63: { emoji: "🌧",  desc: "Moderate rain" },
    65: { emoji: "🌧",  desc: "Heavy rain" },
    71: { emoji: "❄️",  desc: "Light snow" },
    73: { emoji: "❄️",  desc: "Moderate snow" },
    75: { emoji: "❄️",  desc: "Heavy snow" },
    77: { emoji: "🌨",  desc: "Snow grains" },
    80: { emoji: "🌦",  desc: "Light rain showers" },
    81: { emoji: "🌧",  desc: "Rain showers" },
    82: { emoji: "⛈",  desc: "Heavy rain showers" },
    85: { emoji: "❄️",  desc: "Snow showers" },
    95: { emoji: "⛈",  desc: "Thunderstorm" },
    96: { emoji: "⛈",  desc: "Thunderstorm with hail" },
    99: { emoji: "⛈",  desc: "Strong thunderstorm" },
  };
  return map[code] || { emoji: "🌡", desc: "Variable" };
}

//geo
function requestLocation() {
  if (!navigator.geolocation) {
    showError("Your browser does not support geolocation.");
    return;
  }
  showScreen("loading");
  $("loading-msg").textContent = "Obtaining your location...";

  navigator.geolocation.getCurrentPosition(
    pos => {
      lastCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      loadWeather(lastCoords.lat, lastCoords.lon);
    },
    err => {
      const msgs = {
        1: "Permission denied. Enable location services in your browser and try again.",
        2: "Position unavailable. Check your connection.",
        3: "Timeout while searching for location.",
      };
      showError(msgs[err.code] || "It was not possible to obtain the location.");
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

function retry()   { showScreen("idle"); }
function refresh() {
  if (!lastCoords) return;
  showScreen("loading");
  $("loading-msg").textContent = "Atualizando dados...";
  loadWeather(lastCoords.lat, lastCoords.lon);
}

function showError(msg) {
  $("error-msg").textContent = msg;
  showScreen("error");
}

//data get geocode
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `${GEO_URL}?lat=${lat}&lon=${lon}&format=json&accept-language=pt-BR`,
      { headers: { "Accept-Language": "pt-BR" } }
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    const a = data.address || {};

//monta nome
    const parts = [
      a.neighbourhood || a.suburb || a.village || a.town || a.city_district,
      a.city || a.municipality,
      a.state_code || a.state,
      a.country,
    ].filter(Boolean);

    return parts.join(", ");
  } catch {
    return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  }
}

//open-meteo get weather
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relativehumidity_2m",
      "weathercode",
      "windspeed_10m",
      "winddirection_10m",
      "precipitation",
      "surface_pressure",
      "visibility",
      "uv_index",
    ].join(","),
    hourly: [
      "temperature_2m",
      "weathercode",
      "precipitation_probability",
    ].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "weathercode",
      "precipitation_sum",
      "precipitation_probability_max",
    ].join(","),
    timezone:      "auto",
    forecast_days: 7,
  });

  const res = await fetch(`${WX_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo responded with error ${res.status}`);
  return res.json();
}

//pipeline
async function loadWeather(lat, lon) {
  try {
    $("loading-msg").textContent = "Loading weather data...";

    const [data, locationName] = await Promise.all([
      fetchWeather(lat, lon),
      reverseGeocode(lat, lon),
    ]);

    weatherData = data;

    renderDashboard(data, locationName, lat, lon);
    showScreen("dashboard");
    initMap(lat, lon, locationName);

  } catch (err) {
    showError(`Error loading data: ${err.message}`);
  }
}

//render:dashboard
function renderDashboard(data, locationName, lat, lon) {
  const cur   = data.current;
  const daily = data.daily;

  $("header-location").textContent = "📍 " + locationName;
  $("cur-place").textContent = locationName;

  const { emoji, desc } = wmoInfo(cur.weathercode);
  $("cur-icon").textContent  = emoji;
  $("cur-temp").textContent  = displayTemp(cur.temperature_2m);
  $("cur-desc").textContent  = desc;
  $("cur-feels").textContent = "Feeling: " + displayTemp(cur.apparent_temperature);

  const todayMin = daily.temperature_2m_min[0];
  const todayMax = daily.temperature_2m_max[0];
  $("bar-min").textContent = "🔽 " + displayTemp(todayMin);
  $("bar-max").textContent = "🔼 " + displayTemp(todayMax);

  $("m-humidity").textContent = cur.relativehumidity_2m + "%";
  $("m-pressure").textContent = Math.round(cur.surface_pressure) + " hPa";
  $("m-wind").textContent     = Math.round(cur.windspeed_10m) + " km/h " + windDir(cur.winddirection_10m);
  $("m-precip").textContent   = cur.precipitation + " mm";
  $("m-vis").textContent      = (cur.visibility / 1000).toFixed(1) + " km";

//uvindex
  const uv = cur.uv_index || 0;
  const uvLabels = ["", "Low", "Low", "Moderate", "Moderate", "Moderate", "High", "High", "Very High", "Very High", "Very High", "Extreme"];
  $("m-uv").textContent  = uv.toFixed(1) + " — " + (uvLabels[Math.round(uv)] || "Extreme");
  $("uv-text").textContent = "☀️ UV: " + uv.toFixed(1);

  const windPct = Math.min((cur.windspeed_10m / 100) * 100, 100);
  const uvPct   = Math.min((uv / 11) * 100, 100);
  $("wind-bar").style.width = windPct + "%";
  $("uv-bar").style.width   = uvPct + "%";

  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const fillPct = ((cur.temperature_2m - weekMin) / (weekMax - weekMin)) * 100;
  $("bar-fill").style.width = Math.max(10, Math.min(fillPct, 90)) + "%";

//graph data
  renderHourly(data);
//predition7days
  renderForecast(daily);
//coords
  $("map-coords").textContent = `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° O`;
// Get timezone-aware current time from front
  $("footer-time").textContent = new Date().toLocaleString("pt-BR");
}

//render:datetime
function renderHourly(data) {
  const now      = new Date();
  const allTimes = data.hourly.time;
  const allTemps = data.hourly.temperature_2m;
  const allCodes = data.hourly.weathercode;
  const allProb  = data.hourly.precipitation_probability;

//init localtime
  let start = allTimes.findIndex(t => new Date(t) >= now);
  if (start < 0) start = 0;

  const N     = 12;
  const times = allTimes.slice(start, start + N);
  const temps = allTemps.slice(start, start + N);
  const codes = allCodes.slice(start, start + N);
  const probs = allProb.slice(start, start + N);

  const container = $("hourly-blocks");
  container.innerHTML = times.map((t, i) => {
    const { emoji } = wmoInfo(codes[i]);
    const isNow     = i === 0;
    const rainProb  = probs[i] || 0;
    const rainText  = rainProb > 10 ? `🌧 ${rainProb}%` : "";

    return `
      <div class="hour-block ${isNow ? "current-hour" : ""}">
        <span class="h-time">${fmtHour(t)}</span>
        <span class="h-ico">${emoji}</span>
        <span class="h-temp">${displayTemp(temps[i])}</span>
        ${rainText ? `<span class="h-rain">${rainText}</span>` : ""}
      </div>
    `;
  }).join("");
}

//renderprevision7days
function renderForecast(daily) {
  const mins   = daily.temperature_2m_min;
  const maxs   = daily.temperature_2m_max;
  const absMin = Math.min(...mins);
  const absMax = Math.max(...maxs);
  const range  = absMax - absMin || 1;

  const container = $("forecast-list");
  container.innerHTML = daily.time.map((dateStr, i) => {
    const { emoji } = wmoInfo(daily.weathercode[i]);
    const mn        = mins[i];
    const mx        = maxs[i];
    const rainProb  = daily.precipitation_probability_max[i] || 0;
    const rainText  = rainProb > 10 ? ` 🌧${rainProb}%` : "";

    const left  = ((mn - absMin) / range) * 100;
    const width = Math.max(((mx - mn) / range) * 100, 5);

    const label = i === 0 ? "Hoje" : fmtDate(dateStr);

    return `
      <div class="forecast-row">
        <span class="f-day">${label}${rainText}</span>
        <span class="f-ico">${emoji}</span>
        <div class="f-bar">
          <div class="f-fill" style="left:${left}%;width:${width}%"></div>
        </div>
        <span class="f-min">${displayTemp(mn)}</span>
        <span class="f-max">${displayTemp(mx)}</span>
      </div>
    `;
  }).join("");
}

// LEAFLET MAP
function initMap(lat, lon, locationName) {
  if (leafletMap) {
    leafletMap.setView([lat, lon], 13);
    if (mapMarker) mapMarker.setLatLng([lat, lon]);
    return;
  }

  leafletMap = L.map("map").setView([lat, lon], 13);

//tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "OpenStreetMap",
    maxZoom: 15,
  }).addTo(leafletMap);

  const icon = L.divIcon({
    html: `<div style="
      font-size: 32px;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      transform: translateY(-50%);
    ">📍</div>`,
    iconSize: [25, 25],
    iconAnchor: [20, 40],
    className: "",
  });

  mapMarker = L.marker([lat, lon], { icon })
    .addTo(leafletMap)
    .bindPopup(`<b>${locationName}</b><br>Your current location`)
    .openPopup();
}

//toggleC-F
function toggleUnit() {
  currentUnit = currentUnit === "C" ? "F" : "C";
  $("unit-label").textContent = currentUnit === "C" ? "Change to °F" : "Change to °C";

  if (weatherData && lastCoords) {
    const locationName = $("header-location").textContent.replace("📍 ", "");
    renderDashboard(weatherData, locationName, lastCoords.lat, lastCoords.lon);
  }
}
