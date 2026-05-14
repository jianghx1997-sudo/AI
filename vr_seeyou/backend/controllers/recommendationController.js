const { dbAsync } = require('../database');
const { getCurrentWeather } = require('../services/weatherService');
const { recommendOutfits } = require('../services/recommendationService');
const { reviewRecommendations } = require('../services/aiReviewService');

function parseItemIds(value) {
  if (Array.isArray(value)) {
    return value.map(id => Number(id)).filter(Number.isFinite);
  }

  const raw = String(value || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(id => Number(id)).filter(Number.isFinite);
    }
  } catch (error) {
    return raw
      .split(/[,，、/|]/)
      .map(id => Number(id.trim()))
      .filter(Number.isFinite);
  }

  return [];
}

function buildOutfitSnapshotKey(outfit, index) {
  const ids = (outfit.items || [])
    .map(item => Number(item.id))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return `${index}-${ids.join('-') || 'empty'}`;
}

function attachSnapshotMetadata(result, snapshotId) {
  return {
    ...result,
    outfits: (result.outfits || []).map((outfit, index) => ({
      ...outfit,
      recommendation_snapshot_id: snapshotId,
      snapshot_outfit_key: buildOutfitSnapshotKey(outfit, index)
    }))
  };
}

async function getOutfitRecommendations(req, res) {
  try {
    const clothes = await dbAsync.getAllClothes({ userId: req.user.id });
    const aiReviewEnabled = req.query.aiReview === 'true' || req.query.aiReview === '1';
    const occasion = req.query.occasion || '休闲';
    let weather = {
      source: 'manual',
      weather: req.query.weather || '晴',
      temperature: req.query.temperature !== undefined ? Number(req.query.temperature) : 22,
      humidity: req.query.humidity !== undefined ? Number(req.query.humidity) : undefined,
      city: req.query.city || ''
    };

    if (req.query.useWeather === 'true') {
      const liveWeather = await getCurrentWeather(req.query.city);
      if (liveWeather.available) {
        weather = liveWeather;
      }
    }

    const feedbackLogs = await dbAsync.getRecommendationLogs({ userId: req.user.id, limit: 80 });
    const result = recommendOutfits(clothes, {
      weather,
      occasion,
      feedbackLogs,
      maxOutfits: aiReviewEnabled ? 5 : 3
    });
    const reviewedResult = await reviewRecommendations(result, {
      weather,
      occasion
    }, {
      enabled: aiReviewEnabled,
      finalLimit: 3
    });
    const snapshot = await dbAsync.addRecommendationSnapshot({
      user_id: req.user.id,
      occasion,
      weather: weather.weather,
      temperature: weather.temperature,
      city: weather.city || req.query.city || '',
      ai_review_enabled: aiReviewEnabled,
      request_context: {
        query: {
          occasion,
          weather: req.query.weather,
          temperature: req.query.temperature,
          city: req.query.city,
          useWeather: req.query.useWeather === 'true',
          aiReview: aiReviewEnabled
        },
        resolved_weather: weather,
        wardrobe_item_count: clothes.length,
        feedback_count: feedbackLogs.length
      },
      result_json: reviewedResult
    });
    const responseResult = attachSnapshotMetadata(reviewedResult, snapshot.id);

    res.json({
      success: true,
      data: {
        recommendation_snapshot_id: snapshot.id,
        weather,
        occasion,
        ai_review_enabled: aiReviewEnabled,
        ...responseResult
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function submitRecommendationFeedback(req, res) {
  try {
    const itemIds = parseItemIds(req.body.item_ids);
    const ownedItemIds = [];
    for (const itemId of itemIds) {
      const cloth = await dbAsync.getClothById(itemId, req.user.id);
      if (cloth) ownedItemIds.push(itemId);
    }

    const feedbackReason = req.body.feedback_reason || req.body.reason || '';
    const feedbackNote = feedbackReason || req.body.note || '';
    const snapshotId = req.body.recommendation_snapshot_id ? Number(req.body.recommendation_snapshot_id) : null;
    if (snapshotId) {
      const snapshot = await dbAsync.getRecommendationSnapshotById(snapshotId, req.user.id);
      if (!snapshot) {
        return res.status(400).json({ success: false, error: '推荐快照不存在或无权访问' });
      }
    }

    const result = await dbAsync.addRecommendationLog({
      recommendation_snapshot_id: snapshotId,
      outfit_key: req.body.outfit_key || req.body.snapshot_outfit_key,
      outfit_name: req.body.outfit_name,
      occasion: req.body.occasion,
      weather: req.body.weather,
      temperature: req.body.temperature,
      item_ids: ownedItemIds,
      feedback: req.body.feedback,
      note: feedbackNote,
      user_id: req.user.id
    });

    const wearLogs = [];
    if (req.body.feedback === 'worn') {
      for (const itemId of ownedItemIds) {
        const cloth = await dbAsync.getClothById(itemId, req.user.id);
        if (!cloth) continue;

        const wearResult = await dbAsync.recordWear(itemId, {
          user_id: req.user.id,
          occasion: req.body.occasion,
          weather: req.body.weather,
          note: feedbackNote || `来自推荐反馈：${req.body.outfit_name || '搭配'}`
        });
        wearLogs.push(wearResult.wear_log);
      }
    }

    res.json({
      success: true,
      data: {
        ...result,
        feedback_reason: feedbackReason,
        wear_logs: wearLogs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getOutfitRecommendations,
  submitRecommendationFeedback
};
