<template>
  <div class="home page-shell">
    <section class="today-card surface-card">
      <div>
        <div class="eyebrow">今日衣橱</div>
        <h1>{{ weatherTitle }}</h1>
        <p>{{ weatherSubtitle }}</p>
      </div>
      <div class="today-actions">
        <button class="profile-chip" @click="$router.push('/profile')">
          <van-icon name="manager-o" />
          <span>{{ authStore.user?.display_name || '我' }}</span>
        </button>
        <van-button type="primary" round size="small" @click="$router.push('/recommend')">
          今日搭配
        </van-button>
      </div>
    </section>

    <section class="quick-actions">
      <button class="quick-card surface-card" @click="$router.push('/upload')">
        <van-icon name="photograph" size="24" />
        <span>添加衣物</span>
      </button>
      <button class="quick-card surface-card" @click="$router.push('/recommend')">
        <van-icon name="bulb-o" size="24" />
        <span>今日推荐</span>
      </button>
      <button class="quick-card surface-card" @click="$router.push('/wardrobe')">
        <van-icon name="apps-o" size="24" />
        <span>我的衣橱</span>
      </button>
    </section>

    <section class="analysis-section surface-card" v-if="analysis && analysis.total > 0">
      <div class="section-heading">
        <div class="section-title">衣橱状态</div>
        <span class="section-action" @click="$router.push('/wardrobe')">管理</span>
      </div>
      <div class="analysis-metrics">
        <div class="metric-item">
          <div class="metric-value">{{ analysis.total }}</div>
          <div class="metric-label">衣物</div>
        </div>
        <div class="metric-item">
          <div class="metric-value">{{ Math.round(analysis.completeness * 100) }}%</div>
          <div class="metric-label">完整度</div>
        </div>
        <div class="metric-item">
          <div class="metric-value">{{ analysis.worn_count }}</div>
          <div class="metric-label">穿过</div>
        </div>
      </div>
      <div class="insight-list">
        <div class="insight-item" v-for="item in analysis.insights" :key="item">
          {{ item }}
        </div>
      </div>
    </section>

    <section class="stats-section surface-card" v-if="stats.length > 0">
      <div class="section-heading">
        <div class="section-title">分类概览</div>
      </div>
      <div class="stats-grid">
        <div class="stat-item" v-for="item in stats" :key="item.category">
          <div class="stat-count">{{ item.count }}</div>
          <div class="stat-label">{{ item.category }}</div>
        </div>
      </div>
    </section>

    <section class="recent-section surface-card" v-if="recentClothes.length > 0">
      <div class="section-heading">
        <div class="section-title">最近添加</div>
        <span class="section-action" @click="$router.push('/wardrobe')">查看全部</span>
      </div>
      <div class="recent-grid">
        <div
          class="recent-item"
          v-for="cloth in recentClothes.slice(0, 6)"
          :key="cloth.id"
          @click="$router.push(`/cloth/${cloth.id}`)"
        >
          <AuthImage :source="cloth" :alt="cloth.name" />
          <div class="recent-name">{{ cloth.name }}</div>
        </div>
      </div>
    </section>

    <div class="empty-state surface-card" v-if="!loading && stats.length === 0">
      <van-icon name="photograph" size="46" color="#2f8f7b" />
      <div class="empty-title">衣橱还是空的</div>
      <van-button type="primary" round class="empty-btn" @click="$router.push('/upload')">
        添加第一件
      </van-button>
    </div>

    <van-loading v-if="loading" class="loading" type="spinner" color="#2f8f7b" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getCategoryStats, getClothes, getCurrentWeather, getWardrobeAnalysis } from '@/api/clothes'
import { useAuthStore } from '@/stores/auth'
import AuthImage from '@/components/AuthImage.vue'

const authStore = useAuthStore()
const stats = ref([])
const recentClothes = ref([])
const analysis = ref(null)
const currentWeather = ref(null)
const loading = ref(true)

const weatherTitle = computed(() => {
  if (currentWeather.value?.available) {
    return `${currentWeather.value.city} ${currentWeather.value.weather}`
  }
  return '轻松选好今天这一身'
})

const weatherSubtitle = computed(() => {
  if (currentWeather.value?.available) {
    return `${currentWeather.value.temperature}°C · ${analysis.value?.total || 0} 件衣物可选`
  }
  return `${analysis.value?.total || 0} 件衣物已整理`
})

onMounted(async () => {
  try {
    const [statsRes, clothesRes, analysisRes, weatherRes] = await Promise.allSettled([
      getCategoryStats(),
      getClothes({ _t: Date.now() }),
      getWardrobeAnalysis(),
      getCurrentWeather('110101')
    ])

    if (statsRes.status === 'fulfilled' && statsRes.value.success) {
      stats.value = statsRes.value.data
    }
    if (clothesRes.status === 'fulfilled' && clothesRes.value.success) {
      recentClothes.value = clothesRes.value.data.slice(0, 6)
    }
    if (analysisRes.status === 'fulfilled' && analysisRes.value.success) {
      analysis.value = analysisRes.value.data
    }
    if (weatherRes.status === 'fulfilled' && weatherRes.value.success) {
      currentWeather.value = weatherRes.value.data
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.today-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  margin-bottom: 14px;
}

.today-actions {
  flex: 0 0 auto;
  display: grid;
  gap: 8px;
  justify-items: end;
}

.profile-chip {
  max-width: 112px;
  height: 30px;
  border: 1px solid var(--sw-border);
  border-radius: 999px;
  background: var(--sw-surface);
  color: var(--sw-primary);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 650;
}

.profile-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eyebrow {
  font-size: 12px;
  color: var(--sw-primary);
  font-weight: 650;
  margin-bottom: 8px;
}

.today-card h1 {
  font-size: 22px;
  line-height: 1.25;
  color: var(--sw-text);
  margin-bottom: 6px;
  letter-spacing: 0;
}

.today-card p {
  font-size: 13px;
  color: var(--sw-text-muted);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.quick-card {
  min-width: 0;
  min-height: 82px;
  border: 1px solid var(--sw-border);
  padding: 14px 8px;
  color: var(--sw-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  background: var(--sw-surface);
}

.quick-card .van-icon {
  color: var(--sw-primary);
}

.analysis-section,
.stats-section,
.recent-section {
  padding: 16px;
  margin-bottom: 14px;
}

.analysis-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.metric-item,
.stat-item {
  text-align: center;
  padding: 12px 8px;
  background: var(--sw-surface-soft);
  border-radius: var(--sw-radius);
}

.metric-value,
.stat-count {
  font-size: 20px;
  font-weight: 750;
  color: var(--sw-primary);
  margin-bottom: 4px;
}

.metric-label,
.stat-label {
  font-size: 12px;
  color: var(--sw-text-muted);
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.insight-item {
  font-size: 13px;
  color: var(--sw-text);
  line-height: 1.5;
  padding: 10px 12px;
  background: var(--sw-accent-soft);
  border-radius: var(--sw-radius);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.recent-item {
  min-width: 0;
  overflow: hidden;
  border-radius: var(--sw-radius);
  background: var(--sw-surface-soft);
}

.recent-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.recent-name {
  font-size: 12px;
  color: var(--sw-text);
  padding: 7px 6px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  text-align: center;
  padding: 44px 20px;
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

.loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}
</style>
