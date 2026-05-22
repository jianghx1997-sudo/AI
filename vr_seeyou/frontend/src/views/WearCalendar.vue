<template>
  <div class="wear-calendar-page">
    <van-nav-bar title="穿搭日历" fixed placeholder />

    <div class="calendar-content page-shell">
      <section class="month-panel surface-card">
        <div class="month-header">
          <button class="icon-action" @click="changeMonth(-1)" aria-label="上个月">
            <van-icon name="arrow-left" size="18" />
          </button>
          <div>
            <h1>{{ monthTitle }}</h1>
            <p>{{ totalWears }} 次穿着记录</p>
          </div>
          <button class="icon-action" @click="changeMonth(1)" aria-label="下个月">
            <van-icon name="arrow" size="18" />
          </button>
        </div>

        <div class="weekday-row">
          <span v-for="day in weekdays" :key="day">{{ day }}</span>
        </div>

        <div class="calendar-grid" :class="{ loading }">
          <button
            v-for="day in calendarDays"
            :key="day.key"
            class="day-cell"
            :class="{
              muted: !day.inMonth,
              today: day.date === todayKey,
              selected: day.date === selectedDate,
              hasLogs: day.count > 0
            }"
            @click="selectDate(day.date)"
          >
            <span class="day-number">{{ day.dayNumber }}</span>
            <span class="day-count" v-if="day.count">{{ day.count }}</span>
          </button>
        </div>
      </section>

      <section class="day-panel surface-card">
        <div class="section-heading">
          <div>
            <div class="section-title">{{ selectedTitle }}</div>
            <p>{{ selectedLogs.length ? `${selectedLogs.length} 件/次记录` : '这天还没有记录' }}</p>
          </div>
          <van-button round size="small" type="primary" plain @click="$router.push('/recommend')">
            去推荐
          </van-button>
        </div>

        <div class="wear-list" v-if="selectedLogs.length">
          <article class="wear-item" v-for="log in selectedLogs" :key="log.id">
            <div class="wear-thumb">
              <AuthImage :source="log" :alt="log.cloth_name || '穿着衣物'" />
            </div>
            <div class="wear-info">
              <div class="wear-name">{{ log.cloth_name || '已删除衣物' }}</div>
              <div class="wear-meta">
                <span v-if="log.category">{{ log.category }}</span>
                <span v-if="log.color">{{ log.color }}</span>
                <span v-if="log.occasion">{{ log.occasion }}</span>
              </div>
              <p v-if="log.weather || log.note">
                {{ [log.weather, log.note].filter(Boolean).join(' · ') }}
              </p>
            </div>
            <div class="wear-time">{{ formatTime(log.worn_at) }}</div>
          </article>
        </div>

        <div class="empty-day" v-else>
          <van-icon name="calendar-o" size="42" color="#2f8f7b" />
          <div>当天没有穿搭记录</div>
          <p>在推荐页点“已穿”，或在衣物详情里记录穿着后，这里会自动出现。</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onActivated, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { getWearCalendar } from '@/api/clothes'
import AuthImage from '@/components/AuthImage.vue'

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const loading = ref(false)
const currentMonth = ref(toMonthKey(new Date()))
const selectedDate = ref(toDateKey(new Date()))
const calendarData = ref({ days: {}, total_wears: 0 })
let mounted = false

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMonthKey(date) {
  return toDateKey(date).slice(0, 7)
}

function parseMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function addMonths(monthKey, delta) {
  const date = parseMonth(monthKey)
  date.setMonth(date.getMonth() + delta)
  return toMonthKey(date)
}

const todayKey = toDateKey(new Date())

const monthTitle = computed(() => {
  const [year, month] = currentMonth.value.split('-')
  return `${year}年${Number(month)}月`
})

const totalWears = computed(() => calendarData.value.total_wears || 0)

const calendarDays = computed(() => {
  const start = parseMonth(currentMonth.value)
  const firstDay = new Date(start)
  const mondayIndex = (firstDay.getDay() + 6) % 7
  firstDay.setDate(firstDay.getDate() - mondayIndex)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstDay)
    date.setDate(firstDay.getDate() + index)
    const key = toDateKey(date)
    const dayData = calendarData.value.days?.[key]
    return {
      key: `${key}-${index}`,
      date: key,
      dayNumber: date.getDate(),
      inMonth: key.startsWith(currentMonth.value),
      count: dayData?.count || 0
    }
  })
})

const selectedLogs = computed(() => {
  return calendarData.value.days?.[selectedDate.value]?.items || []
})

const selectedTitle = computed(() => {
  const date = new Date(`${selectedDate.value}T00:00:00`)
  return `${date.getMonth() + 1}月${date.getDate()}日穿搭`
})

function normalizeSelectedDate() {
  if (!selectedDate.value.startsWith(currentMonth.value)) {
    const dates = Object.keys(calendarData.value.days || {}).sort()
    selectedDate.value = dates[0] || `${currentMonth.value}-01`
  }
}

async function loadCalendar() {
  loading.value = true
  try {
    const res = await getWearCalendar(currentMonth.value)
    if (res.success) {
      calendarData.value = res.data || { days: {}, total_wears: 0 }
      normalizeSelectedDate()
    } else {
      showToast(res.error || '获取穿搭日历失败')
    }
  } catch (error) {
    showToast(error.message || '获取穿搭日历失败')
  } finally {
    loading.value = false
  }
}

function changeMonth(delta) {
  currentMonth.value = addMonths(currentMonth.value, delta)
  loadCalendar()
}

function selectDate(date) {
  selectedDate.value = date
  if (!date.startsWith(currentMonth.value)) {
    currentMonth.value = date.slice(0, 7)
    loadCalendar()
  }
}

function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  mounted = true
  loadCalendar()
})

onActivated(() => {
  if (mounted) loadCalendar()
})
</script>

<style scoped>
.calendar-content {
  padding-bottom: calc(86px + env(safe-area-inset-bottom));
}

.month-panel,
.day-panel {
  padding: 16px;
  margin-bottom: 14px;
}

.month-header,
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.month-header {
  margin-bottom: 14px;
}

.month-header h1 {
  color: var(--sw-text);
  font-size: 22px;
  line-height: 1.2;
  text-align: center;
}

.month-header p,
.section-heading p {
  margin-top: 4px;
  color: var(--sw-text-muted);
  font-size: 12px;
  text-align: center;
}

.icon-action {
  width: 38px;
  height: 38px;
  border: 1px solid var(--sw-border);
  border-radius: 50%;
  background: var(--sw-surface);
  color: var(--sw-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.weekday-row,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-row {
  margin-bottom: 8px;
  color: var(--sw-text-muted);
  font-size: 12px;
  text-align: center;
}

.weekday-row span {
  height: 22px;
  line-height: 22px;
}

.calendar-grid {
  gap: 6px;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.calendar-grid.loading {
  opacity: 0.55;
}

.day-cell {
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  border: 1px solid var(--sw-border);
  border-radius: 8px;
  background: var(--sw-surface);
  color: var(--sw-text);
  font-size: 14px;
  font-weight: 650;
}

.day-cell.muted {
  color: #b6c0ba;
  background: #f8faf8;
}

.day-cell.today {
  border-color: var(--sw-primary);
}

.day-cell.selected {
  color: #fff;
  background: var(--sw-primary);
  border-color: var(--sw-primary);
}

.day-cell.hasLogs:not(.selected) {
  background: #edf7f3;
}

.day-number {
  position: absolute;
  top: 7px;
  left: 8px;
}

.day-count {
  position: absolute;
  right: 6px;
  bottom: 5px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--sw-primary);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
}

.day-cell.selected .day-count {
  background: rgba(255, 255, 255, 0.22);
}

.section-title {
  color: var(--sw-text);
  font-size: 18px;
  font-weight: 750;
}

.section-heading {
  margin-bottom: 14px;
}

.section-heading p {
  text-align: left;
}

.wear-list {
  display: grid;
  gap: 10px;
}

.wear-item {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--sw-border);
  border-radius: 8px;
  background: var(--sw-surface-soft);
}

.wear-thumb {
  width: 64px;
  height: 64px;
  overflow: hidden;
  border-radius: 8px;
  background: #edf4f0;
}

.wear-thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wear-info {
  min-width: 0;
}

.wear-name {
  color: var(--sw-text);
  font-size: 15px;
  font-weight: 750;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wear-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}

.wear-meta span {
  padding: 3px 7px;
  border-radius: 999px;
  background: #eef5f1;
  color: var(--sw-text-muted);
  font-size: 11px;
}

.wear-info p {
  margin-top: 6px;
  color: var(--sw-text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.wear-time {
  color: var(--sw-text-muted);
  font-size: 12px;
}

.empty-day {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 28px 10px;
  text-align: center;
}

.empty-day div {
  color: var(--sw-text);
  font-size: 17px;
  font-weight: 750;
}

.empty-day p {
  max-width: 260px;
  color: var(--sw-text-muted);
  font-size: 12px;
  line-height: 1.6;
}
</style>
