<template>
  <div class="recommend">
    <van-nav-bar title="今日推荐" fixed placeholder />

    <div class="recommend-content page-shell">
      <section class="recommend-hero surface-card">
        <div class="weather-line">
          <div>
            <div class="eyebrow">当前天气</div>
            <h1>{{ weatherTitle }}</h1>
            <p>{{ weatherSubtitle }}</p>
          </div>
          <button class="icon-action" @click="locateCurrentCity">
            <van-loading v-if="loadingLocation" size="18" color="#2f8f7b" />
            <van-icon v-else name="location-o" size="20" />
          </button>
        </div>

        <div class="scene-block">
          <div class="scene-label">场景</div>
          <div class="chip-row">
            <button
              class="choice-chip"
              v-for="item in occasions"
              :key="item"
              :class="{ active: occasion === item }"
              @click="occasion = item"
            >
              {{ item }}
            </button>
          </div>
        </div>

        <van-button type="primary" round block :loading="loading" @click="loadRecommendations">
          生成今日搭配
        </van-button>

        <div class="secondary-row">
          <button @click="locateCurrentCity">定位当前城市</button>
          <button @click="showManual = !showManual">{{ showManual ? '收起调整' : '调整天气' }}</button>
        </div>

        <div class="location-status" v-if="locationStatus">{{ locationStatus }}</div>
      </section>

      <section class="manual-panel surface-card" v-if="showManual">
        <van-field v-model="city" label="城市编码" placeholder="如：110101" @update:model-value="useLiveWeather = false" />
        <div class="field-row">
          <van-field v-model="manualWeather" label="天气" placeholder="晴/阴/雨" @update:model-value="useLiveWeather = false" />
          <van-field v-model="manualTemperature" label="温度" type="number" placeholder="22" @update:model-value="useLiveWeather = false" />
        </div>
        <van-button round block plain class="subtle-button" :loading="loadingWeather" @click="loadWeather">
          更新天气
        </van-button>
      </section>

      <section class="gap-section surface-card" v-if="gapSuggestions.length > 0 || gaps.length > 0">
        <div class="section-heading">
          <div class="section-title">衣橱缺口</div>
        </div>
        <div class="gap-list" v-if="gapSuggestions.length > 0">
          <article class="gap-card" v-for="gap in gapSuggestions" :key="`${gap.type}-${gap.title}`">
            <div class="gap-card-head">
              <div class="gap-title">{{ gap.title }}</div>
              <span class="priority-badge" :class="`priority-${gap.priority}`">{{ priorityLabel(gap.priority) }}</span>
            </div>
            <p>{{ gap.description }}</p>
            <div class="gap-meta">
              <span v-if="gap.recommended_category">{{ gap.recommended_category }}</span>
              <span v-if="gap.recommended_color">{{ gap.recommended_color }}</span>
              <span v-if="gap.recommended_style">{{ gap.recommended_style }}</span>
              <span v-if="gap.recommended_material">{{ gap.recommended_material }}</span>
            </div>
          </article>
        </div>
        <template v-else>
          <div class="gap-item" v-for="gap in gaps" :key="gap">{{ gap }}</div>
        </template>
      </section>

      <section class="outfit-section" v-if="outfits.length > 0">
        <div class="section-heading">
          <div class="section-title">推荐搭配</div>
        </div>

        <article class="outfit-card surface-card" v-for="outfit in outfits" :key="outfit.name">
          <div class="outfit-header">
            <div>
              <div class="outfit-name">{{ outfit.name }}</div>
              <div class="outfit-meta-row">
                <span class="occasion-pill">{{ outfit.occasion }}</span>
                <span class="accuracy-tag" :class="accuracyClass(outfit)">
                  {{ accuracyLabel(outfit) }}
                </span>
              </div>
              <div class="outfit-reason">{{ outfit.reason }}</div>
            </div>
            <div class="score-pill" v-if="outfit.score !== undefined">
              <span>{{ scorePercent(outfit.score) }}</span>
              <small>{{ outfit.ai_review ? '综合' : '匹配' }}</small>
            </div>
          </div>

          <div class="outfit-items">
            <div class="outfit-item" v-for="item in outfit.items" :key="item.id" @click="$router.push(`/cloth/${item.id}`)">
              <img :src="getImageUrl(item)" :alt="item.name" />
              <div class="item-name">{{ item.name }}</div>
              <div class="item-category">{{ item.category }}</div>
            </div>
          </div>

          <div class="outfit-insights" v-if="hasOutfitInsights(outfit)">
            <div class="accuracy-banner" :class="accuracyClass(outfit)" v-if="outfit.accuracy_level && outfit.accuracy_level !== 'complete'">
              <van-icon name="warning-o" />
              <span>{{ accuracyMessage(outfit) }}</span>
            </div>

            <div class="constraint-list" v-if="topConstraintWarnings(outfit).length">
              <div class="constraint-title">
                <van-icon name="warning-o" />
                实穿提醒
              </div>
              <div class="constraint-item" v-for="warning in topConstraintWarnings(outfit)" :key="warning">
                {{ warning }}
              </div>
            </div>

            <div class="comfort-list" v-if="outfit.comfort_notes?.length">
              <span v-for="note in outfit.comfort_notes" :key="note">
                <van-icon name="clock-o" />
                {{ note }}
              </span>
            </div>

            <div class="note-chips" v-if="outfit.style_notes?.length">
              <span v-for="note in outfit.style_notes" :key="note">
                <van-icon name="passed" />
                {{ note }}
              </span>
            </div>

            <div class="missing-list" v-if="outfit.missing_items?.length">
              <div class="missing-title">还缺什么</div>
              <div class="missing-item" v-for="item in outfit.missing_items" :key="item">{{ item }}</div>
            </div>

            <div class="breakdown-row" v-if="breakdownEntries(outfit).length">
              <div class="breakdown-item" v-for="entry in breakdownEntries(outfit)" :key="entry.key">
                <span>{{ entry.label }}</span>
                <strong>{{ entry.value }}%</strong>
              </div>
            </div>

            <div class="ai-review-card" :class="aiReviewClass(outfit)" v-if="showAiReview(outfit)">
              <div class="ai-review-head">
                <div>
                  <div class="ai-review-title">
                    <van-icon name="chat-o" />
                    AI顾问评价
                  </div>
                  <p>{{ aiReviewSummary(outfit) }}</p>
                </div>
                <span>{{ aiReviewStatusLabel(outfit) }}</span>
              </div>

              <div class="ai-score-row" v-if="outfit.ai_review">
                <div>
                  <span>综合</span>
                  <strong>{{ scorePercent(outfit.hybrid_score) }}</strong>
                </div>
                <div>
                  <span>规则</span>
                  <strong>{{ scorePercent(outfit.rule_score) }}</strong>
                </div>
                <div>
                  <span>AI</span>
                  <strong>{{ scorePercent(outfit.ai_review.overall_score) }}</strong>
                </div>
              </div>

              <details class="ai-review-detail" v-if="outfit.ai_review">
                <summary>查看分项建议</summary>

                <div class="ai-dimensions" v-if="aiDimensionEntries(outfit).length">
                  <div class="ai-dimension" v-for="entry in aiDimensionEntries(outfit)" :key="entry.key">
                    <span>{{ entry.label }}</span>
                    <strong>{{ entry.value }}%</strong>
                  </div>
                </div>

                <div class="ai-list-block" v-if="outfit.ai_review.strengths?.length">
                  <div class="ai-list-title">优点</div>
                  <div class="ai-list-item" v-for="item in outfit.ai_review.strengths" :key="item">{{ item }}</div>
                </div>

                <div class="ai-list-block risk" v-if="outfit.ai_review.risks?.length">
                  <div class="ai-list-title">风险</div>
                  <div class="ai-list-item" v-for="item in outfit.ai_review.risks" :key="item">{{ item }}</div>
                </div>

                <div class="ai-list-block" v-if="outfit.ai_review.suggestions?.length">
                  <div class="ai-list-title">调整建议</div>
                  <div class="ai-list-item" v-for="item in outfit.ai_review.suggestions" :key="item">{{ item }}</div>
                </div>

                <div class="ai-gap-opinion" v-if="outfit.ai_review.purchase_gap_opinion?.summary">
                  <div class="ai-list-title">缺口判断</div>
                  <p>{{ outfit.ai_review.purchase_gap_opinion.summary }}</p>
                  <div class="ai-gap-tags" v-if="outfit.ai_review.purchase_gap_opinion.recommended_items?.length">
                    <span v-for="item in outfit.ai_review.purchase_gap_opinion.recommended_items" :key="item">{{ item }}</span>
                  </div>
                </div>
              </details>
            </div>
          </div>

          <div class="feedback-actions">
            <button
              v-for="action in feedbackActions"
              :key="action.value"
              :class="feedbackButtonClass(outfit, action.value)"
              :disabled="isFeedbackBusy(outfit)"
              @click="sendFeedback(outfit, action.value)"
            >
              <van-loading
                v-if="isFeedbackActionLoading(outfit, action.value)"
                size="14"
                color="#2f8f7b"
              />
              <van-icon v-else :name="feedbackButtonIcon(outfit, action)" />
              <span>{{ feedbackButtonLabel(outfit, action) }}</span>
            </button>
          </div>
        </article>
      </section>

      <div class="empty-state surface-card" v-if="!loading && outfits.length === 0">
        <van-icon name="bulb-o" size="46" color="#2f8f7b" />
        <div class="empty-title">还没有可推荐的搭配</div>
        <van-button type="primary" round class="empty-btn" @click="$router.push('/upload')">
          添加衣物
        </van-button>
      </div>
    </div>

    <van-action-sheet
      v-model:show="showDislikeSheet"
      title="哪里不适合？"
      cancel-text="取消"
      :actions="dislikeReasons"
      close-on-click-action
      @select="handleDislikeReasonSelect"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import {
  getCurrentWeather,
  getOutfitRecommendations,
  locateByIp,
  reverseGeocode,
  submitRecommendationFeedback
} from '@/api/clothes'

const occasions = ['通勤', '约会', '运动', '休闲', '正式', '旅行']
const city = ref('110101')
const occasion = ref('休闲')
const manualWeather = ref('晴')
const manualTemperature = ref(22)
const weather = ref(null)
const outfits = ref([])
const gaps = ref([])
const gapSuggestions = ref([])
const loading = ref(false)
const loadingWeather = ref(false)
const loadingLocation = ref(false)
const locationStatus = ref('')
const useLiveWeather = ref(false)
const showManual = ref(false)

const breakdownLabels = {
  weather: '天气',
  comfort: '舒适',
  occasion: '场景',
  color: '配色',
  style: '风格',
  preference: '偏好',
  completeness: '完整度'
}

const aiDimensionLabels = {
  weather_comfort: '天气舒适',
  occasion_match: '场景匹配',
  completeness: '完整度',
  color_harmony: '配色',
  style_consistency: '风格',
  practicality: '实穿性'
}

const feedbackActions = [
  { value: 'liked', label: '喜欢', doneLabel: '已喜欢', icon: 'like-o', activeIcon: 'like' },
  { value: 'worn', label: '已穿', doneLabel: '已记录', icon: 'passed', activeIcon: 'passed' },
  { value: 'disliked', label: '不适合', doneLabel: '已反馈', icon: 'cross', activeIcon: 'cross' }
]

const dislikeReasons = [
  { name: '太热', value: 'too_hot' },
  { name: '太冷', value: 'too_cold' },
  { name: '不符合场景', value: 'scene_mismatch' },
  { name: '颜色不搭', value: 'color_mismatch' },
  { name: '不喜欢这件', value: 'item_dislike' }
]

const feedbackState = ref({})
const feedbackLoading = ref({})
const showDislikeSheet = ref(false)
const pendingDislikeOutfit = ref(null)

const weatherTitle = computed(() => {
  if (weather.value?.available) {
    return `${weather.value.city} ${weather.value.weather}`
  }
  return `${manualWeather.value || '晴'} ${manualTemperature.value || 22}°C`
})

const weatherSubtitle = computed(() => {
  if (weather.value?.available) {
    return `${weather.value.temperature}°C · ${weather.value.winddirection || ''}风 ${weather.value.windpower || ''}级`
  }
  return '使用手动天气'
})

const getImageUrl = (item) => {
  if (!item?.image_path) return ''
  const separator = item.image_path.includes('?') ? '&' : '?'
  return `${item.image_path}${separator}v=${encodeURIComponent(item.updated_at || item.created_at || Date.now())}`
}

const scorePercent = (score) => `${Math.max(0, Math.min(100, Math.round(Number(score) || 0)))}%`

const outfitKey = (outfit) => {
  const ids = outfit?.items?.map(item => item.id).join('-') || 'empty'
  return `${outfit?.name || 'outfit'}-${ids}`
}

const accuracyLabel = (outfit) => {
  const labels = {
    complete: '完整实穿',
    usable_with_gap: '可参考',
    insufficient_data: '数据不足'
  }
  return labels[outfit?.accuracy_level] || '待判断'
}

const accuracyClass = (outfit) => {
  return {
    'accuracy-complete': outfit?.accuracy_level === 'complete',
    'accuracy-gap': outfit?.accuracy_level === 'usable_with_gap',
    'accuracy-low': outfit?.accuracy_level === 'insufficient_data'
  }
}

const accuracyMessage = (outfit) => {
  if (outfit?.accuracy_level === 'insufficient_data') {
    return '当前衣橱缺少核心品类，这套只能作为录入参考。'
  }
  if (outfit?.accuracy_level === 'usable_with_gap') {
    return '这套可以参考，但缺少关键品类，实穿前需要补齐。'
  }
  return '这套结构完整，可以直接作为今日搭配参考。'
}

const topConstraintWarnings = (outfit) => {
  return (outfit?.constraint_warnings || []).slice(0, 4)
}

const priorityLabel = (priority) => {
  const labels = {
    high: '高优先',
    medium: '中优先',
    low: '低优先'
  }
  return labels[priority] || '建议'
}

const breakdownEntries = (outfit) => {
  return Object.entries(outfit?.score_breakdown || {})
    .filter(([key]) => breakdownLabels[key])
    .map(([key, value]) => ({
      key,
      label: breakdownLabels[key],
      value: Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
    }))
}

const showAiReview = (outfit) => {
  return Boolean(outfit?.ai_review || outfit?.ai_review_status === 'unavailable' || outfit?.ai_review_status === 'conflict_fallback')
}

const aiReviewStatusLabel = (outfit) => {
  const labels = {
    reviewed: '已评审',
    cached: '已评审',
    conflict_fallback: '已校准',
    unavailable: '暂不可用'
  }
  return labels[outfit?.ai_review_status] || '待评审'
}

const aiReviewClass = (outfit) => {
  return {
    unavailable: outfit?.ai_review_status === 'unavailable',
    conflict: outfit?.ai_review_status === 'conflict_fallback'
  }
}

const aiReviewSummary = (outfit) => {
  if (outfit?.ai_review?.summary) return outfit.ai_review.summary
  if (outfit?.ai_review_status === 'unavailable') return 'AI评价暂不可用，当前已使用规则推荐结果。'
  return 'AI评价已按规则硬约束校准。'
}

const aiDimensionEntries = (outfit) => {
  return Object.entries(outfit?.ai_review?.dimension_scores || {})
    .filter(([key]) => aiDimensionLabels[key])
    .map(([key, value]) => ({
      key,
      label: aiDimensionLabels[key],
      value: Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
    }))
}

const hasOutfitInsights = (outfit) => {
  return Boolean(
    outfit?.constraint_warnings?.length ||
    outfit?.comfort_notes?.length ||
    outfit?.style_notes?.length ||
    outfit?.missing_items?.length ||
    breakdownEntries(outfit).length ||
    showAiReview(outfit)
  )
}

const isFeedbackBusy = (outfit) => {
  return Boolean(feedbackLoading.value[outfitKey(outfit)])
}

const isFeedbackActionLoading = (outfit, action) => {
  return feedbackLoading.value[outfitKey(outfit)] === action
}

const feedbackButtonClass = (outfit, action) => {
  return {
    active: feedbackState.value[outfitKey(outfit)]?.feedback === action,
    disliked: action === 'disliked'
  }
}

const feedbackButtonIcon = (outfit, action) => {
  return feedbackState.value[outfitKey(outfit)]?.feedback === action.value ? action.activeIcon : action.icon
}

const feedbackButtonLabel = (outfit, action) => {
  return feedbackState.value[outfitKey(outfit)]?.feedback === action.value ? action.doneLabel : action.label
}

const loadWeather = async () => {
  loadingWeather.value = true
  try {
    const res = await getCurrentWeather(city.value)
    if (res.success) {
      weather.value = res.data
      if (res.data.available) {
        manualWeather.value = res.data.weather
        manualTemperature.value = res.data.temperature
        await nextTick()
        useLiveWeather.value = true
        showToast('天气已更新')
      } else {
        useLiveWeather.value = false
        showToast(res.data.message || '请手动输入天气')
      }
    }
  } catch (error) {
    showToast(error.message || '天气获取失败，请手动输入')
  } finally {
    loadingWeather.value = false
  }
}

const getBrowserPosition = () => {
  const positionPromise = new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    })
  })

  const timeoutPromise = new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('GPS定位超时')), 12000)
  })

  return Promise.race([positionPromise, timeoutPromise])
}

const applyLocatedCity = async (location, label) => {
  city.value = location.adcode
  const cityName = location.city || location.district || location.province || '当前位置'
  locationStatus.value = `${label}：${cityName}`
  await loadWeather()
  useLiveWeather.value = weather.value?.available === true
  await loadRecommendations()
}

const locateByIpFallback = async (reason = '') => {
  const res = await locateByIp()
  if (res.success && res.data?.available) {
    await applyLocatedCity(res.data, 'IP定位')
    if (reason) {
      showToast('已使用IP定位，VPN可能影响准确性')
    }
    return true
  }

  locationStatus.value = reason || '定位失败，请手动输入城市编码'
  showToast(res.data?.message || locationStatus.value)
  return false
}

const locateCurrentCity = async () => {
  loadingLocation.value = true
  locationStatus.value = '正在定位当前城市'
  try {
    if (navigator.geolocation && window.isSecureContext) {
      const position = await getBrowserPosition()
      const { longitude, latitude } = position.coords
      const res = await reverseGeocode(longitude, latitude)
      if (res.success && res.data?.available) {
        await applyLocatedCity(res.data, 'GPS定位')
        showToast('已定位当前城市')
        return
      }
    }

    const reason = window.isSecureContext
      ? '浏览器定位不可用，已尝试IP定位'
      : '局域网HTTP无法使用GPS，已尝试IP定位'
    await locateByIpFallback(reason)
  } catch (error) {
    await locateByIpFallback(error.message || 'GPS定位失败，已尝试IP定位')
  } finally {
    loadingLocation.value = false
  }
}

const loadRecommendations = async () => {
  loading.value = true
  try {
    const res = await getOutfitRecommendations({
      occasion: occasion.value,
      weather: manualWeather.value,
      temperature: manualTemperature.value,
      city: city.value,
      useWeather: useLiveWeather.value,
      aiReview: true
    })
    if (res.success) {
      weather.value = res.data.weather
      outfits.value = res.data.outfits || []
      gaps.value = res.data.gaps || []
      gapSuggestions.value = res.data.gap_suggestions || []
    }
  } catch (error) {
    showToast(error.message || '推荐生成失败')
  } finally {
    loading.value = false
  }
}

const sendFeedback = async (outfit, feedback) => {
  if (feedback === 'disliked') {
    pendingDislikeOutfit.value = outfit
    showDislikeSheet.value = true
    return
  }

  await submitFeedback(outfit, feedback)
}

const handleDislikeReasonSelect = async (action) => {
  const outfit = pendingDislikeOutfit.value
  pendingDislikeOutfit.value = null
  showDislikeSheet.value = false
  if (!outfit || !action?.value) return
  await submitFeedback(outfit, 'disliked', action.value)
}

const submitFeedback = async (outfit, feedback, feedbackReason = '') => {
  const key = outfitKey(outfit)
  feedbackLoading.value = { ...feedbackLoading.value, [key]: feedback }
  try {
    await submitRecommendationFeedback({
      outfit_name: outfit.name,
      occasion: outfit.occasion,
      weather: weather.value?.weather,
      temperature: weather.value?.temperature,
      item_ids: outfit.items.map(item => item.id),
      feedback,
      feedback_reason: feedbackReason,
      note: feedbackReason
    })
    const label = feedback === 'liked' ? '已记录喜欢' : feedback === 'worn' ? '已记录穿着' : '已记录不适合'
    feedbackState.value = {
      ...feedbackState.value,
      [key]: { feedback, reason: feedbackReason }
    }
    showToast(label)
    await loadRecommendations()
  } catch (error) {
    showToast(error.message || '反馈记录失败')
  } finally {
    const next = { ...feedbackLoading.value }
    delete next[key]
    feedbackLoading.value = next
  }
}

onMounted(() => {
  loadRecommendations()
})
</script>

<style scoped>
.recommend-hero,
.manual-panel,
.gap-section,
.outfit-card {
  padding: 16px;
  margin-bottom: 14px;
}

.weather-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.eyebrow {
  font-size: 12px;
  color: var(--sw-primary);
  font-weight: 650;
  margin-bottom: 7px;
}

.weather-line h1 {
  font-size: 22px;
  line-height: 1.25;
  color: var(--sw-text);
  margin-bottom: 6px;
}

.weather-line p {
  font-size: 13px;
  color: var(--sw-text-muted);
}

.icon-action {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border: 1px solid var(--sw-border);
  border-radius: 50%;
  background: var(--sw-surface);
  color: var(--sw-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.scene-block {
  margin-bottom: 14px;
}

.scene-label {
  font-size: 12px;
  color: var(--sw-text-muted);
  font-weight: 650;
  margin: 0 0 8px 2px;
}

.secondary-row {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-top: 12px;
}

.secondary-row button {
  border: none;
  background: transparent;
  color: var(--sw-primary);
  font-size: 13px;
  font-weight: 650;
}

.location-status {
  margin-top: 10px;
  padding: 9px 10px;
  border-radius: var(--sw-radius);
  background: var(--sw-surface-soft);
  color: var(--sw-text-muted);
  font-size: 12px;
  text-align: center;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.manual-panel {
  display: grid;
  gap: 10px;
}

.gap-item {
  font-size: 13px;
  color: var(--sw-text);
  line-height: 1.5;
  padding: 10px 12px;
  background: var(--sw-accent-soft);
  border-radius: var(--sw-radius);
  margin-bottom: 8px;
}

.gap-item:last-child {
  margin-bottom: 0;
}

.gap-list {
  display: grid;
  gap: 12px;
}

.gap-card {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sw-border);
}

.gap-card:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.gap-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
}

.gap-title {
  min-width: 0;
  font-size: 14px;
  font-weight: 650;
  color: var(--sw-text);
}

.gap-card p {
  font-size: 13px;
  line-height: 1.5;
  color: var(--sw-text-muted);
  margin: 0 0 9px;
}

.priority-badge {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 650;
}

.priority-high {
  color: #9b4a31;
  background: var(--sw-accent-soft);
}

.priority-medium {
  color: var(--sw-primary);
  background: var(--sw-primary-soft);
}

.priority-low {
  color: var(--sw-text-muted);
  background: var(--sw-surface-soft);
}

.gap-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gap-meta span {
  max-width: 100%;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--sw-surface-soft);
  color: var(--sw-text-muted);
  font-size: 11px;
  line-height: 1.2;
}

.outfit-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.outfit-header > div:first-child {
  min-width: 0;
}

.outfit-name {
  font-size: 17px;
  font-weight: 650;
  color: var(--sw-text);
  margin-bottom: 6px;
}

.outfit-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 7px;
}

.outfit-reason {
  font-size: 13px;
  color: var(--sw-text-muted);
  line-height: 1.45;
}

.occasion-pill {
  flex: 0 0 auto;
  height: 28px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--sw-primary-soft);
  color: var(--sw-primary);
  font-size: 12px;
  font-weight: 650;
}

.accuracy-tag {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 6px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 650;
}

.accuracy-complete {
  background: var(--sw-primary-soft);
  color: var(--sw-primary);
}

.accuracy-gap {
  background: var(--sw-accent-soft);
  color: #9b4a31;
}

.accuracy-low {
  background: #f3f0ec;
  color: var(--sw-text-muted);
}

.score-pill {
  flex: 0 0 58px;
  min-height: 50px;
  border-radius: var(--sw-radius);
  background: var(--sw-primary-soft);
  color: var(--sw-primary);
  display: grid;
  place-items: center;
  padding: 7px 6px;
}

.score-pill span {
  font-size: 17px;
  line-height: 1;
  font-weight: 750;
}

.score-pill small {
  color: var(--sw-text-muted);
  font-size: 11px;
  margin-top: 3px;
}

.outfit-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
  gap: 10px;
}

.outfit-item {
  min-width: 0;
  background: var(--sw-surface-soft);
  border-radius: var(--sw-radius);
  overflow: hidden;
}

.outfit-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.item-name {
  font-size: 12px;
  color: var(--sw-text);
  padding: 7px 7px 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-category {
  font-size: 11px;
  color: var(--sw-text-muted);
  padding: 0 7px 7px;
}

.outfit-insights {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.accuracy-banner {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 10px;
  border-radius: var(--sw-radius);
  font-size: 12px;
  line-height: 1.45;
}

.accuracy-banner .van-icon {
  flex: 0 0 auto;
  margin-top: 1px;
}

.constraint-list {
  padding: 10px;
  border: 1px dashed rgba(223, 121, 87, 0.45);
  border-radius: var(--sw-radius);
  background: rgba(255, 246, 242, 0.72);
}

.constraint-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #9b4a31;
  font-weight: 700;
  margin-bottom: 6px;
}

.constraint-item {
  font-size: 12px;
  color: var(--sw-text-muted);
  line-height: 1.45;
}

.constraint-item + .constraint-item {
  margin-top: 4px;
}

.comfort-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.comfort-list span {
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 999px;
  background: var(--sw-primary-soft);
  color: var(--sw-primary);
  font-size: 11px;
  line-height: 1.25;
}

.note-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.note-chips span {
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 999px;
  background: var(--sw-surface-soft);
  color: var(--sw-text-muted);
  font-size: 11px;
  line-height: 1.25;
}

.note-chips .van-icon {
  color: var(--sw-primary);
}

.missing-list {
  padding: 10px;
  border: 1px dashed rgba(223, 121, 87, 0.45);
  border-radius: var(--sw-radius);
  background: rgba(255, 246, 242, 0.72);
}

.missing-title {
  font-size: 12px;
  color: #9b4a31;
  font-weight: 700;
  margin-bottom: 6px;
}

.missing-item {
  font-size: 12px;
  color: var(--sw-text-muted);
  line-height: 1.45;
}

.missing-item + .missing-item {
  margin-top: 4px;
}

.breakdown-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.breakdown-item {
  min-width: 0;
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius);
  padding: 8px 7px;
  background: var(--sw-surface);
}

.breakdown-item span,
.breakdown-item strong {
  display: block;
  text-align: center;
}

.breakdown-item span {
  font-size: 11px;
  color: var(--sw-text-muted);
  margin-bottom: 3px;
}

.breakdown-item strong {
  font-size: 13px;
  color: var(--sw-text);
}

.ai-review-card {
  border: 1px solid rgba(47, 143, 123, 0.2);
  border-radius: var(--sw-radius);
  background: linear-gradient(180deg, rgba(232, 246, 242, 0.72), rgba(255, 255, 255, 0.88));
  padding: 11px;
}

.ai-review-card.unavailable {
  border-color: var(--sw-border);
  background: var(--sw-surface-soft);
}

.ai-review-card.conflict {
  border-color: rgba(223, 121, 87, 0.45);
  background: rgba(255, 246, 242, 0.72);
}

.ai-review-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.ai-review-head > div {
  min-width: 0;
}

.ai-review-title {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--sw-primary);
  font-size: 13px;
  font-weight: 750;
  margin-bottom: 5px;
}

.ai-review-head p {
  margin: 0;
  color: var(--sw-text);
  font-size: 13px;
  line-height: 1.45;
}

.ai-review-head > span {
  flex: 0 0 auto;
  align-self: flex-start;
  border-radius: 999px;
  padding: 4px 7px;
  background: var(--sw-surface);
  color: var(--sw-text-muted);
  font-size: 11px;
  font-weight: 650;
}

.ai-score-row,
.ai-dimensions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.ai-score-row div,
.ai-dimension {
  min-width: 0;
  border-radius: var(--sw-radius);
  background: rgba(255, 255, 255, 0.72);
  padding: 8px 6px;
  text-align: center;
}

.ai-score-row span,
.ai-dimension span {
  display: block;
  margin-bottom: 3px;
  color: var(--sw-text-muted);
  font-size: 11px;
}

.ai-score-row strong,
.ai-dimension strong {
  color: var(--sw-text);
  font-size: 13px;
}

.ai-review-detail {
  margin-top: 9px;
}

.ai-review-detail summary {
  cursor: pointer;
  color: var(--sw-primary);
  font-size: 12px;
  font-weight: 650;
  list-style: none;
}

.ai-review-detail summary::-webkit-details-marker {
  display: none;
}

.ai-list-block,
.ai-gap-opinion {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(47, 143, 123, 0.14);
}

.ai-list-title {
  color: var(--sw-text);
  font-size: 12px;
  font-weight: 750;
  margin-bottom: 5px;
}

.ai-list-item,
.ai-gap-opinion p {
  margin: 0;
  color: var(--sw-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.ai-list-item + .ai-list-item {
  margin-top: 4px;
}

.ai-list-block.risk .ai-list-title {
  color: #9b4a31;
}

.ai-gap-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
}

.ai-gap-tags span {
  max-width: 100%;
  border-radius: 999px;
  background: var(--sw-surface);
  color: var(--sw-text-muted);
  padding: 5px 8px;
  font-size: 11px;
  line-height: 1.2;
}

.feedback-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.feedback-actions button {
  min-width: 0;
  border: 1px solid var(--sw-border);
  border-radius: 999px;
  background: var(--sw-surface);
  color: var(--sw-text-muted);
  padding: 8px 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.feedback-actions .van-icon {
  color: var(--sw-primary);
}

.feedback-actions button.active {
  border-color: var(--sw-primary);
  background: var(--sw-primary-soft);
  color: var(--sw-primary);
  font-weight: 650;
}

.feedback-actions button.disliked.active {
  border-color: rgba(223, 121, 87, 0.45);
  background: var(--sw-accent-soft);
  color: #9b4a31;
}

.feedback-actions button:disabled {
  opacity: 0.72;
}

.empty-state {
  text-align: center;
  padding: 48px 20px;
}

.empty-title {
  font-size: 17px;
  font-weight: 650;
  color: var(--sw-text);
  margin: 14px 0 18px;
}

.empty-btn {
  width: 150px;
}
</style>
