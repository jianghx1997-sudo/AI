const express = require('express');
const fs = require('fs');

const { dbAsync } = require('../database');
const { recognizeClothing } = require('../aiService');
const { requireAuth, requireImageAuth } = require('../middleware/auth');
const { getCategoryStats, getWardrobeAnalysis } = require('../controllers/wardrobeController');
const { getCurrentWeatherHandler, locateByIpHandler, reverseGeocodeHandler } = require('../controllers/weatherController');
const { getOutfitRecommendations, submitRecommendationFeedback } = require('../controllers/recommendationController');
const { validateClothPayload, sendValidationError } = require('../utils/validation');
const {
  createImageUpload,
  getDiskPathFromPublicPath,
  moveTempUploadToPermanent,
  removeUploadedImage,
  toPublicUploadPath
} = require('../services/uploadService');

const router = express.Router();
const recognizeUpload = createImageUpload({ temp: true });

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
  'warmth_level',
  'breathability_level',
  'formality_level',
  'layering_role',
  'color_family',
  'weather_risk',
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

function getMonthRange(monthText) {
  const normalized = String(monthText || '').trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return null;
  }

  const [year, month] = normalized.split('-').map(Number);
  if (month < 1 || month > 12) {
    return null;
  }

  const startDate = `${normalized}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${normalized}-${String(lastDay).padStart(2, '0')}`;

  return { month: normalized, startDate, endDate };
}

function groupWearLogsByDate(logs) {
  const days = {};
  logs.forEach(log => {
    const date = log.worn_date || String(log.worn_at || '').slice(0, 10);
    if (!date) return;
    if (!days[date]) {
      days[date] = {
        date,
        count: 0,
        items: []
      };
    }

    days[date].count += 1;
    days[date].items.push({
      id: log.id,
      cloth_id: log.cloth_id,
      worn_at: log.worn_at,
      occasion: log.occasion,
      weather: log.weather,
      note: log.note,
      cloth_name: log.cloth_name,
      image_path: log.image_path,
      category: log.category,
      color: log.color,
      season: log.season,
      style: log.style
    });
  });

  return days;
}

async function recognizeFile(file) {
  const imagePath = file.path;
  const originalName = file.originalname;

  console.log(`📤 收到识别上传: ${originalName} -> ${file.filename}`);
  const aiResult = await recognizeClothing(imagePath, originalName);
  console.log('🤖 AI识别结果:', aiResult);

  return aiResult;
}

router.get('/images/*', requireImageAuth, async (req, res) => {
  try {
    const relativePath = String(req.params[0] || '').replace(/\\/g, '/');
    if (!relativePath || relativePath.startsWith('temp/') || relativePath.includes('..')) {
      return res.status(404).json({ success: false, error: '图片不存在' });
    }

    const publicPath = `/uploads/${relativePath}`;
    const clothes = await dbAsync.getAllClothes({ userId: req.user.id });
    const owned = clothes.some(item => item.image_path === publicPath);
    if (!owned) {
      return res.status(404).json({ success: false, error: '图片不存在' });
    }

    const imagePath = getDiskPathFromPublicPath(publicPath);
    if (!imagePath || !fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, error: '图片文件不存在' });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(imagePath);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '图片读取失败' });
  }
});

router.use(requireAuth);

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

router.post('/clothes/:id/reanalyze', async (req, res) => {
  try {
    const cloth = await dbAsync.getClothById(req.params.id, req.user.id);
    if (!cloth) {
      return res.status(404).json({ success: false, error: '衣物不存在' });
    }

    const imagePath = getDiskPathFromPublicPath(cloth.image_path);
    if (!imagePath) {
      return res.status(400).json({ success: false, error: '衣物图片路径无效' });
    }
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, error: '衣物图片文件不存在' });
    }

    const aiResult = await recognizeClothing(imagePath, cloth.name || 'cloth.jpg');
    res.json({
      success: true,
      data: {
        cloth_id: cloth.id,
        image_path: cloth.image_path,
        persisted: true
      },
      ai_result: aiResult
    });
  } catch (error) {
    console.error('重新分析衣物失败:', error);
    res.status(500).json({ success: false, error: error.message || '重新分析失败' });
  }
});

router.post('/clothes', async (req, res) => {
  try {
    const payload = pickClothPayload(req.body);
    const validation = validateClothPayload(payload, { requireImage: true, requireName: true });
    if (!validation.ok) {
      return sendValidationError(res, validation.errors);
    }

    const clothPayload = {
      ...validation.value,
      image_path: moveTempUploadToPermanent(validation.value.image_path),
      user_id: req.user.id
    };

    const cloth = await dbAsync.addCloth(clothPayload);
    res.json({ success: true, data: cloth, message: '保存成功' });
  } catch (error) {
    console.error('保存衣物失败:', error);
    res.status(500).json({ success: false, error: error.message || '保存失败' });
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
      'warmth_level',
      'breathability_level',
      'formality_level',
      'layering_role',
      'color_family',
      'weather_risk',
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

    const validation = validateClothPayload(updates, { partial: true });
    if (!validation.ok) {
      return sendValidationError(res, validation.errors);
    }

    const result = await dbAsync.updateCloth(req.params.id, validation.value, req.user.id);
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

router.get('/stats/categories', getCategoryStats);
router.get('/wardrobe/analysis', getWardrobeAnalysis);
router.get('/weather/current', getCurrentWeatherHandler);
router.get('/location/ip', locateByIpHandler);
router.get('/location/regeo', reverseGeocodeHandler);
router.get('/recommendations/outfits', getOutfitRecommendations);
router.post('/recommendations/feedback', submitRecommendationFeedback);

router.get('/wear-calendar', async (req, res) => {
  try {
    const requestedMonth = req.query.month || new Date().toISOString().slice(0, 7);
    const range = getMonthRange(requestedMonth);
    if (!range) {
      return res.status(400).json({ success: false, error: '月份格式应为 YYYY-MM' });
    }

    const logs = await dbAsync.getWearLogsByDateRange({
      userId: req.user.id,
      startDate: range.startDate,
      endDate: range.endDate
    });

    res.json({
      success: true,
      data: {
        month: range.month,
        start_date: range.startDate,
        end_date: range.endDate,
        total_wears: logs.length,
        days: groupWearLogsByDate(logs)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '获取穿搭日历失败' });
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
