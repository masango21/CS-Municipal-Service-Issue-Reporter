const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AssistantProviderError, getAssistantReply } = require('../ai-assistant');

const knowledge = {
  categories: ['Pothole', 'Broken Streetlight'],
  statuses: ['Reported', 'Under Review', 'Resolved'],
  priorities: ['Low', 'Medium', 'High', 'Critical'],
};

function createResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('Ollama sends bounded history and verified municipal context to the local chat API', async () => {
  let captured;
  const reply = await getAssistantReply({
    ...knowledge,
    baseUrl: 'http://127.0.0.1:11434/',
    model: 'llama3.2:3b',
    messages: [
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier answer' },
      { role: 'user', content: 'What is the status?' },
    ],
    reportContext: { reference: 'ISSUE-1', status: 'Under Review' },
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return createResponse(200, { message: { role: 'assistant', content: 'The verified status is Under Review.' } });
    },
  });

  assert.equal(reply, 'The verified status is Under Review.');
  assert.equal(captured.url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['Content-Type'], 'application/json');
  assert.equal(captured.options.headers.Authorization, undefined);
  assert.equal(captured.body.model, 'llama3.2:3b');
  assert.equal(captured.body.stream, false);
  assert.match(captured.body.messages[0].content, /Broken Streetlight/);
  assert.match(captured.body.messages[0].content, /Under Review/);
  assert.match(captured.body.messages[0].content, /Do not ask residents for their name/);
  assert.match(captured.body.messages[0].content, /After describing how to submit, stop/);
  assert.match(captured.body.messages[0].content, /do not say or imply that the system, staff, or municipality will handle the report/);
  assert.match(captured.body.messages[0].content, /Never claim that a report is forwarded, assigned, reviewed, or acted on/);
  assert.match(captured.body.messages[0].content, /Do not invent or assign a reference number or status/);
  assert.deepEqual(captured.body.messages.slice(1, 3), [
    { role: 'user', content: 'Earlier question' },
    { role: 'assistant', content: 'Earlier answer' },
  ]);
  assert.match(captured.body.messages[3].content, /Verified report data/);
});

test('Ollama provider uses the project model when configuration is unset or blank', async () => {
  let captured;
  const reply = await getAssistantReply({
    ...knowledge,
    baseUrl: 'http://127.0.0.1:11434',
    model: '',
    messages: [{ role: 'user', content: 'Hello' }],
    fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body);
      return createResponse(200, { message: { content: 'Hello.' } });
    },
  });

  assert.equal(reply, 'Hello.');
  assert.equal(captured.model, 'llama3.2:3b');
});

test('production Ollama Cloud defaults its host and keeps credentials server-side', async () => {
  const base = {
    ...knowledge,
    model: 'account-model',
    messages: [{ role: 'user', content: 'Hello' }],
    apiKey: 'test-provider-key',
    production: true,
  };
  let requestCount = 0;
  let capturedUrl;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    requestCount += 1;
    assert.equal(options.headers.Authorization, 'Bearer test-provider-key');
    assert.equal(options.body.includes('test-provider-key'), false);
    return createResponse(200, { message: { content: 'Hello.' } });
  };

  const defaultCloudReply = await getAssistantReply({ ...base, baseUrl: '', fetchImpl });
  assert.equal(defaultCloudReply, 'Hello.');
  assert.equal(capturedUrl, 'https://ollama.com/api/chat');
  await assert.rejects(
    getAssistantReply({
      ...base,
      baseUrl: 'http://ollama.example.test',
      fetchImpl,
    }),
    (error) => error instanceof AssistantProviderError && error.code === 'invalid_configuration',
  );
  await assert.rejects(
    getAssistantReply({
      ...base,
      baseUrl: 'https://127.0.0.1:11434',
      fetchImpl,
    }),
    (error) => error instanceof AssistantProviderError && error.code === 'invalid_configuration',
  );

  const reply = await getAssistantReply({
    ...base,
    baseUrl: 'https://ollama.example.test',
    apiKey: 'test-provider-key',
    fetchImpl,
  });
  assert.equal(reply, 'Hello.');
  assert.equal(requestCount, 2);
});

test('Ollama Cloud reports an unavailable model without exposing provider details', async () => {
  let requestCount = 0;
  for (const status of [400, 404]) {
    await assert.rejects(
      getAssistantReply({
        ...knowledge,
        model: 'account-model',
        apiKey: 'test-provider-key',
        production: true,
        messages: [{ role: 'user', content: 'Hello' }],
        fetchImpl: async () => {
          requestCount += 1;
          return createResponse(status, { error: "model 'account-model' not found" });
        },
      }),
      (error) => error instanceof AssistantProviderError &&
        error.code === 'model_unavailable' &&
        error.message.includes('OLLAMA_MODEL') &&
        !error.message.includes('account-model'),
    );
  }
  assert.equal(requestCount, 2);
});

test('Ollama Cloud requires an explicit production model and API key', async () => {
  const base = {
    ...knowledge,
    production: true,
    messages: [{ role: 'user', content: 'Hello' }],
    fetchImpl: async () => assert.fail('Provider must not be called with missing configuration'),
  };

  await assert.rejects(
    getAssistantReply({ ...base, model: '', apiKey: 'test-provider-key' }),
    (error) => error instanceof AssistantProviderError && error.code === 'model_not_configured',
  );
  await assert.rejects(
    getAssistantReply({ ...base, model: 'account-model', apiKey: '' }),
    (error) => error instanceof AssistantProviderError && error.code === 'api_key_not_configured',
  );
});

test('Ollama Cloud returns safe authentication and rate-limit errors', async () => {
  const base = {
    ...knowledge,
    model: 'account-model',
    apiKey: 'test-provider-key',
    production: true,
    messages: [{ role: 'user', content: 'Hello' }],
  };

  for (const status of [401, 403]) {
    await assert.rejects(
      getAssistantReply({
        ...base,
        fetchImpl: async () => createResponse(status, { error: 'private credential detail' }),
      }),
      (error) => error instanceof AssistantProviderError &&
        error.code === 'invalid_credentials' &&
        !error.message.includes('private credential detail') &&
        !error.message.includes('test-provider-key'),
    );
  }

  await assert.rejects(
    getAssistantReply({
      ...base,
      fetchImpl: async () => createResponse(429, { error: 'private usage detail' }),
    }),
    (error) => error instanceof AssistantProviderError &&
      error.code === 'rate_limited' &&
      !error.message.includes('private usage detail'),
  );
});

test('Ollama provider safely handles service, malformed, empty, and oversized responses', async () => {
  const base = {
    ...knowledge,
    model: 'llama3.2:3b',
    messages: [{ role: 'user', content: 'Hello' }],
  };

  await assert.rejects(
    getAssistantReply({
      ...base,
      fetchImpl: async () => createResponse(503, { error: 'private internal detail' }),
    }),
    (error) => error instanceof AssistantProviderError &&
      error.code === 'provider_error' &&
      !error.message.includes('private internal detail'),
  );
  await assert.rejects(
    getAssistantReply({
      ...base,
      fetchImpl: async () => { throw new Error('127.0.0.1 connection details'); },
    }),
    (error) => error instanceof AssistantProviderError &&
      error.code === 'ollama_unavailable' &&
      !error.message.includes('127.0.0.1'),
  );
  await assert.rejects(
    getAssistantReply({
      ...base,
      fetchImpl: async () => ({ ...createResponse(200, null), json: async () => { throw new Error('bad JSON'); } }),
    }),
    (error) => error instanceof AssistantProviderError && error.code === 'invalid_response',
  );
  await assert.rejects(
    getAssistantReply({
      ...base,
      fetchImpl: async () => createResponse(200, { message: { content: '  ' } }),
    }),
    (error) => error instanceof AssistantProviderError && error.code === 'empty_response',
  );
  await assert.rejects(
    getAssistantReply({
      ...base,
      fetchImpl: async () => createResponse(200, { message: { content: 'x'.repeat(4001) } }),
    }),
    (error) => error instanceof AssistantProviderError && error.code === 'invalid_response',
  );
});

test('Ollama provider converts timeouts into safe errors', async () => {
  await assert.rejects(
    getAssistantReply({
      ...knowledge,
      model: 'llama3.2:3b',
      messages: [{ role: 'user', content: 'Hello' }],
      timeoutMs: 5,
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
    }),
    (error) => error instanceof AssistantProviderError && error.code === 'timeout',
  );
});
