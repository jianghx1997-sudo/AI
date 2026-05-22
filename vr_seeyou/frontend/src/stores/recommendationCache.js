import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getClothes, getOutfitRecommendations } from '@/api/clothes'
import { useAuthStore } from '@/stores/auth'

const CACHE_TTL_MS = 10 * 60 * 1000
const WARDROBE_VERSION_TTL_MS = 60 * 1000
const PREFETCH_OCCASIONS = ['休闲', '通勤', '约会']

function normalizeValue(value) {
  return value === undefined || value === null ? '' : String(value)
}

function normalizeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : ''
}

function getItemStamp(item) {
  return normalizeValue(item.updated_at || item.created_at || item.id)
}

function buildWardrobeVersion(items = []) {
  if (!items.length) return 'empty'
  const maxId = Math.max(...items.map(item => Number(item.id) || 0))
  const latestStamp = items.map(getItemStamp).sort().at(-1) || ''
  return `${items.length}:${maxId}:${latestStamp}`
}

export const useRecommendationCacheStore = defineStore('recommendationCache', () => {
  const authStore = useAuthStore()
  const cache = ref({})
  const inflight = ref({})
  const wardrobeVersion = ref('')
  const wardrobeVersionLoadedAt = ref(0)

  const userKey = computed(() => normalizeValue(authStore.user?.id || authStore.user?.username || 'anonymous'))

  const resolveWardrobeVersion = async ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && wardrobeVersion.value && now - wardrobeVersionLoadedAt.value < WARDROBE_VERSION_TTL_MS) {
      return wardrobeVersion.value
    }

    const res = await getClothes({ _t: now })
    if (res.success) {
      wardrobeVersion.value = buildWardrobeVersion(res.data || [])
      wardrobeVersionLoadedAt.value = now
      return wardrobeVersion.value
    }

    wardrobeVersion.value = `unknown:${now}`
    wardrobeVersionLoadedAt.value = now
    return wardrobeVersion.value
  }

  const buildCacheKey = async (params = {}, options = {}) => {
    const version = options.wardrobeVersion || await resolveWardrobeVersion({ force: options.forceWardrobeVersion })
    return JSON.stringify({
      user: userKey.value,
      occasion: normalizeValue(params.occasion),
      city: normalizeValue(params.city),
      weather: normalizeValue(params.weather),
      temperature: normalizeNumber(params.temperature),
      useWeather: Boolean(params.useWeather),
      aiReview: params.aiReview !== false,
      wardrobeVersion: version
    })
  }

  const getCachedEntry = async (params = {}) => {
    const key = await buildCacheKey(params)
    const entry = cache.value[key]
    if (!entry || Date.now() - entry.createdAt > CACHE_TTL_MS) return null
    return { key, ...entry }
  }

  const setCacheEntry = (key, data) => {
    cache.value = {
      ...cache.value,
      [key]: {
        data,
        createdAt: Date.now()
      }
    }
  }

  const fetchRecommendations = async (params = {}, options = {}) => {
    const key = await buildCacheKey(params, { forceWardrobeVersion: options.force })
    const entry = cache.value[key]
    const isFresh = entry && Date.now() - entry.createdAt <= CACHE_TTL_MS

    if (isFresh && !options.force) {
      return { data: entry.data, fromCache: true, cachedAt: entry.createdAt, key }
    }

    if (inflight.value[key]) {
      const data = await inflight.value[key]
      return { data, fromCache: false, cachedAt: Date.now(), key }
    }

    const request = getOutfitRecommendations(params).then((res) => {
      if (res.success) {
        setCacheEntry(key, res.data)
        return res.data
      }
      throw new Error(res.error || '推荐生成失败')
    }).finally(() => {
      const next = { ...inflight.value }
      delete next[key]
      inflight.value = next
    })

    inflight.value = { ...inflight.value, [key]: request }
    const data = await request
    return { data, fromCache: false, cachedAt: Date.now(), key }
  }

  const prefetchRecommendations = async (params = {}, options = {}) => {
    try {
      const cached = await getCachedEntry(params)
      if (cached && !options.force) return cached
      return await fetchRecommendations(params, { force: options.force })
    } catch (error) {
      return null
    }
  }

  const prefetchFrequentScenes = (baseParams = {}) => {
    if (typeof window === 'undefined') return
    PREFETCH_OCCASIONS.forEach((occasion, index) => {
      window.setTimeout(() => {
        prefetchRecommendations({ ...baseParams, occasion })
      }, index * 1200)
    })
  }

  const clearCache = () => {
    cache.value = {}
    inflight.value = {}
    wardrobeVersion.value = ''
    wardrobeVersionLoadedAt.value = 0
  }

  const markWardrobeChanged = () => {
    clearCache()
  }

  return {
    cache,
    userKey,
    getCachedEntry,
    fetchRecommendations,
    prefetchRecommendations,
    prefetchFrequentScenes,
    clearCache,
    markWardrobeChanged
  }
})
