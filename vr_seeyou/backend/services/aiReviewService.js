const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROMPT_VERSION = 'ai-review-v1';
const CACHE_TTL_MS = Number(process.env.AI_REVIEW_CACHE_TTL_MS || 10 * 60 * 1000);
const REVIEW_TIMEOUT_MS = Number(process.env.AI_REVIEW_TIMEOUT_MS || 60000);
const FINAL_OUTFIT_LIMIT = Number(process.env.AI_REVIEW_FINAL_LIMIT || 3);

const reviewCache = new Map();

const DIMENSION_WEIGHTS = {
  weather_comfort: 0.2,
  occasion_match: 0.18,
  completeness: 0.18,
  color_harmony: 0.16,
  style_consistency: 0.15,
  practicality: 0.13
};

function readLooseEnvValue(key) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const text = fs.readFileSync(envPath, 'utf8');
    const line = text.split(/\r?\n/).find(item => {
      const normalized = item.trim();
      return normalized.startsWith(`${key}=`) || normalized.startsWith(`${key} =`);
    });
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  } catch (error) {
    return '';
  }
}

function readLooseLabelValue(label) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const text = fs.readFileSync(envPath, 'utf8');
    const line = text.split(/\r?\n/).find(item => item.trim().startsWith(label));
    if (!line) return '';
    const trimmed = line.trim();
    const rest = trimmed.slice(label.length).trimStart();
    if (!rest) return '';
    const firstCode = rest.charCodeAt(0);
    if (rest[0] !== ':' && firstCode !== 65306) return '';
    return rest.slice(1).trim().replace(/^['"]|['"]$/g, '');
  } catch (error) {
    return '';
  }
}

function normalizeChatCompletionsEndpoint(value) {
  const endpoint = String(value || '').trim().replace(/\/$/, '');
  if (!endpoint) return 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  if (endpoint.endsWith('/chat/completions')) return endpoint;
  return `${endpoint}/chat/completions`;
}

function getAiConfig() {
  return {
    apiKey: process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY || process.env.API_KEY,
    endpoint: normalizeChatCompletionsEndpoint(
      process.env.VOLCANO_MODEL_ENDPOINT ||
      process.env.ARK_MODEL_ENDPOINT ||
      readLooseLabelValue('Base URL') ||
      'https://ark.cn-beijing.volces.com/api/v3'
    ),
    modelId:
      process.env.AI_REVIEW_MODEL_ID ||
      process.env.VOLCANO_MODEL_ID ||
      process.env.ARK_MODEL_ID ||
      process.env.MODEL_ID ||
      process.env['Model ID'] ||
      readLooseEnvValue('Model ID') ||
      'doubao-vision-lite-32k-250115'
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function asScore(value, fallback = 60) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(round(numeric), 0, 100) : fallback;
}

function asConfidence(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(round(numeric, 2), 0, 1) : 0.5;
}

function shortText(value, maxLength = 90) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function textList(value, maxItems = 3) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => shortText(item, 80))
    .filter(Boolean)
    .slice(0, maxItems);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function parseJsonContent(content) {
  const raw = String(content || '').trim();
  if (!raw) throw new Error('AI评价未返回内容');

  try {
    return JSON.parse(raw);
  } catch (error) {
    const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) return JSON.parse(codeMatch[1]);

    const braceMatch = raw.match(/\{[\s\S]*\}/);
    if (braceMatch) return JSON.parse(braceMatch[0]);
  }

  throw new Error('AI评价未返回合法JSON');
}

function outfitKey(outfit, index) {
  const ids = (outfit.items || []).map(item => Number(item.id)).filter(Number.isFinite).sort((a, b) => a - b);
  return `${index}-${ids.join('-') || 'empty'}`;
}

function buildReviewPayload(result, context, modelId) {
  return {
    prompt_version: PROMPT_VERSION,
    model: modelId,
    context: {
      occasion: context.occasion,
      weather: {
        city: context.weather?.city || '',
        weather: context.weather?.weather || '',
        temperature: context.weather?.temperature,
        humidity: context.weather?.humidity,
        winddirection: context.weather?.winddirection,
        windpower: context.weather?.windpower
      },
      recommendation_context: result.recommendation_context || {}
    },
    outfits: (result.outfits || []).map((outfit, index) => ({
      outfit_key: outfitKey(outfit, index),
      name: outfit.name,
      rule_score: outfit.rule_score ?? outfit.score,
      accuracy_level: outfit.accuracy_level,
      reason: outfit.reason,
      constraint_warnings: outfit.constraint_warnings || [],
      comfort_notes: outfit.comfort_notes || [],
      style_notes: outfit.style_notes || [],
      missing_items: outfit.missing_items || [],
      score_breakdown: outfit.score_breakdown || {},
      items: (outfit.items || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        color: item.color,
        season: item.season,
        material: item.material,
        style: item.style,
        occasion: item.occasion,
        fit: item.fit,
        tags: item.tags
      }))
    }))
  };
}

function buildPrompt(payload) {
  return [
    '你是一名谨慎、务实的穿搭顾问，请只评审输入中的候选搭配。',
    '必须遵守：不能新增或虚构衣物；不能绕过规则硬约束；如果 accuracy_level 不是 complete，不能评价为完整实穿。',
    '请优先判断“今天是否真的适合穿出去”，再判断审美协调。',
    '评分口径：90-100 很适合，75-89 可推荐，60-74 可参考，40-59 问题明显，0-39 不建议。',
    '只返回严格 JSON，不要 Markdown，不要解释 JSON 以外的文字。',
    '返回格式：{"reviews":[{"outfit_key":"与输入一致","dimension_scores":{"weather_comfort":0-100,"occasion_match":0-100,"completeness":0-100,"color_harmony":0-100,"style_consistency":0-100,"practicality":0-100},"overall_score":0-100,"confidence":0-1,"verdict":"recommend/usable/caution/not_recommended","summary":"40字内结论","strengths":["最多3条"],"risks":["最多3条"],"suggestions":["最多3条"],"purchase_gap_opinion":{"needed":true/false,"priority":"high/medium/low/none","summary":"缺口或无需补买的简短判断","recommended_items":["最多3个建议补充类型"]}}]}',
    `输入：${JSON.stringify(payload)}`
  ].join('\n');
}

function computeDimensionScore(dimensionScores) {
  const total = Object.entries(DIMENSION_WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + asScore(dimensionScores[key], 60) * weight;
  }, 0);
  return clamp(round(total), 0, 100);
}

function normalizePurchaseGapOpinion(value, outfit) {
  if (typeof value === 'string') {
    return {
      needed: Boolean(outfit.missing_items?.length),
      priority: outfit.missing_items?.length ? 'medium' : 'none',
      summary: shortText(value, 90),
      recommended_items: []
    };
  }

  const source = value && typeof value === 'object' ? value : {};
  const needed = Boolean(source.needed ?? outfit.missing_items?.length);
  const priority = ['high', 'medium', 'low', 'none'].includes(source.priority) ? source.priority : (needed ? 'medium' : 'none');
  const recommendedItems = textList(source.recommended_items || source.recommendedItems || [], 3);

  return {
    needed,
    priority,
    summary: shortText(source.summary || outfit.missing_items?.[0] || (needed ? '建议先补齐缺失关键品类。' : '当前不需要额外补买。'), 90),
    recommended_items: recommendedItems
  };
}

function normalizeVerdict(value, score) {
  const raw = String(value || '').trim();
  if (['recommend', 'usable', 'caution', 'not_recommended'].includes(raw)) return raw;
  if (score >= 85) return 'recommend';
  if (score >= 70) return 'usable';
  if (score >= 50) return 'caution';
  return 'not_recommended';
}

function hasRuleConflict(outfit, rawReview) {
  if (outfit.accuracy_level === 'complete') return false;

  const rawDimensions = rawReview.dimension_scores || {};
  const completeness = asScore(rawDimensions.completeness, 60);
  const rawOverall = asScore(rawReview.overall_score, 60);
  const rawVerdict = String(rawReview.verdict || '');

  return completeness >= 85 || rawOverall >= 85 || rawVerdict === 'recommend';
}

function sanitizeReview(rawReview, outfit) {
  const source = rawReview && typeof rawReview === 'object' ? rawReview : {};
  const rawDimensions = source.dimension_scores || {};
  const conflict = hasRuleConflict(outfit, source);
  const dimensionScores = {
    weather_comfort: asScore(rawDimensions.weather_comfort ?? rawDimensions.weather, 60),
    occasion_match: asScore(rawDimensions.occasion_match ?? rawDimensions.occasion, 60),
    completeness: asScore(rawDimensions.completeness, outfit.score_breakdown?.completeness || 60),
    color_harmony: asScore(rawDimensions.color_harmony ?? rawDimensions.color, outfit.score_breakdown?.color || 60),
    style_consistency: asScore(rawDimensions.style_consistency ?? rawDimensions.style, outfit.score_breakdown?.style || 60),
    practicality: asScore(rawDimensions.practicality, 60)
  };

  if (outfit.accuracy_level === 'usable_with_gap') {
    dimensionScores.completeness = Math.min(dimensionScores.completeness, 74);
  }
  if (outfit.accuracy_level === 'insufficient_data') {
    dimensionScores.completeness = Math.min(dimensionScores.completeness, 55);
  }

  let overallScore = computeDimensionScore(dimensionScores);
  if (outfit.accuracy_level === 'usable_with_gap') overallScore = Math.min(overallScore, 72);
  if (outfit.accuracy_level === 'insufficient_data') overallScore = Math.min(overallScore, 55);

  const risks = textList(source.risks, 3);
  if (conflict) {
    risks.unshift('AI评价已按规则约束校准：当前搭配仍存在完整度问题。');
  }

  let verdict = normalizeVerdict(source.verdict, overallScore);
  if (outfit.accuracy_level !== 'complete' && verdict === 'recommend') {
    verdict = overallScore >= 60 ? 'usable' : 'caution';
  }

  return {
    overall_score: overallScore,
    confidence: asConfidence(source.confidence),
    verdict,
    summary: shortText(source.summary || 'AI已完成搭配评审。', 70),
    strengths: textList(source.strengths, 3),
    risks: [...new Set(risks)].slice(0, 3),
    suggestions: textList(source.suggestions, 3),
    purchase_gap_opinion: normalizePurchaseGapOpinion(source.purchase_gap_opinion, outfit),
    dimension_scores: dimensionScores,
    rule_conflict: conflict
  };
}

function capHybridScore(score, accuracyLevel) {
  if (accuracyLevel === 'usable_with_gap') return Math.min(score, 78);
  if (accuracyLevel === 'insufficient_data') return Math.min(score, 64);
  return score;
}

function applyReviews(result, rawReviews, status = 'reviewed', finalLimit = FINAL_OUTFIT_LIMIT) {
  const reviewMap = new Map((rawReviews || []).map(review => [String(review.outfit_key || ''), review]));
  const outfits = (result.outfits || []).map((outfit, index) => {
    const key = outfitKey(outfit, index);
    const ruleScore = clamp(round(Number(outfit.rule_score ?? outfit.score) || 0), 1, 100);
    const rawReview = reviewMap.get(key);

    if (!rawReview) {
      return {
        ...outfit,
        score: ruleScore,
        rule_score: ruleScore,
        hybrid_score: ruleScore,
        ai_review_status: status === 'not_requested' ? 'not_requested' : 'unavailable'
      };
    }

    const aiReview = sanitizeReview(rawReview, outfit);
    const hybridScore = capHybridScore(round(ruleScore * 0.7 + aiReview.overall_score * 0.3), outfit.accuracy_level);
    const reviewStatus = aiReview.rule_conflict ? 'conflict_fallback' : status;

    return {
      ...outfit,
      score: hybridScore,
      rule_score: ruleScore,
      hybrid_score: hybridScore,
      ai_review_status: reviewStatus,
      ai_review: aiReview
    };
  });

  return {
    ...result,
    outfits: outfits
      .sort((a, b) => (b.hybrid_score ?? b.score) - (a.hybrid_score ?? a.score))
      .slice(0, finalLimit)
  };
}

function applyUnavailable(result, status = 'unavailable', finalLimit = FINAL_OUTFIT_LIMIT) {
  const outfits = (result.outfits || []).slice(0, finalLimit).map(outfit => {
    const ruleScore = clamp(round(Number(outfit.rule_score ?? outfit.score) || 0), 1, 100);
    return {
      ...outfit,
      score: ruleScore,
      rule_score: ruleScore,
      hybrid_score: ruleScore,
      ai_review_status: status
    };
  });

  return { ...result, outfits };
}

async function callReviewModel(payload, config, maxTokens = 1800) {
  const response = await axios.post(
    config.endpoint,
    {
      model: config.modelId,
      messages: [
        {
          role: 'system',
          content: '你是严谨的穿搭评审助手，只输出符合要求的 JSON。'
        },
        {
          role: 'user',
          content: buildPrompt(payload)
        }
      ],
      temperature: 0.1,
      top_p: 0.7,
      max_tokens: maxTokens
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      proxy: false,
      timeout: REVIEW_TIMEOUT_MS
    }
  );

  const message = response.data.choices?.[0]?.message || {};
  const content = message.content || message.reasoning_content || '';
  const parsed = parseJsonContent(content);
  if (!Array.isArray(parsed.reviews)) {
    throw new Error('AI评价JSON缺少 reviews 数组');
  }
  return parsed.reviews;
}

async function callReviewModelIndividually(payload, config, limit) {
  const reviews = [];
  const outfits = payload.outfits.slice(0, limit);

  for (const outfit of outfits) {
    try {
      const onePayload = {
        ...payload,
        outfits: [outfit]
      };
      const oneReviews = await callReviewModel(onePayload, config, 900);
      reviews.push(...oneReviews);
    } catch (error) {
      console.warn(`AI单套评价失败，已跳过 ${outfit.outfit_key}:`, error.message);
    }
  }

  return reviews;
}

function readCache(key) {
  const cached = reviewCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
    reviewCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCache(key, value) {
  reviewCache.set(key, { createdAt: Date.now(), value });
}

async function reviewRecommendations(result, context = {}, options = {}) {
  const finalLimit = options.finalLimit || FINAL_OUTFIT_LIMIT;
  if (!options.enabled) {
    return applyUnavailable(result, 'not_requested', finalLimit);
  }

  const config = getAiConfig();
  if (!config.apiKey) {
    return applyUnavailable(result, 'unavailable', finalLimit);
  }

  if (!Array.isArray(result.outfits) || result.outfits.length === 0) {
    return result;
  }

  const payload = buildReviewPayload(result, context, config.modelId);
  const cacheKey = hashPayload(payload);
  const cachedReviews = readCache(cacheKey);
  if (cachedReviews) {
    return applyReviews(result, cachedReviews, 'cached', finalLimit);
  }

  try {
    let reviews;
    try {
      reviews = await callReviewModel(payload, config, 1400);
    } catch (error) {
      reviews = await callReviewModelIndividually(payload, config, finalLimit);
      if (!reviews.length) {
        throw error;
      }
    }

    const minimumReviews = Math.min(payload.outfits.length, finalLimit);
    if (reviews.length >= minimumReviews) {
      writeCache(cacheKey, reviews);
    }
    return applyReviews(result, reviews, 'reviewed', finalLimit);
  } catch (error) {
    console.warn('AI搭配评价不可用，已回退规则推荐:', error.message);
    return applyUnavailable(result, 'unavailable', finalLimit);
  }
}

module.exports = {
  PROMPT_VERSION,
  reviewRecommendations
};
