import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PaymentResult from '../components/PaymentResult.vue'
import AdminView from '../views/AdminView.vue' // 🌸 引入管理員看板頁面
import PosWorkerView from '../views/PosWorkerView.vue' // 🌸 引入花藝師工作台 & POS 頁面
import BossAdminView from '../views/BossAdminView.vue' // 👑 引入老闆專屬管理平台

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView
  },
  {
    path: '/payment-result',
    name: 'PaymentResult',
    component: PaymentResult
  },
  {
    path: '/admin', // 🌸 管理員看板網址路徑
    name: 'Admin',
    component: AdminView
  },
  {
    path: '/pos', // 🌸 花藝工作台 & POS 網址路徑
    name: 'PosWorkbench',
    component: PosWorkerView
  },
  {
    path: '/boss', // 👑 老闆專屬後台管理平台路徑
    name: 'BossAdmin',
    component: BossAdminView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router