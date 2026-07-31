<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useCartStore } from '../stores/cart' // 🎯 引入 Pinia Store

const route = useRoute()
const cartStore = useCartStore()

const orderNo = ref('')

onMounted(() => {
  // 1. 從網址 Query 取得後端傳過來的訂單編號
  if (route.query.orderNo) {
    orderNo.value = route.query.orderNo as string
  }

  // 2. 付款成功進入此頁面時，自動清空 Pinia 購物車
  if (cartStore.clearCart) {
    cartStore.clearCart()
  }
})
</script>

<template>
  <div class="result-card">
    <div class="success-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>
    <h2>付款成功！</h2>
    <p class="subtitle">感謝您在墨凝花室的訂購，我們已收到您的訂單。</p>

    <!-- 顯示訂單編號 -->
    <p v-if="orderNo" class="order-no">訂單編號：<span>{{ orderNo }}</span></p>

    <p class="description">我們將儘速為您準備花藝商品，如有任何問題歡迎隨時聯繫我們。</p>

    <router-link to="/" class="home-btn">返回首頁</router-link>
  </div>
</template>

<style scoped>
.result-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 2.5rem 1.5rem;
  max-width: 480px;
  margin: 3rem auto;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.success-icon {
  margin-bottom: 1rem;
}

h2 {
  color: #2d3748;
  font-size: 1.6rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #4a5568;
  font-size: 0.95rem;
  margin-bottom: 1rem;
}

.order-no {
  background-color: #f8fafc;
  padding: 0.6rem 1rem;
  border-radius: 4px;
  display: inline-block;
  font-size: 0.9rem;
  color: #34444e;
  font-weight: 600;
  margin-bottom: 1rem;
  border: 1px dashed #cbd5e1;
}

.order-no span {
  color: #2b6cb0;
}

.description {
  color: #718096;
  font-size: 0.85rem;
  line-height: 1.6;
  margin-bottom: 1.8rem;
}

.home-btn {
  display: inline-block;
  background-color: #34444e;
  color: #ffffff;
  padding: 0.75rem 2rem;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

.home-btn:hover {
  background-color: #232d34;
}
</style>