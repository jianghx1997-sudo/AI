const { dbAsync } = require('../database');
const { getCurrentWeather } = require('../services/weatherService');
const { recommendOutfits } = require('../services/recommendationService');
const { reviewRecommendations } = require('../services/aiReviewService');
const {
  validateRecommendationQuery,
  validateRecommendationFeedback,
  sendValidationError
} = require('../utils/validation');

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
    const validation = validateRecommendationQuery(req.query);
    if (!validation.ok) {
      return sendValidationError(res, validation.errors);
    }

    const {
      occasion,
      aiReviewEnabled,
      useWeather,
      weather: manualWeather
    } = validation.value;
    const clothes = await dbAsync.getAllClothes({ userId: req.user.id });
    let weather = manualWeather;

    if (useWeather) {
      const liveWeather = await getCurrentWeather(manualWeather.city);
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
          weather: manualWeather.weather,
          temperature: manualWeather.temperature,
          city: manualWeather.city,
          useWeather,
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
    const validation = validateRecommendationFeedback(req.body);
    if (!validation.ok) {
      return sendValidationError(res, validation.errors);
    }

    const feedbackPayload = validation.value;
    const itemIds = parseItemIds(req.body.item_ids);
    const ownedItemIds = [];
    for (const itemId of itemIds) {
      const cloth = await dbAsync.getClothById(itemId, req.user.id);
      if (cloth) ownedItemIds.push(itemId);
    }

    const feedbackReason = feedbackPayload.feedback_reason || '';
    const feedbackNote = feedbackReason || feedbackPayload.note || '';
    const snapshotId = feedbackPayload.recommendation_snapshot_id || null;
    if (snapshotId) {
      const snapshot = await dbAsync.getRecommendationSnapshotById(snapshotId, req.user.id);
      if (!snapshot) {
        return res.status(400).json({ success: false, error: '推荐快照不存在或无权访问' });
      }
    }

    const result = await dbAsync.addRecommendationLog({
      recommendation_snapshot_id: snapshotId,
      outfit_key: feedbackPayload.outfit_key,
      outfit_name: feedbackPayload.outfit_name,
      occasion: feedbackPayload.occasion,
      weather: feedbackPayload.weather,
      temperature: feedbackPayload.temperature,
      item_ids: ownedItemIds,
      feedback: feedbackPayload.feedback,
      note: feedbackNote,
      user_id: req.user.id
    });

    const wearLogs = [];
    if (feedbackPayload.feedback === 'worn') {
      for (const itemId of ownedItemIds) {
        const cloth = await dbAsync.getClothById(itemId, req.user.id);
        if (!cloth) continue;

        const wearResult = await dbAsync.recordWear(itemId, {
          user_id: req.user.id,
          occasion: feedbackPayload.occasion,
          weather: feedbackPayload.weather,
          note: feedbackNote || `来自推荐反馈：${feedbackPayload.outfit_name || '搭配'}`
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
