// The weather page. Builds everything inside `root` with textContent (never innerHTML),
// so a city name from the API can't inject markup. Fetch and storage are passed in for tests.

import { NetworkError, NotFoundError, getWeather, searchLocations } from './api.js';
import {
  DataError, UNITS, formatHumidity, formatLocation, formatPressure, formatTemp, formatVisibility, formatWind,
} from './weather.js';

const UNIT_KEY = 'weather.unit';
const CITY_KEY = 'weather.city';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // some browsers throw just for touching storage (blocked cookies, private mode)
  }
}

function messageFor(error) {
  if (error instanceof NotFoundError) return error.message;
  if (error instanceof NetworkError) return 'Network error. Please check your connection.';
  if (error instanceof DataError) return 'Error reading weather data';
  return 'Something went wrong. Please try again.';
}

/**
 * Mounts the weather page into `root`.
 * @param {HTMLElement} root
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {Storage|null} [options.storage]
 */
export function mountWeather(root, options = {}) {
  const doFetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const doc = root.ownerDocument;

  const read = (key) => {
    try { return storage ? storage.getItem(key) : null; } catch { return null; }
  };
  const write = (key, value) => {
    try { if (storage) storage.setItem(key, value); } catch { /* storage full or blocked: not worth failing over */ }
  };

  let state = {
    unit: read(UNIT_KEY) === UNITS.C ? UNITS.C : UNITS.F, // Fahrenheit by default, like the Android app
    loading: false,
    error: '',
    place: null,    // the place being shown
    matches: [],    // every place the search found
    weather: null,
  };
  let requestId = 0;
  let controller = null;

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ── Build the page once ───────────────────────────────────────────────────

  const app = el('div', 'app');

  const header = el('header', 'topbar');
  const title = el('h1', 'title', '🌤 Weather App');
  const unitButton = el('button', 'unit-button');
  unitButton.type = 'button';
  header.append(title, unitButton);

  const form = el('form', 'search');
  form.setAttribute('role', 'search');
  form.noValidate = true;
  const label = el('label', 'visually-hidden', 'City name');
  label.htmlFor = 'city-input';
  const input = el('input', 'city-input');
  input.id = 'city-input';
  input.type = 'search';
  input.name = 'city';
  input.placeholder = 'Enter city name...';
  input.autocomplete = 'off';
  input.maxLength = 100;
  input.setAttribute('enterkeyhint', 'search');
  const searchButton = el('button', 'search-button', 'Search');
  searchButton.type = 'submit';
  form.append(label, input, searchButton);

  const errorBox = el('p', 'error');
  errorBox.setAttribute('role', 'alert');

  const spinner = el('div', 'spinner');
  spinner.setAttribute('role', 'status');
  const spinnerIcon = el('span', 'spinner-icon');
  spinnerIcon.setAttribute('aria-hidden', 'true');
  spinner.append(spinnerIcon, el('span', 'visually-hidden', 'Loading weather'));

  const placeholder = el('p', 'placeholder', 'Search for a city to see its weather.');

  const weatherBox = el('section', 'weather');
  weatherBox.setAttribute('aria-label', 'Current weather');
  weatherBox.setAttribute('aria-live', 'polite');
  const placeName = el('h2', 'place');
  const conditions = el('p', 'conditions');
  const conditionsIcon = el('span', 'conditions-icon');
  conditionsIcon.setAttribute('aria-hidden', 'true');
  const conditionsLabel = el('span', 'conditions-label');
  conditions.append(conditionsIcon, conditionsLabel);
  const temperature = el('p', 'temperature');
  const highLow = el('p', 'highlow');
  const details = el('dl', 'details');
  const others = el('div', 'others');
  const othersTitle = el('p', 'others-title', 'Other matches');
  const othersList = el('ul', 'others-list');
  others.append(othersTitle, othersList);
  weatherBox.append(placeName, conditions, temperature, highLow, details, others);

  app.append(header, form, errorBox, spinner, placeholder, weatherBox);
  root.replaceChildren(app);

  // ── Draw the current state ────────────────────────────────────────────────

  function detail(name, value) {
    const row = el('div', 'detail');
    row.append(el('dt', 'detail-name', name), el('dd', 'detail-value', value));
    return row;
  }

  function render() {
    const { unit, loading, error, place, matches, weather } = state;

    unitButton.textContent = unit === UNITS.F ? '°F' : '°C';
    unitButton.setAttribute(
      'aria-label',
      unit === UNITS.F ? 'Temperature unit: Fahrenheit. Switch to Celsius.' : 'Temperature unit: Celsius. Switch to Fahrenheit.',
    );

    errorBox.textContent = error;
    spinner.hidden = !loading;
    placeholder.hidden = weather !== null || loading;
    weatherBox.hidden = weather === null;
    weatherBox.setAttribute('aria-busy', String(loading));

    if (weather === null) return;

    placeName.textContent = formatLocation(place);
    conditionsIcon.textContent = weather.conditions.icon;
    conditionsLabel.textContent = weather.conditions.label;
    temperature.textContent = formatTemp(weather.temperature, unit);
    highLow.textContent = `H: ${formatTemp(weather.high, unit)}  L: ${formatTemp(weather.low, unit)}`;
    details.replaceChildren(
      detail('Feels like', formatTemp(weather.feelsLike, unit)),
      detail('Humidity', formatHumidity(weather.humidity)),
      detail('Wind', formatWind(weather.windSpeed, unit)),
      detail('Pressure', formatPressure(weather.pressure)),
      detail('Visibility', formatVisibility(weather.visibility, unit)),
    );

    const alternatives = matches.filter((m) => m.id !== place.id);
    others.hidden = alternatives.length === 0;
    othersList.replaceChildren(
      ...alternatives.map((match) => {
        const item = el('li');
        const button = el('button', 'other-button', formatLocation(match));
        button.type = 'button';
        button.dataset.match = String(matches.indexOf(match));
        item.append(button);
        return item;
      }),
    );
  }

  // ── Loading data ──────────────────────────────────────────────────────────

  // Runs one lookup. Starting a new one cancels the old one, and a late answer
  // from a cancelled lookup is ignored, so results can never arrive out of order.
  async function load(task, rememberCity) {
    const id = ++requestId;
    if (controller) controller.abort();
    controller = new AbortController();
    state = { ...state, loading: true, error: '' };
    render();
    try {
      const result = await task(controller.signal);
      if (id !== requestId) return;
      state = { ...state, ...result, loading: false, error: '' };
      if (rememberCity) write(CITY_KEY, rememberCity);
    } catch (error) {
      if (id !== requestId || (error && error.name === 'AbortError')) return;
      state = { ...state, loading: false, error: messageFor(error) };
    }
    render();
  }

  function search(rawName) {
    const name = rawName.trim();
    if (!name) {
      state = { ...state, error: 'Please enter a city name' };
      render();
      return Promise.resolve();
    }
    return load(async (signal) => {
      const matches = await searchLocations(name, { fetch: doFetch, signal });
      const weather = await getWeather(matches[0], { fetch: doFetch, signal });
      return { matches, place: matches[0], weather };
    }, name);
  }

  function showMatch(match) {
    return load(async (signal) => ({ place: match, weather: await getWeather(match, { fetch: doFetch, signal }) }));
  }

  // ── Events ────────────────────────────────────────────────────────────────

  const onSubmit = (event) => {
    event.preventDefault();
    search(input.value);
  };
  const onUnit = () => {
    state = { ...state, unit: state.unit === UNITS.F ? UNITS.C : UNITS.F };
    write(UNIT_KEY, state.unit);
    render(); // no new request: the numbers are converted on the page
  };
  const onOthers = (event) => {
    const button = event.target.closest('.other-button');
    if (!button) return;
    const match = state.matches[Number(button.dataset.match)];
    if (match) showMatch(match);
  };

  form.addEventListener('submit', onSubmit);
  unitButton.addEventListener('click', onUnit);
  othersList.addEventListener('click', onOthers);

  render();

  // Come back to the last city
  const savedCity = read(CITY_KEY);
  if (savedCity) {
    input.value = savedCity;
    search(savedCity);
  }

  return {
    getState: () => state,
    destroy() {
      requestId++;
      if (controller) controller.abort();
      form.removeEventListener('submit', onSubmit);
      unitButton.removeEventListener('click', onUnit);
      othersList.removeEventListener('click', onOthers);
      root.replaceChildren();
    },
  };
}
