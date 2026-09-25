const baseUrl = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

async function check(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  console.log(`${options.method || 'GET'} ${path} -> ${response.status}`);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${text}`);
  }
  return text;
}

try {
  await check('/');
  await check('/api/v1/health');

  const internalResponse = await fetch(`${baseUrl}/internal/v1/ingestion/candidates`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  console.log(`POST /internal/v1/ingestion/candidates without token -> ${internalResponse.status}`);
  if (internalResponse.status !== 401) {
    throw new Error(`Expected internal ingestion endpoint to require authentication, got ${internalResponse.status}`);
  }

  console.log('Final integration smoke check passed.');
} catch (error) {
  console.error(`Smoke check failed: ${error.message}`);
  process.exitCode = 1;
}
