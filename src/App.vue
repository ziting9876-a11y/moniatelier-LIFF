<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
// 引入品牌 Logo
import logoImg from './assets/logo.png'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  // 取得網址上的 query 參數
  const urlParams = new URLSearchParams(window.location.search)
  const status = urlParams.get('status')
  const orderNo = urlParams.get('orderNo')

  if (status === 'success') {
    // 1. 清空前端購物車 (若有使用 localStorage 或依專案邏輯調整)
    localStorage.removeItem('cart')
    localStorage.removeItem('moni_cart')
    
    // 2. 觸發自訂事件或全域通知 (讓其他元件收到購物車已清空的通知)
    window.dispatchEvent(new Event('cart-updated'))

    // 3. 提示使用者付款成功
    alert(`🌸 感謝您的訂購！付款已成功完成。\n訂單編號：${orderNo || ''}`)

    // 4. 清除 URL 上的 status 與 orderNo 參數，保持網址乾淨
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