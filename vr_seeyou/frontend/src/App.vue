<template>
  <div class="app">
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>

    <van-tabbar v-if="!route.meta.hideTabbar" v-model="activeTab" route fixed placeholder>
      <van-tabbar-item to="/" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/upload" icon="photograph">添加</van-tabbar-item>
      <van-tabbar-item to="/recommend" icon="bulb-o">推荐</van-tabbar-item>
      <van-tabbar-item to="/calendar" icon="calendar-o">日历</van-tabbar-item>
      <van-tabbar-item to="/wardrobe" icon="apps-o">衣橱</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeTab = ref(0)

const routeMap = { '/': 0, '/upload': 1, '/recommend': 2, '/calendar': 3, '/wardrobe': 4 }

watch(
  () => route.path,
  (newPath) => {
    activeTab.value = routeMap[newPath] || 0
  },
  { immediate: true }
)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--sw-bg);
  color: var(--sw-text);
}

#app {
  height: 100%;
}

.app {
  min-height: 100vh;
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
