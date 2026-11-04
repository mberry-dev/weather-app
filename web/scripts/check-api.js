// Live contract check: calls the real Open-Meteo services and confirms they still answer the
// way the page expects, using the page's own URL builders and parsers. It also confirms the
// services allow requests from a web page (CORS), which a Node script can't test by itself.
//
//   npm run check:api
//
// Not part of `npm test` because it needs the internet and depends on a service we don't control.

import { buildForecastUrl, buildGeocodingUrl, describeWeather, parseForecast, parseLocations } from '../src/weather.js';

const SITE_ORIGIN = 'https://mberry-dev.github.io';
let failures = 0;

function check(name, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${passed || !detail ? '' : `  -> ${detail}`}`);
  if (!passed) failures++;
}

// One retry, so a single network blip doesn't fail the check
async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, { headers: { Origin: SITE_ORIGIN } });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

function allowsOrigin(response) {
  const value = response.headers.get('access-control-allow-origin');
  return value === '*' || value === SITE_ORIGIN;
}

try {
  // Geocoding: a real city
  const geoResponse = await get(buildGeocodingUrl('Detroit'));
  check('geocoding answers 200', geoResponse.status === 200, `status ${geoResponse.status}`);
  check('geocoding allows requests from a web page (CORS)', allowsOrigin(geoResponse), String(geoResponse.headers.get('access-control-allow-origin')));
  const places = parseLocations(await geoResponse.json());
  check('geocoding finds Detroit with coordinates', places.length > 0 && places[0].name === 'Detroit' && Number.isFinite(places[0].latitude), JSON.stringify(places[0]));
  check('geocoding returns region and country', Boolean(places[0] && places[0].admin1 && places[0].country), JSON.stringify(places[0]));

  // Geocoding: nothing matches
  const noneResponse = await get(buildGeocodingUrl('Zzzzqqqxxwvk'));
  check('a search with no matches answers 200', noneResponse.status === 200, `status ${noneResponse.status}`);
  check('a search with no matches parses to an empty list', parseLocations(await noneResponse.json()).length === 0);

  // Forecast
  if (places.length > 0) {
    const forecastResponse = await get(buildForecastUrl(places[0]));
    check('forecast answers 200', forecastResponse.status === 200, `status ${forecastResponse.status}`);
    check('forecast allows requests from a web page (CORS)', allowsOrigin(forecastResponse), String(forecastResponse.headers.get('access-control-allow-origin')));
    const json = await forecastResponse.json();
    let weather = null;
    try {
      weather = parseForecast(json);
      check('forecast parses with the page\'s own parser', true);
    } catch (error) {
      check('forecast parses with the page\'s own parser', false, error.message);
    }
    if (weather) {
      check('temperature is plausible (Celsius)', weather.temperature > -90 && weather.temperature < 60, String(weather.temperature));
      check('humidity is 0-100', weather.humidity >= 0 && weather.humidity <= 100, String(weather.humidity));
      check('wind speed is not negative', weather.windSpeed >= 0, String(weather.windSpeed));
      check('pressure is present and plausible (hPa)', weather.pressure > 850 && weather.pressure < 1090, String(weather.pressure));
      check('visibility is present, in metres', weather.visibility >= 0, String(weather.visibility));
      check('today\'s high and low are present', Number.isFinite(weather.high) && Number.isFinite(weather.low) && weather.high >= weather.low, `${weather.high}/${weather.low}`);
      check('the weather code is one the page knows', describeWeather(json.current.weather_code).label !== 'Unknown conditions', String(json.current.weather_code));
    }
  }
} catch (error) {
  check('services reachable', false, error && error.message);
}

console.log(failures === 0 ? '\nOpen-Meteo still matches what the page expects.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
