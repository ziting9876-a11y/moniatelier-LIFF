<script setup lang="ts">
// 引入品牌 Logo
import logoImg from './assets/logo.png'
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