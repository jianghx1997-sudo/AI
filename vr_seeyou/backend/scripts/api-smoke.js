const assert = require('assert');
require('dotenv').config();

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const username = process.env.SMOKE_USERNAME || 'demo';
const password = process.env.SMOKE_PASSWORD || process.env.DEMO_USER_PASSWORD || 'demo123456';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

(async () => {
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

  console.log('api smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
