<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
// @ts-ignore
import { useCartStore } from './stores/cart'
import logoImg from './assets/logo.png'

const router = useRouter()
const route = useRoute()
const cartStore = useCartStore()

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const status = urlParams.get('status')
  const orderNo = urlParams.get('orderNo')

  if (status === 'success') {
    if (typeof cartStore.clearCart === 'function') {
      cartStore.clearCart()
    } else if (typeof cartStore.clear === 'function') {
      cartStore.clear()
    } else if (Array.isArray(cartStore.items)) {
      cartStore.items = []
    }

    localStorage.removeItem('cart')
    localStorage.removeItem('moni_cart')
    localStorage.removeItem('cartItems')

    window.dispatchEvent(new Event('cart-updated'))
    alert(`🌸 感謝您的訂購！付款已成功完成。\n訂單編號：${orderNo || ''}`)
    router.replace({ path: route.path, query: {} })
  } else if (status === 'failed' || status === 'error') {
    alert('❌ 付款流程未完成或發生錯誤，請重新嘗試。')
    router.replace({ path: route.path, query: {} })
  }
})
</script>

<template>
  <div class="shop-container">
    <!-- 🌸 全站唯一 Header Logo -->
    <header class="header">
      <div class="logo-wrapper">
        <router-link to="/">
          <img :src="logoImg" alt="MONI ATELIER" class="brand-logo" />
        </router-link>
      </div>
    </header>

    <!-- 🎯 頁面核心區域 -->
    <main>
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shop-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1.2rem;
  font-family: 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
  color: #333333;
  background-color: #34444E;
  min-height: 100vh;
}

.header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.logo-wrapper {
  display: inline-block;
}

.brand-logo {
  max-width: 160px;
  height: auto;
  display: block;
  margin: 0 auto;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  cursor: pointer;
}
</style>