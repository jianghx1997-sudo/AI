<template>
  <div class="wardrobe">
    <van-nav-bar title="我的衣橱" fixed placeholder>
      <template #right>
        <van-icon name="replay" size="20" color="#2f8f7b" @click="fetchClothes" />
      </template>
    </van-nav-bar>

    <van-pull-refresh v-model="refreshing" @refresh="fetchClothes">
      <div class="wardrobe-content page-shell">
        <section class="manage-panel surface-card">
          <van-search
            v-model="searchKeyword"
            placeholder="搜索衣物、颜色、风格"
            shape="round"
            background="transparent"
            class="wardrobe-search"
          />

          <div class="filter-block">
            <div class="filter-title">分类</div>
            <div class="chip-row">
              <button class="choice-chip" :class="{ active: categoryFilter === '' }" @click="categoryFilter = ''">全部</button>
              <button
                class="choice-chip"
                v-for="cat in categories"
                :key="cat"
                :class="{ active: categoryFilter === cat }"
                @click="categoryFilter = cat"
              >
                {{ cat }}
              </button>
            </div>
          </div>

          <div class="filter-block">
            <div class="filter-title">季节</div>
            <div class="chip-row">
              <button class="choice-chip" :class="{ active: seasonFilter === '' }" @click="seasonFilter = ''">全部</button>
              <button
                class="choice-chip"
                v-for="season in seasons"
                :key="season"
                :class="{ active: seasonFilter === season }"
                @click="seasonFilter = season"
              >
                {{ season }}
              </button>
              <button class="choice-chip" :class="{ active: favoriteFilter === 'true' }" @click="toggleFavoriteFilter">
                已收藏
              </button>
            </div>
          </div>
        </section>

        <div class="count-bar" v-if="filteredClothes.length > 0">
          共 {{ filteredClothes.length }} 件衣物
        </div>

        <section class="clothes-grid" v-if="filteredClothes.length > 0">
          <article
            class="cloth-card surface-card"
            v-for="cloth in filteredClothes"
            :key="cloth.id"
            @click="$router.push(`/cloth/${cloth.id}`)"
          >
            <div class="cloth-image-wrapper">
              <AuthImage :source="cloth" :alt="cloth.name" loading="lazy" />
              <div class="category-badge">{{ cloth.category }}</div>
              <div class="favorite-badge" v-if="cloth.is_favorite">
                <van-icon name="like" size="15" />
              </div>
            </div>
            <div class="cloth-info">
              <div class="cloth-name">{{ cloth.name }}</div>
              <div class="cloth-meta">
                <span>{{ cloth.color || '未填颜色' }}</span>
                <span>{{ cloth.season || '未填季节' }}</span>
              </div>
            </div>
          </article>
        </section>

        <div class="empty-state surface-card" v-if="!loading && filteredClothes.length === 0">
          <van-icon name="apps-o" size="46" color="#2f8f7b" />
          <div class="empty-title">
            {{ clothes.length === 0 ? '衣橱还是空的' : '没有匹配的衣物' }}
          </div>
          <van-button
            v-if="clothes.length === 0"
            type="primary"
            round
            class="empty-btn"
            @click="$router.push('/upload')"
          >
            添加衣物
          </van-button>
        </div>

        <van-loading v-if="loading" class="loading" type="spinner" color="#2f8f7b" />
      </div>
    </van-pull-refresh>
  </div>
</template>

<script setup>
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { getClothes } from '@/api/clothes'
import AuthImage from '@/components/AuthImage.vue'

const route = useRoute()
const clothes = ref([])
const loading = ref(true)
const refreshing = ref(false)
const categoryFilter = ref('')
const seasonFilter = ref('')
const favoriteFilter = ref('')
const searchKeyword = ref('')

const categories = ['上衣', '裤子', '裙子', '外套', '鞋子', '配饰']
const seasons = ['春/秋', '夏季', '冬季', '四季']

const toggleFavoriteFilter = () => {
  favoriteFilter.value = favoriteFilter.value === 'true' ? '' : 'true'
}

const filteredClothes = computed(() => {
  return clothes.value.filter((cloth) => {
    const matchCategory = !categoryFilter.value || cloth.category === categoryFilter.value
    const matchSeason = !seasonFilter.value || cloth.season === seasonFilter.value
    const matchFavorite = !favoriteFilter.value || (favoriteFilter.value === 'true' && cloth.is_favorite)
    const keyword = searchKeyword.value.trim().toLowerCase()
    const matchSearch =
      !keyword ||
      [cloth.name, cloth.category, cloth.color, cloth.season, cloth.material, cloth.style, cloth.occasion, cloth.brand, cloth.tags]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(keyword))
    return matchCategory && matchSeason && matchFavorite && matchSearch
  })
})

const fetchClothes = async () => {
  loading.value = true
  try {
    const res = await getClothes({ _t: Date.now() })
    if (res.success) {
      clothes.value = res.data
    }
  } catch (error) {
    showToast(error.message || '获取衣物失败')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(fetchClothes)
onActivated(fetchClothes)
watch(() => route.fullPath, fetchClothes)
</script>

<style scoped>
.manage-panel {
  padding: 10px 12px 14px;
  margin-bottom: 12px;
}

.wardrobe-search {
  padding: 0;
  margin-bottom: 12px;
}

.filter-block {
  margin-bottom: 12px;
}

.filter-block:last-child {
  margin-bottom: 0;
}

.filter-title {
  font-size: 12px;
  font-weight: 650;
  color: var(--sw-text-muted);
  margin: 0 0 8px 4px;
}

.count-bar {
  font-size: 13px;
  color: var(--sw-text-muted);
  margin: 0 4px 10px;
}

.clothes-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cloth-card {
  min-width: 0;
  overflow: hidden;
  transition: transform 0.18s ease;
}

.cloth-card:active {
  transform: scale(0.98);
}

.cloth-image-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--sw-surface-soft);
}

.cloth-image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.category-badge {
  position: absolute;
  right: 8px;
  top: 8px;
  max-width: calc(100% - 16px);
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--sw-primary);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.favorite-badge {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  color: var(--sw-accent);
}

.cloth-info {
  padding: 10px 11px 12px;
}

.cloth-name {
  font-size: 14px;
  font-weight: 650;
  color: var(--sw-text);
  margin-bottom: 7px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cloth-meta {
  display: flex;
  gap: 6px;
  min-width: 0;
}

.cloth-meta span {
  min-width: 0;
  max-width: 50%;
  padding: 4px 7px;
  border-radius: 999px;
  background: var(--sw-surface-soft);
  color: var(--sw-text-muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}
</style>
