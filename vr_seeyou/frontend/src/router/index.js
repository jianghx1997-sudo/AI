import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Upload from '../views/Upload.vue'
import Wardrobe from '../views/Wardrobe.vue'
import ClothDetail from '../views/ClothDetail.vue'
import Recommendations from '../views/Recommendations.vue'
import WearCalendar from '../views/WearCalendar.vue'
import Login from '../views/Login.vue'
import Profile from '../views/Profile.vue'
import { getCurrentUser } from '../api/auth'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { title: '登录', hideTabbar: true }
  },
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { title: '首页', requiresAuth: true }
  },
  {
    path: '/upload',
    name: 'Upload',
    component: Upload,
    meta: { title: '添加衣物', requiresAuth: true }
  },
  {
    path: '/wardrobe',
    name: 'Wardrobe',
    component: Wardrobe,
    meta: { title: '我的衣橱', requiresAuth: true }
  },
  {
    path: '/recommend',
    name: 'Recommendations',
    component: Recommendations,
    meta: { title: '今日推荐', requiresAuth: true }
  },
  {
    path: '/calendar',
    name: 'WearCalendar',
    component: WearCalendar,
    meta: { title: '穿搭日历', requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: { title: '个人资料', requiresAuth: true, hideTabbar: true }
  },
  {
    path: '/cloth/:id',
    name: 'ClothDetail',
    component: ClothDetail,
    meta: { title: '衣物详情', requiresAuth: true, hideTabbar: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title + ' - AI智能衣橱'
  }

  const authStore = useAuthStore()
  if (to.name === 'Login' && authStore.isAuthenticated) {
    next('/')
    return
  }

  if (!to.meta.requiresAuth) {
    next()
    return
  }

  if (!authStore.isAuthenticated) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (!authStore.user) {
    try {
      const res = await getCurrentUser()
      if (res.success) {
        authStore.setUser(res.data)
      }
    } catch (error) {
      authStore.clearSession()
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }
  }

  next()
})

export default router
