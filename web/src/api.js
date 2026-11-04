// Talks to Open-Meteo. The fetch function is passed in so tests can fake the network.

import { DataError, buildForecastUrl, buildGeocodingUrl, parseForecast, parseLocations } from './weather.js';

/** The city could not be found. */
export class NotFoundError extends Error {
  constructor(message = 'City not found. Please check the spelling.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** The request could not be completed (offline, blocked, or a server error). */
export class NetworkError extends Error {
  constructor(message = 'Network error.') {
    super(message);
    this.name = 'NetworkError';
  }
}

const MAX_NAME_LENGTH = 100;

const isAbort = (error) => error && error.name === 'AbortError';

async function getJson(url, { fetch: doFetch = globalThis.fetch, signal } = {}) {
  let response;
  try {
    response = await doFetch(url, { signal });
  } catch (error) {
    if (isAbort(error)) throw error; // a cancelled search is not a failure
    throw new NetworkError(error && error.message ? error.message : undefined);
  }
  if (!response.ok) throw new NetworkError(`The weather service answered with status ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new DataError('The weather service sent a response that is not valid JSON.');
  }
}

/** Finds places matching a city name, best match first. Throws NotFoundError when there are none. */
export async function searchLocations(name, options = {}) {
  const query = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
  if (query.length < 2) throw new NotFoundError('Enter at least two characters.');
  const locations = parseLocations(await getJson(buildGeocodingUrl(query), options));
  if (locations.length === 0) throw new NotFoundError();
  return locations;
}

/** Current conditions plus today's high and low for one place. */
export async function getWeather(location, options = {}) {
  return parseForecast(await getJson(buildForecastUrl(location), options));
}
