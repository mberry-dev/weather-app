import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountWeather } from '../src/ui.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); };

// A fake network: routes by URL, records calls, and can hold an answer until the test releases it
function fakeNetwork() {
  const calls = [];
  const routes = [];
  const net = {
    calls,
    on(pattern, handler) { routes.push({ pattern, handler }); return net; },
    fetch: async (url, init) => {
      calls.push(String(url));
      const route = routes.find((r) => r.pattern.test(String(url)));
      if (!route) throw new Error(`unexpected request: ${url}`);
      return route.handler(String(url), init);
    },
    count: (pattern) => calls.filter((u) => pattern.test(u)).length,
  };
  return net;
}
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
};

const GEO = /geocoding-api\.open-meteo\.com/;
const FORECAST = /api\.open-meteo\.com\/v1\/forecast/;

let dom, root, app;
const q = (selector) => root.querySelector(selector);
const text = (selector) => q(selector).textContent;
const detailValues = () => Object.fromEntries([...root.querySelectorAll('.detail')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]));

function standardNetwork() {
  return fakeNetwork().on(GEO, () => ok(fixture('geocode-detroit.json'))).on(FORECAST, () => ok(fixture('forecast-detroit.json')));
}
async function search(name) {
  q('.city-input').value = name;
  q('.search-button').click();
  await settle();
}
function start(options = {}) {
  app = mountWeather(root, { storage: memoryStorage(), ...options });
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><div id="app"></div>');
  root = dom.window.document.getElementById('app');
});
afterEach(() => {
  app?.destroy();
  app = null;
  dom.window.close();
});

describe('first render', () => {
  test('shows the placeholder, the °F button and an empty, labelled search box', () => {
    const net = standardNetwork();
    start({ fetch: net.fetch });
    assert.equal(text('.placeholder'), 'Search for a city to see weather');
    assert.equal(q('.placeholder').hidden, false);
    assert.equal(q('.weather').hidden, true);
    assert.equal(q('.spinner').hidden, true);
    assert.equal(text('.unit-button'), '°F');
    assert.equal(q('label').htmlFor, q('.city-input').id);
    assert.equal(q('.city-input').placeholder, 'Enter city name...');
    assert.equal(net.calls.length, 0);
  });
});

describe('searching', () => {
  test('shows the weather for the best match, in Fahrenheit by default', async () => {
    const net = standardNetwork();
    start({ fetch: net.fetch });
    await search('Detroit');
    assert.equal(q('.weather').hidden, false);
    assert.equal(q('.placeholder').hidden, true);
    assert.equal(text('.place'), 'Detroit, Michigan, United States');
    assert.equal(text('.conditions-label'), 'Overcast');
    assert.equal(text('.temperature'), '47°F');
    assert.equal(text('.highlow'), 'H: 53°F  L: 38°F');
    assert.deepEqual(detailValues(), {
      '🌡 Feels Like': '41°F', '💧 Humidity': '71%', '💨 Wind Speed': '10 mph', '📊 Pressure': '1019 hPa', '👁 Visibility': '15 mi',
    });
    assert.equal(q('.spinner').hidden, true);
    assert.equal(text('.error'), '');
  });

  test('makes one geocoding request and one forecast request, for the first match', async () => {
    const net = standardNetwork();
    start({ fetch: net.fetch });
    await search('Detroit');
    assert.equal(net.count(GEO), 1);
    assert.equal(net.count(FORECAST), 1);
    assert.match(net.calls[1], /latitude=42\.33143/);
  });

  test('the Search key (form submit) works the same as the button', async () => {
    const net = standardNetwork();
    start({ fetch: net.fetch });
    q('.city-input').value = 'Detroit';
    q('form').dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
    await settle();
    assert.equal(text('.temperature'), '47°F');
  });

  test('an empty or blank search asks for a city and makes no request', async () => {
    const net = standardNetwork();
    start({ fetch: net.fetch });
    await search('   ');
    assert.equal(text('.error'), 'Please enter a city name');
    assert.equal(net.calls.length, 0);
  });

  test('shows the spinner while loading and hides it afterwards', async () => {
    const gate = deferred();
    const net = fakeNetwork().on(GEO, () => gate.promise).on(FORECAST, () => ok(fixture('forecast-detroit.json')));
    start({ fetch: net.fetch });
    q('.city-input').value = 'Detroit';
    q('.search-button').click();
    await settle();
    assert.equal(q('.spinner').hidden, false);
    assert.equal(q('.placeholder').hidden, true);
    gate.resolve(ok(fixture('geocode-detroit.json')));
    await settle();
    assert.equal(q('.spinner').hidden, true);
    assert.equal(text('.temperature'), '47°F');
  });
});

describe('errors', () => {
  test('a city that does not exist', async () => {
    const net = fakeNetwork().on(GEO, () => ok({ generationtime_ms: 0.2 }));
    start({ fetch: net.fetch });
    await search('Zzzzzzz');
    assert.equal(text('.error'), 'City not found. Please check the spelling.');
    assert.equal(q('.weather').hidden, true);
    assert.equal(q('.spinner').hidden, true);
    assert.equal(q('.error').getAttribute('role'), 'alert');
  });

  test('being offline', async () => {
    const net = fakeNetwork().on(GEO, () => { throw new TypeError('Failed to fetch'); });
    start({ fetch: net.fetch });
    await search('Detroit');
    assert.equal(text('.error'), 'Network error. Please check your connection.');
  });

  test('a server error', async () => {
    const net = fakeNetwork().on(GEO, () => ({ ok: false, status: 500, json: async () => ({}) }));
    start({ fetch: net.fetch });
    await search('Detroit');
    assert.equal(text('.error'), 'Network error. Please check your connection.');
  });

  test('a forecast that is missing data', async () => {
    const net = fakeNetwork().on(GEO, () => ok(fixture('geocode-detroit.json'))).on(FORECAST, () => ok({ current: {} }));
    start({ fetch: net.fetch });
    await search('Detroit');
    assert.equal(text('.error'), 'Error reading weather data');
  });

  test('an error keeps the previous weather on screen, and the next good search clears the error', async () => {
    let fail = false;
    const net = fakeNetwork()
      .on(GEO, () => (fail ? ok({}) : ok(fixture('geocode-detroit.json'))))
      .on(FORECAST, () => ok(fixture('forecast-detroit.json')));
    start({ fetch: net.fetch });
    await search('Detroit');
    fail = true;
    await search('Zzzzzz');
    assert.equal(text('.error'), 'City not found. Please check the spelling.');
    assert.equal(text('.temperature'), '47°F');
    fail = false;
    await search('Detroit');
    assert.equal(text('.error'), '');
  });
});

describe('unit toggle', () => {
  test('converts everything without asking the network again', async () => {
    const net = standardNetwork();
    start({ fetch: net.fetch });
    await search('Detroit');
    const before = net.calls.length;
    q('.unit-button').click();
    assert.equal(text('.unit-button'), '°C');
    assert.equal(text('.temperature'), '8°C');
    assert.equal(text('.highlow'), 'H: 12°C  L: 3°C');
    assert.deepEqual(detailValues(), {
      '🌡 Feels Like': '5°C', '💧 Humidity': '71%', '💨 Wind Speed': '17 km/h', '📊 Pressure': '1019 hPa', '👁 Visibility': '24.1 km',
    });
    q('.unit-button').click();
    assert.equal(text('.temperature'), '47°F');
    assert.equal(net.calls.length, before);
  });

  test('works before any search and says which unit is on, for screen readers', () => {
    start({ fetch: standardNetwork().fetch });
    assert.match(q('.unit-button').getAttribute('aria-label'), /Fahrenheit.*Switch to Celsius/);
    q('.unit-button').click();
    assert.match(q('.unit-button').getAttribute('aria-label'), /Celsius.*Switch to Fahrenheit/);
  });
});

describe('several places with the same name', () => {
  test('lists the other matches and loads one when chosen, without searching again', async () => {
    const net = fakeNetwork()
      .on(GEO, () => ok(fixture('geocode-detroit.json')))
      .on(FORECAST, (url) => {
        const body = fixture('forecast-detroit.json');
        if (url.includes('latitude=44.9448')) body.current.temperature_2m = -3;
        return ok(body);
      });
    start({ fetch: net.fetch });
    await search('Detroit');
    assert.equal(q('.others').hidden, false);
    const buttons = [...root.querySelectorAll('.other-button')];
    assert.deepEqual(buttons.map((b) => b.textContent), ['Detroit, Oregon, United States']);

    buttons[0].click();
    await settle();
    assert.equal(text('.place'), 'Detroit, Oregon, United States');
    assert.equal(text('.temperature'), '27°F');
    assert.equal(net.count(GEO), 1);
    assert.equal(net.count(FORECAST), 2);
    // the first place is now offered, so you can go back
    assert.deepEqual([...root.querySelectorAll('.other-button')].map((b) => b.textContent), ['Detroit, Michigan, United States']);
  });

  test('no list when there is only one match', async () => {
    const one = fixture('geocode-detroit.json');
    one.results = one.results.slice(0, 1);
    const net = fakeNetwork().on(GEO, () => ok(one)).on(FORECAST, () => ok(fixture('forecast-detroit.json')));
    start({ fetch: net.fetch });
    await search('Detroit');
    assert.equal(q('.others').hidden, true);
  });
});

describe('overlapping searches', () => {
  test('a slow earlier search never overwrites a newer one', async () => {
    const slow = deferred();
    const net = fakeNetwork()
      .on(GEO, (url) => (url.includes('name=Slow') ? slow.promise : ok(fixture('geocode-detroit.json'))))
      .on(FORECAST, (url) => {
        const body = fixture('forecast-detroit.json');
        if (url.includes('latitude=10')) body.current.temperature_2m = 40; // the slow city's weather
        return ok(body);
      });
    start({ fetch: net.fetch });

    q('.city-input').value = 'Slow';
    q('.search-button').click();
    await settle();
    await search('Detroit'); // newer search finishes first
    assert.equal(text('.place'), 'Detroit, Michigan, United States');

    slow.resolve(ok({ results: [{ id: 1, name: 'Slowtown', latitude: 10, longitude: 10, country: 'Nowhere' }] }));
    await settle();
    assert.equal(text('.place'), 'Detroit, Michigan, United States');
    assert.equal(text('.temperature'), '47°F');
    assert.equal(q('.spinner').hidden, true);
  });

  test('starting a new search cancels the one in progress', async () => {
    const signals = [];
    const net = fakeNetwork()
      .on(GEO, (url, init) => { signals.push(init.signal); return ok(fixture('geocode-detroit.json')); })
      .on(FORECAST, () => ok(fixture('forecast-detroit.json')));
    start({ fetch: net.fetch });
    q('.city-input').value = 'Detroit';
    q('.search-button').click();
    q('.search-button').click();
    await settle();
    assert.equal(signals[0].aborted, true);
    assert.equal(signals[1].aborted, false);
  });
});

describe('remembering things in the browser', () => {
  test('saves the unit and the last city, and restores both on the next visit', async () => {
    const storage = memoryStorage();
    const net = standardNetwork();
    start({ fetch: net.fetch, storage });
    await search('Detroit');
    q('.unit-button').click();
    assert.equal(storage.data['weather.unit'], 'C');
    assert.equal(storage.data['weather.city'], 'Detroit');
    app.destroy();

    const net2 = standardNetwork();
    app = mountWeather(root, { fetch: net2.fetch, storage });
    await settle();
    assert.equal(q('.city-input').value, 'Detroit');
    assert.equal(text('.unit-button'), '°C');
    assert.equal(text('.temperature'), '8°C');
  });

  test('a failed search is not remembered', async () => {
    const storage = memoryStorage();
    const net = fakeNetwork().on(GEO, () => ok({}));
    start({ fetch: net.fetch, storage });
    await search('Zzzzzz');
    assert.equal('weather.city' in storage.data, false);
  });

  test('a junk saved unit falls back to Fahrenheit', () => {
    start({ fetch: standardNetwork().fetch, storage: memoryStorage({ 'weather.unit': 'K' }) });
    assert.equal(text('.unit-button'), '°F');
  });

  test('storage that throws, or is missing, does not break the page', async () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
    start({ fetch: standardNetwork().fetch, storage: broken });
    await search('Detroit');
    q('.unit-button').click();
    assert.equal(text('.temperature'), '8°C');
    app.destroy();
    app = mountWeather(root, { fetch: standardNetwork().fetch, storage: null });
    await search('Detroit');
    assert.equal(text('.temperature'), '47°F');
  });
});

describe('safety', () => {
  test('place names from the API are shown as text, never as markup', async () => {
    const evil = { results: [{ id: 9, name: '<img src=x onerror=alert(1)>', admin1: '<b>bold</b>', country: '</h2><script>1</script>', latitude: 1, longitude: 2 }] };
    const net = fakeNetwork().on(GEO, () => ok(evil)).on(FORECAST, () => ok(fixture('forecast-detroit.json')));
    start({ fetch: net.fetch });
    await search('anything');
    assert.equal(root.querySelector('.place img'), null);
    assert.equal(root.querySelector('script'), null);
    assert.equal(root.querySelector('.place b'), null);
    assert.match(text('.place'), /<img src=x onerror=alert\(1\)>/);
  });

  test('a city name with special characters is sent safely', async () => {
    const net = standardNetwork();
    start({ fetch: net.fetch });
    await search('São Paulo&count=100');
    const url = new URL(net.calls[0]);
    assert.equal(url.searchParams.get('name'), 'São Paulo&count=100');
    assert.equal(url.searchParams.get('count'), '5');
  });
});

describe('destroy', () => {
  test('cancels work in progress and empties the root', async () => {
    const gate = deferred();
    const net = fakeNetwork().on(GEO, () => gate.promise);
    start({ fetch: net.fetch });
    q('.city-input').value = 'Detroit';
    q('.search-button').click();
    await settle();
    app.destroy();
    gate.resolve(ok(fixture('geocode-detroit.json')));
    await settle();
    assert.equal(root.children.length, 0);
    app = null;
  });
});
