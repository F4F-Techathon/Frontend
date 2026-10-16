import { createRouter, createWebHistory } from 'vue-router'
import { useDiningStore } from '@/stores/dining'
const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes: [
  { path: '/', component: () => import('@/views/HomeView.vue'), meta: { title: '今晚吃谁？' } },
  { path: '/input', component: () => import('@/views/InputView.vue'), meta: { title: '说说你的想法' } },
  { path: '/filter', component: () => import('@/views/FilterView.vue'), meta: { title: '先圈定一下范围', needsInput: true } },
  { path: '/map', component: () => import('@/views/MapView.vue'), meta: { title: '在地图上挑选选手', needsInput: true } },
  { path: '/debate', component: () => import('@/views/DebateView.vue'), meta: { title: '餐馆路演', needsInput: true, needsSelection: true } },
  { path: '/result', component: () => import('@/views/ResultView.vue'), meta: { title: '今晚的最佳选择', needsInput: true, needsSelection: true } },
  { path: '/restaurant/:id', component: () => import('@/views/RestaurantView.vue'), meta: { title: '餐厅详情' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
], scrollBehavior: (_to, _from, saved) => saved || { top: 0 } })
router.beforeEach((to) => { const store = useDiningStore(); if (to.meta.needsInput && !store.rawInput) return '/input'; if (to.meta.needsSelection && store.selected.length < 2) return '/map'; document.title = `${to.meta.title} · 让选择有趣一点` })
export default router
