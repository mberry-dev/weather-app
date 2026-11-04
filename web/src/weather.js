// Pure helpers for the weather page: units, weather codes, API URLs and response parsing.
// No DOM and no network here, so all of it is easy to test.
//
// Data comes from Open-Meteo (https://open-meteo.com), which needs no API key, so nothing
// secret ever ships to the browser. Location search is based on GeoNames.

export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export const UNITS = Object.freeze({ F: 'F', C: 'C' });

/** Raised when the API answers but the data is missing or malformed. */
export class DataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DataError';
  }
}

// ── Units ───────────────────────────────────────────────────────────────────

export function toFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

function roundWhole(value) {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded; // never show "-0°"
}

/** "72°F" or "22°C". Input is always Celsius. Missing values show a dash. */
export function formatTemp(celsius, unit) {
  if (!Number.isFinite(celsius)) return '–';
  const value = unit === UNITS.F ? toFahrenheit(celsius) : celsius;
  return `${roundWhole(value)}°${unit === UNITS.F ? 'F' : 'C'}`;
}

/** Wind speed arrives in metres per second. Fahrenheit shows mph, Celsius shows km/h. */
export function formatWind(metresPerSecond, unit) {
  if (!Number.isFinite(metresPerSecond)) return '–';
  return unit === UNITS.F
    ? `${roundWhole(metresPerSecond * 2.236936)} mph`
    : `${roundWhole(metresPerSecond * 3.6)} km/h`;
}

/** Visibility arrives in metres. Fahrenheit shows miles, Celsius shows kilometres. */
export function formatVisibility(metres, unit) {
  if (!Number.isFinite(metres)) return '–';
  const value = unit === UNITS.F ? metres / 1609.344 : metres / 1000;
  return `${Number(value.toFixed(1))} ${unit === UNITS.F ? 'mi' : 'km'}`;
}

export function formatPressure(hectopascals) {
  return Number.isFinite(hectopascals) ? `${roundWhole(hectopascals)} hPa` : '–';
}

export function formatHumidity(percent) {
  return Number.isFinite(percent) ? `${roundWhole(percent)}%` : '–';
}

// ── Weather codes (WMO) ─────────────────────────────────────────────────────

const CODES = {
  0: ['Clear sky', '☀️', '🌙'],
  1: ['Mainly clear', '🌤️', '🌙'],
  2: ['Partly cloudy', '⛅', '☁️'],
  3: ['Overcast', '☁️', '☁️'],
  45: ['Fog', '🌫️', '🌫️'],
  48: ['Freezing fog', '🌫️', '🌫️'],
  51: ['Light drizzle', '🌦️', '🌧️'],
  53: ['Drizzle', '🌦️', '🌧️'],
  55: ['Heavy drizzle', '🌧️', '🌧️'],
  56: ['Light freezing drizzle', '🌧️', '🌧️'],
  57: ['Freezing drizzle', '🌧️', '🌧️'],
  61: ['Light rain', '🌦️', '🌧️'],
  63: ['Rain', '🌧️', '🌧️'],
  65: ['Heavy rain', '🌧️', '🌧️'],
  66: ['Light freezing rain', '🌧️', '🌧️'],
  67: ['Freezing rain', '🌧️', '🌧️'],
  71: ['Light snow', '🌨️', '🌨️'],
  73: ['Snow', '❄️', '❄️'],
  75: ['Heavy snow', '❄️', '❄️'],
  77: ['Snow grains', '🌨️', '🌨️'],
  80: ['Light rain showers', '🌦️', '🌧️'],
  81: ['Rain showers', '🌧️', '🌧️'],
  82: ['Violent rain showers', '🌧️', '🌧️'],
  85: ['Light snow showers', '🌨️', '🌨️'],
  86: ['Heavy snow showers', '❄️', '❄️'],
  95: ['Thunderstorm', '⛈️', '⛈️'],
  96: ['Thunderstorm with hail', '⛈️', '⛈️'],
  99: ['Thunderstorm with heavy hail', '⛈️', '⛈️'],
};

/** A readable description and an emoji for a WMO weather code. Unknown codes are handled, not fatal. */
export function describeWeather(code, isDay = true) {
  const entry = CODES[code];
  if (!entry) return { label: 'Unknown conditions', icon: '🌡️' };
  return { label: entry[0], icon: isDay ? entry[1] : entry[2] };
}

// ── Places ──────────────────────────────────────────────────────────────────

/** "Detroit, Michigan, United States". Skips a region that repeats the name (Singapore, Singapore). */
export function formatLocation(location) {
  const parts = [location.name];
  if (location.admin1 && location.admin1 !== location.name) parts.push(location.admin1);
  if (location.country) parts.push(location.country);
  return parts.join(', ');
}

// ── URLs ────────────────────────────────────────────────────────────────────

export function buildGeocodingUrl(name, count = 5) {
  const url = new URL(GEOCODING_URL);
  url.searchParams.set('name', name);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  return url.toString();
}

export function buildForecastUrl({ latitude, longitude }) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m,visibility',
  );
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');
  return url.toString();
}

// ── Parsing ─────────────────────────────────────────────────────────────────

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Turns a geocoding response into a list of places. A search with no matches gives an empty list. */
export function parseLocations(json) {
  const results = json && Array.isArray(json.results) ? json.results : [];
  return results
    .filter((r) => r && typeof r.name === 'string' && isNumber(r.latitude) && isNumber(r.longitude))
    .map((r) => ({
      id: r.id ?? `${r.latitude},${r.longitude}`,
      name: r.name,
      admin1: typeof r.admin1 === 'string' ? r.admin1 : '',
      country: typeof r.country === 'string' ? r.country : '',
      countryCode: typeof r.country_code === 'string' ? r.country_code : '',
      latitude: r.latitude,
      longitude: r.longitude,
    }));
}

/**
 * Turns a forecast response into the numbers the page shows. Temperatures are Celsius,
 * wind is metres per second, visibility is metres. Throws DataError if the essentials are missing.
 */
export function parseForecast(json) {
  const current = json && json.current;
  if (!current || typeof current !== 'object') throw new DataError('The weather response had no current conditions.');

  for (const key of ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'wind_speed_10m', 'weather_code']) {
    if (!isNumber(current[key])) throw new DataError(`The weather response is missing "${key}".`);
  }

  const daily = (json && json.daily) || {};
  const first = (list) => (Array.isArray(list) && isNumber(list[0]) ? list[0] : null);
  const isDay = current.is_day !== 0;

  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    pressure: isNumber(current.pressure_msl) ? current.pressure_msl : null,
    visibility: isNumber(current.visibility) ? current.visibility : null,
    high: first(daily.temperature_2m_max),
    low: first(daily.temperature_2m_min),
    isDay,
    conditions: describeWeather(current.weather_code, isDay),
  };
}
