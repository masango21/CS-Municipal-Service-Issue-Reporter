const test = require('node:test');
const assert = require('node:assert/strict');
const { listOfficialMunicipalities, resolveMunicipality, reverseGeocode, validateCoordinates } = require('../location');

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
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
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