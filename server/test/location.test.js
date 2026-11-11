const test = require('node:test');
const assert = require('node:assert/strict');
const {
  listOfficialMunicipalities,
  resolveLocation,
  resolveMunicipality,
  reverseGeocode,
  validateCoordinates,
} = require('../location');

test('validates the existing South African service bounds', () => {
  assert.equal(validateCoordinates(-25.7, 28.2), true);
  assert.equal(validateCoordinates(40, -74), false);
  assert.equal(validateCoordinates(Number.NaN, 28), false);
});

test('resolves municipality name, code, province and type from MDB feature attributes', async () => {
  let requestedUrl;
  const municipality = await resolveMunicipality(-25.7, 28.2, {
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({ features: [{ attributes: {
          MUNICNAME: 'Example Metropolitan Municipality',
          NAMECODE: 'ZA-EXAMPLE',
          PROVINCE: 'Gauteng',
          CATEGORY: 'A',
        } }] }),
      };
    },
  });

  assert.equal(requestedUrl.searchParams.get('geometryType'), 'esriGeometryPoint');
  assert.equal(JSON.parse(requestedUrl.searchParams.get('geometry')).x, 28.2);
  assert.equal(requestedUrl.searchParams.get('returnGeometry'), 'false');
  assert.deepEqual(municipality, {
    name: 'Example Metropolitan Municipality',
    code: 'ZA-EXAMPLE',
    province: 'Gauteng',
    type: 'A',
    boundarySource: 'Municipal Demarcation Board',
    boundaryDataset: 'MDB Local Municipalities 2021 item; linked service describes Local Municipalities 2018',
  });
});

test('fails closed when MDB has no polygon match or reports a provider error', async () => {
  const noMatch = await resolveMunicipality(-25.7, 28.2, {
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    fetchImpl: async () => ({ ok: true, json: async () => ({ features: [] }) }),
  });
  assert.equal(noMatch, null);

  const ambiguous = await resolveMunicipality(-25.7, 28.2, {
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    fetchImpl: async () => ({ ok: true, json: async () => ({ features: [
      { attributes: { MUNICNAME: 'First', NAMECODE: 'ZA-1' } },
      { attributes: { MUNICNAME: 'Second', NAMECODE: 'ZA-2' } },
    ] }) }),
  });
  assert.equal(ambiguous, null);

  await assert.rejects(() => resolveMunicipality(-25.7, 28.2, {
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  }), /Location provider request failed/);
});

test('reverse geocodes with the configured endpoint and caches successful results', async () => {
  let callCount = 0;
  const options = {
    endpoint: 'https://geocoder.example.test/reverse',
    minIntervalMs: 0,
    fetchImpl: async (url, init) => {
      callCount += 1;
      const requestUrl = new URL(url);
      assert.equal(requestUrl.searchParams.get('lat'), '-25.7');
      assert.equal(requestUrl.searchParams.get('lon'), '28.2');
      assert.match(init.headers['User-Agent'], /MunicipalServiceIssueReporter/);
      return {
        ok: true,
        json: async () => ({
          display_name: '1 Main Road, Example, Gauteng, South Africa',
          address: { city: 'Example' },
        }),
      };
    },
  };

  const first = await reverseGeocode(-25.7, 28.2, options);
  const second = await reverseGeocode(-25.7, 28.2, options);
  assert.deepEqual(first, second);
  assert.equal(first.city, 'Example');
  assert.equal(callCount, 1);
});

test('location resolution marks a returned street address as found', async () => {
  const location = await resolveLocation(-25.74, 28.24, {
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    endpoint: 'https://found-geocoder.example.test/reverse',
    minIntervalMs: 0,
    fetchImpl: async (url) => {
      if (new URL(url).hostname === 'mdb.example.test') {
        return {
          ok: true,
          json: async () => ({ features: [{ attributes: {
            MUNICNAME: 'Confirmed Municipality',
            NAMECODE: 'ZA-CONFIRMED',
            PROVINCE: 'Gauteng',
            CATEGORY: 'B',
          } }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          display_name: '12 Example Street, Pretoria',
          address: { city: 'Pretoria' },
        }),
      };
    },
  });

  assert.equal(location.address, '12 Example Street, Pretoria');
  assert.equal(location.addressLookupStatus, 'found');
});

test('location resolution keeps the official municipality when address lookup fails', async () => {
  const location = await resolveLocation(-25.7, 28.2, {
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    endpoint: 'https://offline-geocoder.example.test/reverse',
    minIntervalMs: 0,
    fetchImpl: async (url) => {
      if (new URL(url).hostname === 'mdb.example.test') {
        return {
          ok: true,
          json: async () => ({ features: [{ attributes: {
            MUNICNAME: 'Example Municipality',
            NAMECODE: 'ZA-EXAMPLE',
            PROVINCE: 'Gauteng',
            CATEGORY: 'B',
          } }] }),
        };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    },
  });

  assert.equal(location.latitude, -25.7);
  assert.equal(location.longitude, 28.2);
  assert.equal(location.municipality, 'Example Municipality');
  assert.equal(location.municipalityId, 'ZA-EXAMPLE');
  assert.equal(location.city, 'Example Municipality');
  assert.equal(location.address, '');
  assert.equal(location.addressLookupStatus, 'unavailable');
  assert.equal(location.geocodingAttribution, '');
});

test('reverse geocoder treats missing addresses as not found instead of provider failures', async () => {
  const noResult = await reverseGeocode(-25.71, 28.21, {
    endpoint: 'https://empty-geocoder.example.test/reverse',
    minIntervalMs: 0,
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  });
  assert.equal(noResult, null);

  const notFound = await reverseGeocode(-25.72, 28.22, {
    endpoint: 'https://not-found-geocoder.example.test/reverse',
    minIntervalMs: 0,
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ error: 'Unable to geocode' }) }),
  });
  assert.equal(notFound, null);

  const resolvedWithoutAddress = await resolveLocation(-25.75, 28.25, {
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    endpoint: 'https://empty-result-geocoder.example.test/reverse',
    minIntervalMs: 0,
    fetchImpl: async (url) => {
      if (new URL(url).hostname === 'mdb.example.test') {
        return {
          ok: true,
          json: async () => ({ features: [{ attributes: {
            MUNICNAME: 'Confirmed Municipality',
            NAMECODE: 'ZA-CONFIRMED',
            PROVINCE: 'Gauteng',
            CATEGORY: 'B',
          } }] }),
        };
      }
      return { ok: true, json: async () => ({}) };
    },
  });
  assert.equal(resolvedWithoutAddress.address, '');
  assert.equal(resolvedWithoutAddress.addressLookupStatus, 'not_found');
  assert.equal(resolvedWithoutAddress.municipality, 'Confirmed Municipality');
});

test('reverse geocoder distinguishes provider failures without losing municipality confirmation', async () => {
  const failureCases = [
    ['http_429', async () => ({ ok: false, status: 429, json: async () => ({}) })],
    ['network_error', async () => { throw new TypeError('private endpoint details'); }],
    ['invalid_response', async () => ({ ok: true, json: async () => { throw new SyntaxError('private response details'); } })],
  ];

  for (const [expectedCode, geocoderFetch] of failureCases) {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args);
    let location;
    try {
      location = await resolveLocation(-25.73, 28.23, {
        layerUrl: 'https://mdb.example.test/FeatureServer/0',
        endpoint: `https://${expectedCode}.example.test/reverse`,
        minIntervalMs: 0,
        fetchImpl: async (url, init) => {
          if (new URL(url).hostname === 'mdb.example.test') {
            return {
              ok: true,
              json: async () => ({ features: [{ attributes: {
                MUNICNAME: 'Confirmed Municipality',
                NAMECODE: 'ZA-CONFIRMED',
                PROVINCE: 'Gauteng',
                CATEGORY: 'B',
              } }] }),
            };
          }
          return geocoderFetch(url, init);
        },
      });
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(location.latitude, -25.73);
    assert.equal(location.longitude, 28.23);
    assert.equal(location.municipality, 'Confirmed Municipality');
    assert.equal(location.addressLookupStatus, 'unavailable');
    assert.equal(warnings.length, 1);
    assert.deepEqual(warnings[0], ['Reverse geocoder request failed:', { code: expectedCode }]);
    assert.doesNotMatch(JSON.stringify(warnings), /private endpoint details|private response details/);
  }
});

test('lists only municipality records supplied by the MDB layer', async () => {
  const municipalities = await listOfficialMunicipalities({
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    fetchImpl: async (url) => {
      const requestUrl = new URL(url);
      assert.equal(requestUrl.searchParams.get('returnGeometry'), 'false');
      return { ok: true, json: async () => ({ features: [{ attributes: {
        MUNICNAME: 'Example Local Municipality',
        NAMECODE: 'Example Local Municipality (ZA-EXAMPLE)',
        PROVINCE: 'GT',
        CATEGORY: 'B',
      } }] }) };
    },
  });
  assert.equal(municipalities.length, 1);
  assert.equal(municipalities[0].id, 'ZA-EXAMPLE');
  assert.equal(municipalities[0].province, 'Gauteng');
  assert.equal(municipalities[0].boundarySource, 'Municipal Demarcation Board');
});

test('normalizes MDB NAMECODE suffixes and province abbreviations without guessing jurisdiction', async () => {
  const municipality = await resolveMunicipality(-25.7, 28.2, {
    layerUrl: 'https://mdb.example.test/FeatureServer/0',
    fetchImpl: async () => ({ ok: true, json: async () => ({ features: [{ attributes: {
      MUNICNAME: 'City of Tshwane',
      NAMECODE: 'City of Tshwane (TSH)',
      PROVINCE: 'GT',
      CATEGORY: 'A',
    } }] }) }),
  });
  assert.equal(municipality.code, 'TSH');
  assert.equal(municipality.province, 'Gauteng');
});