import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PaymentResult from '../components/PaymentResult.vue'
import AdminView from '../views/AdminView.vue' // 🌸 引入管理員看板頁面

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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router