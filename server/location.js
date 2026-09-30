const DEFAULT_MDB_LAYER_URL = 'https://services7.arcgis.com/oeoyTUJC8HEeYsRB/arcgis/rest/services/LocalMunicipalities2018_Final/FeatureServer/0';
const DEFAULT_REVERSE_GEOCODER_URL = 'https://nominatim.openstreetmap.org/reverse';
const DEFAULT_USER_AGENT = 'MunicipalServiceIssueReporter/1.0';
const PROVINCE_NAMES = {
  EC: 'Eastern Cape',
  FS: 'Free State',
  GP: 'Gauteng',
  GT: 'Gauteng',
  KZN: 'KwaZulu-Natal',
  LP: 'Limpopo',
  MP: 'Mpumalanga',
  NC: 'Northern Cape',
  NW: 'North West',
  WC: 'Western Cape',
};
const reverseCache = new Map();
let lastReverseRequestAt = 0;
let reverseRequestQueue = Promise.resolve();

function normalizeMunicipalityCode(value) {
  const sourceCode = String(value || '').trim();
  return sourceCode.match(/\(([A-Z0-9-]+)\)$/i)?.[1] || sourceCode;
}

function normalizeProvince(value) {
  const province = String(value || '').trim();
  return PROVINCE_NAMES[province.toUpperCase()] || province;
}

function validateCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -35.5 && latitude <= -22 && longitude >= 16 && longitude <= 33;
}

async function requestJson(url, fetchImpl, headers = {}) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Location provider request failed');
  const payload = await response.json();
  if (payload.error) throw new Error('Location provider returned an error');
  return payload;
}

async function resolveMunicipality(latitude, longitude, options = {}) {
  if (!validateCoordinates(latitude, longitude)) return null;

  const layerUrl = options.layerUrl || process.env.MDB_MUNICIPALITY_FEATURE_LAYER_URL || DEFAULT_MDB_LAYER_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const queryUrl = new URL(`${layerUrl.replace(/\/$/, '')}/query`);
  queryUrl.searchParams.set('where', '1=1');
  queryUrl.searchParams.set('geometry', JSON.stringify({
    x: longitude,
    y: latitude,
    spatialReference: { wkid: 4326 },
  }));
  queryUrl.searchParams.set('geometryType', 'esriGeometryPoint');
  queryUrl.searchParams.set('inSR', '4326');
  queryUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  queryUrl.searchParams.set('outFields', 'MUNICNAME,NAMECODE,PROVINCE,CATEGORY');
  queryUrl.searchParams.set('returnGeometry', 'false');
  queryUrl.searchParams.set('f', 'json');

  const payload = await requestJson(queryUrl, fetchImpl);
  const matches = new Map();
  for (const feature of payload.features || []) {
    const attributes = feature?.attributes;
    if (attributes?.MUNICNAME && attributes?.NAMECODE) {
      matches.set(String(attributes.NAMECODE), attributes);
    }
  }
  if (matches.size !== 1) return null;
  const attributes = matches.values().next().value;
  return {
    name: String(attributes.MUNICNAME).trim(),
    code: normalizeMunicipalityCode(attributes.NAMECODE),
    province: normalizeProvince(attributes.PROVINCE),
    type: String(attributes.CATEGORY || '').trim(),
    boundarySource: 'Municipal Demarcation Board',
    boundaryDataset: 'MDB Local Municipalities 2021 item; linked service describes Local Municipalities 2018',
  };
}

async function listOfficialMunicipalities(options = {}) {
  const layerUrl = options.layerUrl || process.env.MDB_MUNICIPALITY_FEATURE_LAYER_URL || DEFAULT_MDB_LAYER_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const queryUrl = new URL(`${layerUrl.replace(/\/$/, '')}/query`);
  queryUrl.searchParams.set('where', '1=1');
  queryUrl.searchParams.set('outFields', 'MUNICNAME,NAMECODE,PROVINCE,CATEGORY');
  queryUrl.searchParams.set('returnGeometry', 'false');
  queryUrl.searchParams.set('resultRecordCount', '1000');
  queryUrl.searchParams.set('f', 'json');
  const payload = await requestJson(queryUrl, fetchImpl);
  if (payload.exceededTransferLimit) throw new Error('Municipality source returned an incomplete directory');

  return (payload.features || []).flatMap((feature) => {
    const attributes = feature?.attributes;
    if (!attributes?.MUNICNAME || !attributes?.NAMECODE) return [];
    return [{
      id: normalizeMunicipalityCode(attributes.NAMECODE),
      code: normalizeMunicipalityCode(attributes.NAMECODE),
      name: String(attributes.MUNICNAME).trim(),
      province: normalizeProvince(attributes.PROVINCE),
      type: String(attributes.CATEGORY || '').trim(),
      boundarySource: 'Municipal Demarcation Board',
      boundaryDataset: 'MDB Local Municipalities 2021 item; linked service describes Local Municipalities 2018',
    }];
  });
}

function municipalityFromAddress(address = {}) {
  return address.city || address.town || address.village || address.municipality || '';
}

async function waitForReverseGeocoderSlot(minIntervalMs) {
  const nextRequest = reverseRequestQueue.then(async () => {
    const waitMs = Math.max(0, minIntervalMs - (Date.now() - lastReverseRequestAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastReverseRequestAt = Date.now();
  });
  reverseRequestQueue = nextRequest.catch(() => {});
  await nextRequest;
}

async function reverseGeocode(latitude, longitude, options = {}) {
  if (!validateCoordinates(latitude, longitude)) return null;
  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (reverseCache.has(cacheKey)) return reverseCache.get(cacheKey);

  const endpoint = options.endpoint || process.env.REVERSE_GEOCODER_URL || DEFAULT_REVERSE_GEOCODER_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const minIntervalMs = options.minIntervalMs ?? 1000;
  if (minIntervalMs > 0) await waitForReverseGeocoderSlot(minIntervalMs);
  const url = new URL(endpoint);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('addressdetails', '1');

  const contact = process.env.GEOCODING_CONTACT;
  const userAgent = process.env.GEOCODING_USER_AGENT || `${DEFAULT_USER_AGENT}${contact ? ` (${contact})` : ''}`;
  const payload = await requestJson(url, fetchImpl, { 'User-Agent': userAgent });
  if (!payload.display_name) return null;

  const result = {
    address: String(payload.display_name),
    city: municipalityFromAddress(payload.address),
    attribution: '© OpenStreetMap contributors',
  };
  reverseCache.set(cacheKey, result);
  if (reverseCache.size > 1000) reverseCache.delete(reverseCache.keys().next().value);
  return result;
}

async function resolveLocation(latitude, longitude, options = {}) {
  const [municipalityResult, addressResult] = await Promise.allSettled([
    resolveMunicipality(latitude, longitude, options),
    reverseGeocode(latitude, longitude, options),
  ]);
  if (municipalityResult.status === 'rejected') throw municipalityResult.reason;
  const municipality = municipalityResult.status === 'fulfilled' ? municipalityResult.value : null;
  const address = addressResult.status === 'fulfilled' ? addressResult.value : null;
  if (!municipality) return null;
  return {
    latitude,
    longitude,
    address: address?.address || '',
    city: address?.city || municipality.name,
    municipality: municipality.name,
    municipalityId: municipality.code,
    province: municipality.province,
    municipalityType: municipality.type,
    boundarySource: municipality.boundarySource,
    boundaryDataset: municipality.boundaryDataset,
    geocodingAttribution: address?.attribution || '',
  };
}

module.exports = {
  DEFAULT_MDB_LAYER_URL,
  DEFAULT_REVERSE_GEOCODER_URL,
  resolveMunicipality,
  listOfficialMunicipalities,
  reverseGeocode,
  resolveLocation,
  validateCoordinates,
};