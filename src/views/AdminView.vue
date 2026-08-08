<template>
  <div class="admin-container">
    <h2>🌸 墨凝花室 | 訂單管理看板</h2>
    
    <!-- 訂單卡片列表 -->
    <div v-for="order in orders" :key="order.merchantOrderNo" class="order-card">
      <div class="card-header">
        <span class="order-no">單號：{{ order.merchantOrderNo }}</span>
        <span class="status-badge">{{ formatStatus(order.status) }}</span>
      </div>

      <div class="card-body">
        <!-- 🎯 關鍵資訊直觀常駐顯示 -->
        <p><strong>購買人：</strong>{{ order.payer?.name || '未知' }} ({{ order.payer?.phone || '無電話' }})</p>
        <p><strong>收件人：</strong>{{ order.recipient?.name || order.payer?.name }} ({{ order.recipient?.phone || order.payer?.phone }})</p>
        
        <!-- 🎯 必填焦點：希望送達日期與取件方式 -->
        <p class="delivery-highlight">
          <strong>📅 送達日期：</strong>
          <span class="date-tag">{{ order.deliveryDate || '未指定' }}</span>
        </p>
        <p><strong>🚚 取件方式：</strong>{{ formatDeliveryMethod(order.deliveryMethod) }}</p>
        <p><strong>💰 總金額：</strong><span class="price">NT$ {{ order.totalAmount?.toLocaleString() }}</span></p>
        <p class="time-text">下單時間：{{ formatDate(order.createdAt) }}</p>

        <!-- 🎯 新增：查看完整詳情按鈕 -->
        <button class="btn-detail" @click="selectedOrder = order">
          🔍 查看訂單完整細節與商品明細
        </button>
      </div>

      <!-- 狀態變更按鈕區 -->
      <div class="action-buttons">
        <button @click="updateStatus(order.merchantOrderNo, 'accepted')">已接單</button>
        <button @click="updateStatus(order.merchantOrderNo, 'in_production')">製作中</button>
        <button @click="updateStatus(order.merchantOrderNo, 'delivering')">配送中</button>
        <button class="btn-complete" @click="updateStatus(order.merchantOrderNo, 'completed')">
          已完成 (發送LINE通知)
        </button>
      </div>
    </div>

    <!-- 🎯 完整資訊彈窗 Modal -->
    <div v-if="selectedOrder" class="modal-overlay" @click.self="selectedOrder = null">
      <div class="modal-content">
        <h3>📋 訂單完整細節 (單號：{{ selectedOrder.merchantOrderNo }})</h3>
        <hr />

        <div class="modal-section">
          <h4>👤 訂購人資訊</h4>
          <p>姓名：{{ selectedOrder.payer?.name }}</p>
          <p>電話：{{ selectedOrder.payer?.phone }}</p>
          <p>Email：{{ selectedOrder.payer?.email || selectedOrder.customerEmail }}</p>
        </div>

        <div class="modal-section">
          <h4>📦 收件與配送資訊</h4>
          <p><strong>希望送達日期：</strong>{{ selectedOrder.deliveryDate || '未指定' }}</p>
          <p>取件方式：{{ formatDeliveryMethod(selectedOrder.deliveryMethod) }}</p>
          <p>收件人姓名：{{ selectedOrder.recipient?.name }}</p>
          <p>收件人電話：{{ selectedOrder.recipient?.phone }}</p>
          <p>完整地址/門市：{{ getFullAddress(selectedOrder) }}</p>
        </div>

        <div class="modal-section">
          <h4>💐 訂購商品明細</h4>
          <ul>
            <li v-for="(qty, itemKey) in selectedOrder.cart" :key="itemKey">
              商品項 / ID: {{ itemKey }} — 數量：{{ qty }}
            </li>
          </ul>
        </div>

        <button class="btn-close" @click="selectedOrder = null">關閉彈窗</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const orders = ref([]) // 來自 API 的訂單資料
const selectedOrder = ref(null) // 當前彈窗選中的訂單

// 取件方式轉換
const formatDeliveryMethod = (method) => {
  const map = {
    black_cat: '黑貓宅急便',
    store_pickup: '門市自取',
    cvs: '超商取貨'
  }
  return map[method] || method || '未指定'
}

// 地址或超商轉譯
const getFullAddress = (order) => {
  if (order.selectedStore) {
    return `${order.selectedStore.name} (${order.selectedStore.address})`
  }
  const r = order.recipient
  if (r?.city || r?.address) {
    return `${r.city || ''}${r.district || ''}${r.address || ''}`
  }
  return '門市自取 / 無地址'
}

// 時間格式化
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-TW')
}
</script>

<style scoped>
.delivery-highlight {
  background-color: #fef3c7;
  padding: 6px 10px;
  border-radius: 6px;
  display: inline-block;
  margin: 6px 0;
}
.date-tag {
  color: #d97706;
  font-weight: bold;
  font-size: 1.05rem;
}
.btn-detail {
  width: 100%;
  margin: 10px 0;
  padding: 8px;
  background-color: #4a5568;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal-content {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
}
.modal-section {
  margin-bottom: 16px;
}
.btn-close {
  width: 100%;
  padding: 10px;
  background: #e2e8f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>