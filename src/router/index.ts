import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PaymentResult from '../components/PaymentResult.vue'

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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router