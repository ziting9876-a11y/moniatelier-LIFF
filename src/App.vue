<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useCartStore } from './stores/cart' // 👈 導入 Pinia Cart Store（請依專案實際路徑微調）
// 引入品牌 Logo
import logoImg from './assets/logo.png'

const router = useRouter()
const route = useRoute()
const cartStore = useCartStore() // 👈 初始化 Cart Store 實例

onMounted(() => {
  // 取得網址上的 query 參數
  const urlParams = new URLSearchParams(window.location.search)
  const status = urlParams.get('status')
  const orderNo = urlParams.get('orderNo')

  if (status === 'success') {
    // 1. 調用 Pinia Store 的清空方法（相容各種常見命名 clearCart / clear）
    if (typeof cartStore.clearCart === 'function') {
      cartStore.clearCart()
    } else if (typeof cartStore.clear === 'function') {
      cartStore.clear()
    } else if (Array.isArray(cartStore.items)) {
      cartStore.items = [] // 若 Store 無清空 function，直接賦予空陣列
    }

    // 2. 徹底清除所有可能使用到的 LocalStorage 鍵值
    localStorage.removeItem('cart')
    localStorage.removeItem('moni_cart')
    localStorage.removeItem('cartItems')

    // 3. 觸發全域事件（相容舊元件監聽）
    window.dispatchEvent(new Event('cart-updated'))

    // 4. 提示使用者付款成功
    alert(`🌸 感謝您的訂購！付款已成功完成。\n訂單編號：${orderNo || ''}`)

    // 5. 清除 URL 上的 status 與 orderNo 參數，保持網址乾淨
    router.replace({ path: route.path, query: {} })
  } else if (status === 'failed' || status === 'error') {
    alert('❌ 付款流程未完成或發生錯誤，請重新嘗試。')
    router.replace({ path: route.path, query: {} })
  }
})
</script>

<template>
  <div class="shop-container">
    <!-- 頁首 Header：全站固定顯示 -->
    <header class="header">
      <div class="logo-wrapper">
        <router-link to="/">
          <img :src="logoImg" alt="MONI ATELIER" class="brand-logo" />
        </router-link>
      </div>
    </header>

    <!-- 🎯 路由切換的核心視窗：根據網址自動切換顯示頁面 -->
    <main>
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shop-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.2rem;
  font-family: 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
  color: #333333;
  background-color: #34444E;
  min-height: 100vh;
}

.header {
  text-align: center;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.logo-wrapper {
  display: inline-block;
}

.brand-logo {
  max-width: 220px;
  height: auto;
  display: block;
  margin: 0 auto;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  cursor: pointer;
}
</style>