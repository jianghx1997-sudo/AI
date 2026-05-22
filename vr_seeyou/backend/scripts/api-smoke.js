const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

const externalBaseUrl = process.env.SMOKE_BASE_URL || '';
let baseUrl = externalBaseUrl;
const username = process.env.SMOKE_USERNAME || 'demo';
const password = process.env.SMOKE_PASSWORD || process.env.DEMO_USER_PASSWORD || 'demo123456';
let isolatedUploadDir = '';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForChildExit(child, timeoutMs = 3000) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    sleep(timeoutMs)
  ]);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const health = await request('/api/health');
      if (health.response.status === 200) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }

  throw lastError || new Error('smoke server did not become ready');
}

async function startIsolatedServer() {
  const port = await getFreePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seeyou-api-smoke-'));
  const backendDir = path.resolve(__dirname, '..');
  const dbPath = path.join(tempDir, 'wardrobe.db');
  const uploadDir = path.join(tempDir, 'uploads');
  isolatedUploadDir = uploadDir;

  const child = spawn(process.execPath, ['server.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(port),
      WARDROBE_DB_PATH: dbPath,
      UPLOAD_DIR: uploadDir,
      MOCK_AI: 'true',
      JWT_SECRET: 'api-smoke-only-secret',
      DEMO_USER_PASSWORD: password,
      MIGRATE_JSON_ON_EMPTY: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });

  baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer();
    await sleep(500);
  } catch (error) {
    if (!child.killed) child.kill();
    await waitForChildExit(child);
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (output.trim()) console.error(output.trim());
    throw error;
  }

  return {
    async stop() {
      if (!child.killed) child.kill();
      await waitForChildExit(child);
      fs.rmSync(tempDir, { recursive: true, force: true });
      isolatedUploadDir = '';
    },
    dumpOutput() {
      if (output.trim()) console.error(output.trim());
    }
  };
}

async function runSmoke() {
  const health = await request('/api/health');
  assert.strictEqual(health.response.status, 200, 'health endpoint should respond 200');

  const unauthorized = await request('/api/clothes');
  assert.strictEqual(unauthorized.response.status, 401, 'clothes endpoint should require auth');

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  assert.strictEqual(login.response.status, 200, 'demo login should succeed');
  assert(login.data?.data?.token, 'login should return token');

  const token = login.data.data.token;
  const queryTokenClothes = await request(`/api/clothes?token=${encodeURIComponent(token)}`);
  assert.strictEqual(queryTokenClothes.response.status, 401, 'normal API endpoints should not accept query token auth');

  const invalidCloth = await request('/api/clothes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Invalid Cloth',
      image_path: '/uploads/temp/not-exist.jpg',
      warmth_level: 9
    })
  });
  assert.strictEqual(invalidCloth.response.status, 400, 'cloth create should reject invalid level values');

  const invalidRecommendations = await request('/api/recommendations/outfits?temperature=999', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(invalidRecommendations.response.status, 400, 'recommendation query should reject invalid temperature');

  const invalidFeedback = await request('/api/recommendations/feedback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ feedback: 'maybe' })
  });
  assert.strictEqual(invalidFeedback.response.status, 400, 'recommendation feedback should reject unknown feedback type');

  const removedLegacyUpload = await request('/api/clothes/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(removedLegacyUpload.response.status, 404, 'legacy one-step upload endpoint should stay removed');

  const me = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(me.response.status, 200, 'me endpoint should respond 200');
  assert.strictEqual(me.data?.data?.username, username, 'me endpoint should return current user');

  const clothes = await request('/api/clothes', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(clothes.response.status, 200, 'authenticated clothes endpoint should respond 200');
  assert(Array.isArray(clothes.data?.data), 'clothes endpoint should return an array');

  if (isolatedUploadDir) {
    const imageName = 'smoke-image.png';
    fs.writeFileSync(
      path.join(isolatedUploadDir, imageName),
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64')
    );

    const created = await request('/api/clothes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Smoke Image Cloth',
        image_path: `/uploads/${imageName}`,
        category: '上衣',
        warmth_level: 3
      })
    });
    assert.strictEqual(created.response.status, 200, 'cloth create should accept a valid permanent upload path');

    const imageWithHeader = await request(`/api/images/${imageName}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(imageWithHeader.response.status, 200, 'image endpoint should accept bearer auth header');

    const imageWithoutHeader = await request(`/api/images/${imageName}`);
    assert.strictEqual(imageWithoutHeader.response.status, 401, 'image endpoint should require auth header');

    const imageWithQueryToken = await request(`/api/images/${imageName}?token=${encodeURIComponent(token)}`);
    assert.strictEqual(imageWithQueryToken.response.status, 401, 'image endpoint should reject query token auth');

    const otherUsername = `smoke_other_${Date.now()}`;
    const otherPassword = 'other123456';
    const otherRegister = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: otherUsername,
        password: otherPassword,
        display_name: 'Smoke Other'
      })
    });
    assert.strictEqual(otherRegister.response.status, 200, 'second smoke user should register');
    const otherToken = otherRegister.data?.data?.token;
    assert(otherToken, 'second smoke user should receive token');

    const otherImageName = 'smoke-other-image.png';
    fs.writeFileSync(
      path.join(isolatedUploadDir, otherImageName),
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64')
    );

    const otherCreated = await request('/api/clothes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: JSON.stringify({
        name: 'Other User Cloth',
        image_path: `/uploads/${otherImageName}`,
        category: '裤子',
        warmth_level: 2
      })
    });
    assert.strictEqual(otherCreated.response.status, 200, 'second user should create own cloth');

    const primaryList = await request('/api/clothes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(primaryList.response.status, 200, 'primary user list should respond 200');
    assert(
      primaryList.data.data.some(item => item.name === 'Smoke Image Cloth'),
      'primary user should see own cloth'
    );
    assert(
      !primaryList.data.data.some(item => item.name === 'Other User Cloth'),
      'primary user should not see second user cloth'
    );

    const otherList = await request('/api/clothes', {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.strictEqual(otherList.response.status, 200, 'second user list should respond 200');
    assert(
      otherList.data.data.some(item => item.name === 'Other User Cloth'),
      'second user should see own cloth'
    );
    assert(
      !otherList.data.data.some(item => item.name === 'Smoke Image Cloth'),
      'second user should not see primary user cloth'
    );

    const otherReadsPrimary = await request(`/api/clothes/${created.data.data.id}`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.strictEqual(otherReadsPrimary.response.status, 404, 'second user should not read primary user cloth by id');

    const otherReadsPrimaryImage = await request(`/api/images/${imageName}`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.strictEqual(otherReadsPrimaryImage.response.status, 404, 'second user should not read primary user image');

    const otherStats = await request('/api/stats/categories', {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.strictEqual(otherStats.response.status, 200, 'second user stats should respond 200');
    assert(
      otherStats.data.data.some(item => item.category === '裤子' && item.count === 1),
      'second user stats should include only own category'
    );
    assert(
      !otherStats.data.data.some(item => item.category === '涓婅。'),
      'second user stats should not include primary user category'
    );
  }

  const recommendations = await request('/api/recommendations/outfits?aiReview=false&weather=%E6%99%B4&temperature=22', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(recommendations.response.status, 200, 'recommendations endpoint should respond 200');
  assert(recommendations.data?.data?.recommendation_snapshot_id, 'recommendations should create a replayable snapshot');

  const firstOutfit = recommendations.data.data.outfits?.[0];
  if (firstOutfit) {
    const feedback = await request('/api/recommendations/feedback', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recommendation_snapshot_id: recommendations.data.data.recommendation_snapshot_id,
        outfit_key: firstOutfit.snapshot_outfit_key,
        outfit_name: firstOutfit.name,
        occasion: firstOutfit.occasion,
        weather: recommendations.data.data.weather?.weather,
        temperature: recommendations.data.data.weather?.temperature,
        item_ids: firstOutfit.items.map(item => item.id),
        feedback: 'viewed'
      })
    });
    assert.strictEqual(feedback.response.status, 200, 'recommendation feedback should accept owned snapshot linkage');
  }
}

(async () => {
  const server = externalBaseUrl ? null : await startIsolatedServer();
  try {
    await runSmoke();
    console.log(`api smoke passed (${externalBaseUrl ? 'external server' : 'isolated temp server'})`);
  } catch (error) {
    if (server) server.dumpOutput();
    throw error;
  } finally {
    if (server) await server.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
