import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Upload from '../views/Upload.vue'
import Wardrobe from '../views/Wardrobe.vue'
import ClothDetail from '../views/ClothDetail.vue'
import Recommendations from '../views/Recommendations.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { title: '首页' }
  },
  {
    path: '/upload',
    name: 'Upload',
    component: Upload,
    meta: { title: '添加衣物' }
  },
  {
    path: '/wardrobe',
    name: 'Wardrobe',
    component: Wardrobe,
    meta: { title: '我的衣橱' }
  },
  {
    path: '/recommend',
    name: 'Recommendations',
    component: Recommendations,
    meta: { title: '今日推荐' }
  },
  {
    path: '/cloth/:id',
    name: 'ClothDetail',
    component: ClothDetail,
    meta: { title: '衣物详情' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title + ' - AI智能衣橱'
  }
  next()
})

export default router
