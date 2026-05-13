const express = require('express');

const { dbAsync } = require('../database');
const { recognizeClothing } = require('../aiService');
const { requireAuth } = require('../middleware/auth');
const { analyzeWardrobe } = require('../services/wardrobeAnalysisService');
const { getCurrentWeather, locateByIp, reverseGeocode } = require('../services/weatherService');
const { recommendOutfits } = require('../services/recommendationService');
const { reviewRecommendations } = require('../services/aiReviewService');
const {
  createImageUpload,
  moveTempUploadToPermanent,
  removeUploadedImage,
  toPublicUploadPath
} = require('../services/uploadService');

const router = express.Router();
const recognizeUpload = createImageUpload({ temp: true });
const legacyUpload = createImageUpload();

router.use(requireAuth);

const CLOTH_FIELDS = [
  'name',
  'image_path',
  'category',
  'color',
  'season',
  'material',
  'style',
  'occasion',
  'fit',
  'brand',
  'purchase_date',
  'tags',
  'confidence',
  'source'
];

function pickClothPayload(body) {
  const payload = {};
  CLOTH_FIELDS.forEach(field => {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  });
  return payload;
}

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

async function recognizeFile(file) {
  const imagePath = file.path;
  const originalName = file.originalname;

  console.log(`📤 收到识别上传: ${originalName} -> ${file.filename}`);
  const aiResult = await recognizeClothing(imagePath, originalName);
  console.log('🤖 AI识别结果:', aiResult);

  return aiResult;
}

function normalizeClientIp(ip = '') {
  return String(ip).replace(/^::ffff:/, '').trim();
}

function isPrivateOrLocalIp(ip = '') {
  const value = normalizeClientIp(ip);
  if (!value || value === '::1' || value === '127.0.0.1' || value === 'localhost') return true;
  if (value.startsWith('10.') || value.startsWith('192.168.')) return true;

  const match = value.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

router.post('/clothes/recognize', recognizeUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传图片文件' });
    }

    const aiResult = await recognizeFile(req.file);
    const imagePath = toPublicUploadPath(req.file.filename, { temp: true });

    res.json({
      success: true,
      data: {
        image_path: imagePath,
        original_name: req.file.originalname,
        persisted: false
      },
      ai_result: aiResult
    });
  } catch (error) {
    console.error('识别处理失败:', error);
    if (req.file) {
      return res.json({
        success: false,
        error: error.message || '识别失败',
        data: {
          image_path: toPublicUploadPath(req.file.filename, { temp: true }),
          original_name: req.file.originalname,
          persisted: false
        }
      });
    }
    res.status(500).json({ success: false, error: error.message || '识别失败' });
  }
});

router.post('/clothes', async (req, res) => {
  try {
    const payload = pickClothPayload(req.body);

    if (!payload.image_path) {
      return res.status(400).json({ success: false, error: '缺少衣物图片路径' });
    }
    if (!payload.name) {
      return res.status(400).json({ success: false, error: '缺少衣物名称' });
    }

    payload.image_path = moveTempUploadToPermanent(payload.image_path);
    payload.user_id = req.user.id;

    const cloth = await dbAsync.addCloth(payload);
    res.json({ success: true, data: cloth, message: '保存成功' });
  } catch (error) {
    console.error('保存衣物失败:', error);
    res.status(500).json({ success: false, error: error.message || '保存失败' });
  }
});

// 兼容旧接口：上传后立即识别并保存。新前端使用 /clothes/recognize + /clothes。
router.post('/clothes/upload', legacyUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传图片文件' });
    }

    const aiResult = await recognizeFile(req.file);
    const cloth = await dbAsync.addCloth({
      user_id: req.user.id,
      name: aiResult.name,
      image_path: toPublicUploadPath(req.file.filename),
      category: aiResult.category,
      color: aiResult.color,
      season: aiResult.season,
      material: aiResult.material,
      style: aiResult.style,
      tags: aiResult.tags,
      confidence: aiResult.confidence,
      source: aiResult.raw?.source || 'mock'
    });

    res.json({
      success: true,
      data: cloth,
      ai_result: aiResult
    });
  } catch (error) {
    console.error('上传处理失败:', error);
    res.status(500).json({ success: false, error: error.message || '处理失败' });
  }
});

router.get('/clothes', async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      color: req.query.color,
      season: req.query.season,
      occasion: req.query.occasion,
      search: req.query.search || req.query.keyword
    };

    if (req.query.is_favorite !== undefined) {
      filters.is_favorite = req.query.is_favorite === 'true' || req.query.is_favorite === '1';
    }

    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
        delete filters[key];
      }
    });

    filters.userId = req.user.id;
    const clothes = await dbAsync.getAllClothes(filters);
    res.json({ success: true, data: clothes });
  } catch (error) {
    console.error('获取衣物失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/clothes/:id', async (req, res) => {
  try {
    const cloth = await dbAsync.getClothById(req.params.id, req.user.id);
    if (!cloth) {
      return res.status(404).json({ success: false, error: '衣物不存在' });
    }
    res.json({ success: true, data: cloth });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/clothes/:id', async (req, res) => {
  try {
    const cloth = await dbAsync.getClothById(req.params.id, req.user.id);
    if (!cloth) {
      return res.status(404).json({ success: false, error: '衣物不存在' });
    }

    const allowedFields = [
      'name',
      'category',
      'color',
      'season',
      'material',
      'style',
      'occasion',
      'fit',
      'brand',
      'purchase_date',
      'tags'
    ];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: '没有可更新的字段' });
    }

    const result = await dbAsync.updateCloth(req.params.id, updates, req.user.id);
    res.json({ success: true, message: '更新成功', data: result });
  } catch (error) {
    console.error('更新衣物失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/clothes/:id', async (req, res) => {
  try {
    const cloth = await dbAsync.getClothById(req.params.id, req.user.id);
    if (!cloth) {
      return res.status(404).json({ success: false, error: '衣物不存在' });
    }

    removeUploadedImage(cloth.image_path);
    await dbAsync.deleteCloth(req.params.id, req.user.id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/categories', async (req, res) => {
  try {
    const stats = await dbAsync.getCategoryStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/wardrobe/analysis', async (req, res) => {
  try {
    const clothes = await dbAsync.getAllClothes({ userId: req.user.id });
    res.json({ success: true, data: analyzeWardrobe(clothes) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/weather/current', async (req, res) => {
  try {
    const weather = await getCurrentWeather(req.query.city);
    res.json({ success: true, data: weather });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/location/ip', async (req, res) => {
  try {
    const forwarded = req.headers['x-forwarded-for'];
    const detectedIp = req.query.ip || (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket.remoteAddress;
    const ip = isPrivateOrLocalIp(detectedIp) ? '' : normalizeClientIp(detectedIp);
    const location = await locateByIp(ip);
    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/location/regeo', async (req, res) => {
  try {
    const location = await reverseGeocode(req.query.longitude, req.query.latitude);
    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recommendations/outfits', async (req, res) => {
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

    res.json({
      success: true,
      data: {
        weather,
        occasion,
        ai_review_enabled: aiReviewEnabled,
        ...reviewedResult
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/recommendations/feedback', async (req, res) => {
  try {
    const itemIds = parseItemIds(req.body.item_ids);
    const ownedItemIds = [];
    for (const itemId of itemIds) {
      const cloth = await dbAsync.getClothById(itemId, req.user.id);
      if (cloth) ownedItemIds.push(itemId);
    }
    const feedbackReason = req.body.feedback_reason || req.body.reason || '';
    const feedbackNote = feedbackReason || req.body.note || '';
    const result = await dbAsync.addRecommendationLog({
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
});

router.post('/clothes/:id/favorite', async (req, res) => {
  try {
    const cloth = await dbAsync.getClothById(req.params.id, req.user.id);
    if (!cloth) {
      return res.status(404).json({ success: false, error: '衣物不存在' });
    }
    await dbAsync.toggleFavorite(req.params.id, req.user.id);
    const updated = await dbAsync.getClothById(req.params.id, req.user.id);
    res.json({ success: true, data: { is_favorite: updated.is_favorite } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/clothes/:id/wear', async (req, res) => {
  try {
    const cloth = await dbAsync.getClothById(req.params.id, req.user.id);
    if (!cloth) {
      return res.status(404).json({ success: false, error: '衣物不存在' });
    }
    const wearResult = await dbAsync.recordWear(req.params.id, {
      user_id: req.user.id,
      worn_at: req.body.worn_at,
      occasion: req.body.occasion,
      weather: req.body.weather,
      note: req.body.note
    });
    const updated = await dbAsync.getClothById(req.params.id, req.user.id);
    res.json({
      success: true,
      data: {
        wear_count: updated.wear_count,
        last_worn: updated.last_worn,
        wear_log: wearResult.wear_log
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/clothes/:id/wear-logs', async (req, res) => {
  try {
    const cloth = await dbAsync.getClothById(req.params.id, req.user.id);
    if (!cloth) {
      return res.status(404).json({ success: false, error: '衣物不存在' });
    }

    const logs = await dbAsync.getWearLogs({
      clothId: req.params.id,
      userId: req.user.id,
      limit: req.query.limit
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
