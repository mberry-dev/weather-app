import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NetworkError, NotFoundError, getWeather, searchLocations } from '../src/api.js';
import { DataError } from '../src/weather.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

// A fake fetch that records its calls and answers with a canned response
function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  fn.calls = calls;
  return fn;
}
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const status = (code) => ({ ok: false, status: code, json: async () => ({}) });

describe('searchLocations', () => {
  test('returns the matches, best first', async () => {
    const fetch = fakeFetch(() => ok(fixture('geocode-detroit.json')));
    const places = await searchLocations('Detroit', { fetch });
    assert.equal(places.length, 2);
    assert.equal(places[0].admin1, 'Michigan');
    assert.equal(fetch.calls.length, 1);
    assert.match(fetch.calls[0].url, /^https:\/\/geocoding-api\.open-meteo\.com\/v1\/search\?/);
  });

  test('trims the name and encodes special characters', async () => {
    const fetch = fakeFetch(() => ok(fixture('geocode-detroit.json')));
    await searchLocations('  São Paulo & x=1  ', { fetch });
    const url = new URL(fetch.calls[0].url);
    assert.equal(url.searchParams.get('name'), 'São Paulo & x=1');
    assert.equal(url.searchParams.has('x'), false);
  });

  test('passes the abort signal through', async () => {
    const fetch = fakeFetch(() => ok(fixture('geocode-detroit.json')));
    const controller = new AbortController();
    await searchLocations('Detroit', { fetch, signal: controller.signal });
    assert.equal(fetch.calls[0].init.signal, controller.signal);
  });

  test('very long names are cut to 100 characters', async () => {
    const fetch = fakeFetch(() => ok({}));
    await assert.rejects(searchLocations('a'.repeat(500), { fetch }), NotFoundError);
    assert.equal(new URL(fetch.calls[0].url).searchParams.get('name').length, 100);
  });

  test('no matches gives NotFoundError with a friendly message', async () => {
    const fetch = fakeFetch(() => ok({ generationtime_ms: 0.3 }));
    await assert.rejects(searchLocations('Zzzzzz', { fetch }), (e) => e instanceof NotFoundError && /check the spelling/.test(e.message));
  });

  test('empty, blank and one-character names never reach the network', async () => {
    const fetch = fakeFetch(() => ok(fixture('geocode-detroit.json')));
    for (const bad of ['', '   ', 'a', null, undefined]) {
      await assert.rejects(searchLocations(bad, { fetch }), NotFoundError);
    }
    assert.equal(fetch.calls.length, 0);
  });

  test('a failed request is a NetworkError', async () => {
    const fetch = fakeFetch(() => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(searchLocations('Detroit', { fetch }), (e) => e instanceof NetworkError);
  });

  test('a server error is a NetworkError that names the status', async () => {
    const fetch = fakeFetch(() => status(503));
    await assert.rejects(searchLocations('Detroit', { fetch }), (e) => e instanceof NetworkError && e.message.includes('503'));
  });

  test('a body that is not JSON is a DataError', async () => {
    const fetch = fakeFetch(() => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }));
    await assert.rejects(searchLocations('Detroit', { fetch }), DataError);
  });

  test('a cancelled request is not reported as a network failure', async () => {
    const fetch = fakeFetch(() => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); });
    await assert.rejects(searchLocations('Detroit', { fetch }), (e) => e.name === 'AbortError' && !(e instanceof NetworkError));
  });
});

describe('getWeather', () => {
  const place = { latitude: 42.33, longitude: -83.05 };

  test('returns parsed weather for a place', async () => {
    const fetch = fakeFetch(() => ok(fixture('forecast-detroit.json')));
    const weather = await getWeather(place, { fetch });
    assert.equal(weather.temperature, 8.4);
    const url = new URL(fetch.calls[0].url);
    assert.equal(url.searchParams.get('latitude'), '42.33');
    assert.equal(url.searchParams.get('longitude'), '-83.05');
  });

  test('errors map the same way as for search', async () => {
    await assert.rejects(getWeather(place, { fetch: fakeFetch(() => status(500)) }), NetworkError);
    await assert.rejects(getWeather(place, { fetch: fakeFetch(() => { throw new TypeError('offline'); }) }), NetworkError);
    await assert.rejects(getWeather(place, { fetch: fakeFetch(() => ok({})) }), DataError);
  });
});
