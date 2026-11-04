import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DataError, UNITS, buildForecastUrl, buildGeocodingUrl, describeWeather, formatHumidity, formatLocation,
  formatPressure, formatTemp, formatVisibility, formatWind, parseForecast, parseLocations, toFahrenheit,
} from '../src/weather.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('temperature', () => {
  test('converts Celsius to Fahrenheit', () => {
    assert.equal(toFahrenheit(0), 32);
    assert.equal(toFahrenheit(100), 212);
    assert.equal(toFahrenheit(-40), -40);
    assert.equal(toFahrenheit(37), 98.6);
  });
  test('formats with the right unit and rounds to a whole number', () => {
    assert.equal(formatTemp(8.4, UNITS.C), '8°C');
    assert.equal(formatTemp(8.6, UNITS.C), '9°C');
    assert.equal(formatTemp(8.4, UNITS.F), '47°F');
    assert.equal(formatTemp(0, UNITS.F), '32°F');
  });
  test('never shows negative zero', () => {
    assert.equal(formatTemp(-0.3, UNITS.C), '0°C');
    assert.equal(formatTemp(-17.8, UNITS.F), '0°F');
  });
  test('keeps real negatives', () => {
    assert.equal(formatTemp(-5.4, UNITS.C), '-5°C');
  });
  test('missing values show a dash instead of NaN', () => {
    for (const bad of [null, undefined, NaN, Infinity, '12']) assert.equal(formatTemp(bad, UNITS.C), '–');
  });
});

describe('wind, visibility, pressure, humidity', () => {
  test('wind: metres per second to mph or km/h', () => {
    assert.equal(formatWind(10, UNITS.F), '22 mph');
    assert.equal(formatWind(10, UNITS.C), '36 km/h');
    assert.equal(formatWind(0, UNITS.C), '0 km/h');
    assert.equal(formatWind(null, UNITS.C), '–');
  });
  test('visibility: metres to miles or kilometres, one decimal at most', () => {
    assert.equal(formatVisibility(24140, UNITS.C), '24.1 km');
    assert.equal(formatVisibility(24140, UNITS.F), '15 mi');
    assert.equal(formatVisibility(500, UNITS.C), '0.5 km');
    assert.equal(formatVisibility(10000, UNITS.C), '10 km');
    assert.equal(formatVisibility(null, UNITS.F), '–');
  });
  test('pressure and humidity', () => {
    assert.equal(formatPressure(1018.6), '1019 hPa');
    assert.equal(formatPressure(null), '–');
    assert.equal(formatHumidity(71), '71%');
    assert.equal(formatHumidity(undefined), '–');
  });
});

describe('describeWeather', () => {
  test('known codes give a label and an icon', () => {
    assert.deepEqual(describeWeather(0, true), { label: 'Clear sky', icon: '☀️' });
    assert.deepEqual(describeWeather(0, false), { label: 'Clear sky', icon: '🌙' });
    assert.equal(describeWeather(63).label, 'Rain');
    assert.equal(describeWeather(95).label, 'Thunderstorm');
    assert.equal(describeWeather(75).label, 'Heavy snow');
  });
  test('every documented WMO code is covered', () => {
    const documented = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    for (const code of documented) {
      const d = describeWeather(code);
      assert.notEqual(d.label, 'Unknown conditions', `code ${code}`);
      assert.ok(d.icon, `code ${code} has an icon`);
    }
  });
  test('an unknown code does not throw', () => {
    assert.deepEqual(describeWeather(1234), { label: 'Unknown conditions', icon: '🌡️' });
    assert.equal(describeWeather(undefined).label, 'Unknown conditions');
  });
});

describe('formatLocation', () => {
  test('name, region and country', () => {
    assert.equal(formatLocation({ name: 'Detroit', admin1: 'Michigan', country: 'United States' }), 'Detroit, Michigan, United States');
  });
  test('skips a region that repeats the name, and missing parts', () => {
    assert.equal(formatLocation({ name: 'Singapore', admin1: 'Singapore', country: 'Singapore' }), 'Singapore, Singapore');
    assert.equal(formatLocation({ name: 'Nowhere', admin1: '', country: '' }), 'Nowhere');
  });
});

describe('URLs', () => {
  test('geocoding URL encodes the name', () => {
    const url = new URL(buildGeocodingUrl('São Paulo & Co'));
    assert.equal(url.origin, 'https://geocoding-api.open-meteo.com');
    assert.equal(url.pathname, '/v1/search');
    assert.equal(url.searchParams.get('name'), 'São Paulo & Co');
    assert.equal(url.searchParams.get('count'), '5');
    assert.equal(url.searchParams.get('language'), 'en');
    assert.equal(url.searchParams.get('format'), 'json');
    assert.equal([...url.searchParams.keys()].length, 4); // a pasted "&" cannot add parameters
  });
  test('forecast URL asks for exactly what the page shows, in metric units', () => {
    const url = new URL(buildForecastUrl({ latitude: 42.33, longitude: -83.05 }));
    assert.equal(url.origin, 'https://api.open-meteo.com');
    assert.equal(url.pathname, '/v1/forecast');
    assert.equal(url.searchParams.get('latitude'), '42.33');
    assert.equal(url.searchParams.get('longitude'), '-83.05');
    assert.deepEqual(url.searchParams.get('current').split(','), [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day', 'weather_code', 'pressure_msl', 'wind_speed_10m', 'visibility',
    ]);
    assert.equal(url.searchParams.get('daily'), 'temperature_2m_max,temperature_2m_min');
    assert.equal(url.searchParams.get('wind_speed_unit'), 'ms');
    assert.equal(url.searchParams.get('timezone'), 'auto');
    assert.equal(url.searchParams.has('temperature_unit'), false); // Celsius is the default; the page converts
    assert.equal(url.searchParams.has('apikey'), false);
  });
});

describe('parseLocations', () => {
  test('reads the documented geocoding response', () => {
    const places = parseLocations(fixture('geocode-detroit.json'));
    assert.equal(places.length, 2);
    assert.deepEqual(places[0], {
      id: 4990729, name: 'Detroit', admin1: 'Michigan', country: 'United States', countryCode: 'US',
      latitude: 42.33143, longitude: -83.04575,
    });
    assert.equal(places[1].admin1, 'Oregon');
  });
  test('no matches: the "results" key is missing, or empty, or the body is odd', () => {
    assert.deepEqual(parseLocations({ generationtime_ms: 0.2 }), []);
    assert.deepEqual(parseLocations({ results: [] }), []);
    assert.deepEqual(parseLocations(null), []);
    assert.deepEqual(parseLocations({ results: 'nope' }), []);
  });
  test('drops entries without usable coordinates or a name', () => {
    const places = parseLocations({ results: [
      { name: 'Good', latitude: 1, longitude: 2 },
      { name: 'No coords' },
      { name: 'Bad coords', latitude: '1', longitude: 2 },
      { latitude: 1, longitude: 2 },
      null,
    ] });
    assert.deepEqual(places.map((p) => p.name), ['Good']);
    assert.equal(places[0].admin1, '');
    assert.equal(places[0].country, '');
  });
});

describe('parseForecast', () => {
  test('reads the documented forecast response', () => {
    const w = parseForecast(fixture('forecast-detroit.json'));
    assert.equal(w.temperature, 8.4);
    assert.equal(w.feelsLike, 5.2);
    assert.equal(w.humidity, 71);
    assert.equal(w.windSpeed, 4.6);
    assert.equal(w.pressure, 1018.6);
    assert.equal(w.visibility, 24140);
    assert.equal(w.high, 11.7);
    assert.equal(w.low, 3.1);
    assert.equal(w.isDay, true);
    assert.deepEqual(w.conditions, { label: 'Overcast', icon: '☁️' });
  });
  test('night time picks the night icon', () => {
    const json = fixture('forecast-detroit.json');
    json.current.is_day = 0;
    json.current.weather_code = 0;
    assert.equal(parseForecast(json).conditions.icon, '🌙');
  });
  test('optional values may be missing without failing', () => {
    const json = fixture('forecast-detroit.json');
    delete json.current.visibility;
    delete json.current.pressure_msl;
    delete json.daily;
    const w = parseForecast(json);
    assert.equal(w.visibility, null);
    assert.equal(w.pressure, null);
    assert.equal(w.high, null);
    assert.equal(w.low, null);
  });
  test('missing essentials throw a DataError that names the field', () => {
    for (const key of ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'wind_speed_10m', 'weather_code']) {
      const json = fixture('forecast-detroit.json');
      delete json.current[key];
      assert.throws(() => parseForecast(json), (e) => e instanceof DataError && e.message.includes(key));
    }
  });
  test('a response with no current block, or a non-object, throws a DataError', () => {
    for (const bad of [{}, null, undefined, { current: null }, { current: 'x' }]) {
      assert.throws(() => parseForecast(bad), DataError);
    }
  });
  test('numbers sent as strings are rejected, not guessed', () => {
    const json = fixture('forecast-detroit.json');
    json.current.temperature_2m = '8.4';
    assert.throws(() => parseForecast(json), DataError);
  });
});
