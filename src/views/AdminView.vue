<template>
  <div class="admin-wrapper">
    <div class="admin-header">
      <h2>🌸 墨凝花室 | 訂單管理看板</h2>
      <button class="btn-refresh" @click="fetchOrders">🔄 重新整理</button>
    </div>

    <!-- 載入中狀態 -->
    <div v-if="loading" class="state-msg">
      🌸 正在載入訂單資料中...
    </div>

    <!-- 無訂單狀態 -->
    <div v-else-if="orders.length === 0" class="state-msg">
      目前尚無任何訂單紀錄。
    </div>

    <!-- 訂單列表 -->
    <div v-else class="orders-list">
      <div v-for="order in orders" :key="order.merchantOrderNo" class="order-card">
        <div class="card-header">
          <span class="order-no">單號：{{ order.merchantOrderNo }}</span>
          <span class="status-badge" :class="order.status">{{ formatStatus(order.status) }}</span>
        </div>

        <div class="card-body">
          <p><strong>購買人：</strong>{{ order.payer?.name || '未知' }} ({{ order.payer?.phone || '無電話' }})</p>
          <p><strong>收件人：</strong>{{ order.recipient?.name || order.payer?.name || '未指定' }} ({{ order.recipient?.phone || order.payer?.phone || '無電話' }})</p>
          
          <!-- 🎯 必填亮點：希望送達日期 -->
          <div class="delivery-highlight">
            <strong>📅 送達日期：</strong>
            <span class="date-tag">{{ order.deliveryDate || '未指定' }}</span>
          </div>

          <p><strong>🚚 取件方式：</strong>{{ formatDeliveryMethod(order.deliveryMethod) }}</p>
          <p><strong>💰 總金額：</strong><span class="price">NT$ {{ order.totalAmount?.toLocaleString() }}</span></p>
          <p class="time-text">下單時間：{{ formatDate(order.createdAt) }}</p>

          <!-- 🎯 查看詳細資訊彈窗按鈕 -->
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
    </div>

    <!-- 🎯 完整資訊彈窗 Modal -->
    <div v-if="selectedOrder" class="modal-overlay" @click.self="selectedOrder = null">
      <div class="modal-content">
        <h3>📋 訂單完整細節</h3>
        <p class="modal-order-no">單號：{{ selectedOrder.merchantOrderNo }}</p>
        <hr />

        <div class="modal-section">
          <h4>👤 訂購人資訊</h4>
          <p><strong>姓名：</strong>{{ selectedOrder.payer?.name || '未填寫' }}</p>
          <p><strong>電話：</strong>{{ selectedOrder.payer?.phone || '未填寫' }}</p>
          <p><strong>Email：</strong>{{ selectedOrder.payer?.email || selectedOrder.customerEmail || '未填寫' }}</p>
        </div>

        <div class="modal-section">
          <h4>📦 收件與配送資訊</h4>
          <p><strong>希望送達日期：</strong>{{ selectedOrder.deliveryDate || '未指定' }}</p>
          <p><strong>取件方式：</strong>{{ formatDeliveryMethod(selectedOrder.deliveryMethod) }}</p>
          <p><strong>收件人姓名：</strong>{{ selectedOrder.recipient?.name || selectedOrder.payer?.name }}</p>
          <p><strong>收件人電話：</strong>{{ selectedOrder.recipient?.phone || selectedOrder.payer?.phone }}</p>
          <p><strong>完整地址/門市：</strong>{{ getFullAddress(selectedOrder) }}</p>
        </div>

        <div class="modal-section">
          <h4>💐 訂購商品明細</h4>
          <div class="cart-items-list">
            <template v-if="selectedOrder.cart">
              <p v-for="(qty, itemKey) in selectedOrder.cart" :key="itemKey" class="cart-item-row">
                <span>🌸 商品 ID / 名稱: {{ itemKey }}</span>
                <strong>x {{ qty }}</strong>
              </p>
            </template>
            <p v-else>無商品資料</p>
          </div>
        </div>

        <button class="btn-close" @click="selectedOrder = null">關閉彈窗</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API_BASE_URL = 'https://moni-atelier-backend.onrender.com'

const orders = ref([])
const loading = ref(true)
const selectedOrder = ref(null)

// 抓取後端訂單資料
const fetchOrders = async () => {
  loading.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders`)
    const data = await res.json()
    if (data.status === 'success') {
      orders.value = data.orders || []
    }
  } catch (err) {
    console.error('❌ 抓取訂單失敗:', err)
  } finally {
    loading.value = false
  }
}

// 更新訂單狀態
const updateStatus = async (orderNo, status) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNo, status })
    })
    const data = await res.json()
    if (data.status === 'success') {
      alert(`訂單 ${orderNo} 狀態已更新為：${formatStatus(status)}`)
      fetchOrders()
    } else {
      alert(`更新失敗: ${data.message}`)
    }
  } catch (err) {
    console.error('❌ 更新狀態失敗:', err)
    alert('伺服器連線失敗')
  }
}

// 狀態翻譯
const formatStatus = (status) => {
  const map = {
    PENDING: '待付款',
    PAID: '已付款 / 待處理',
    accepted: '已接單',
    in_production: '製作中',
    delivering: '配送中',
    completed: '已完成'
  }
  return map[status] || status || '未處理'
}

// 取件方式翻譯
const formatDeliveryMethod = (method) => {
  const map = {
    black_cat: '黑貓宅急便',
    store_pickup: '門市自取',
    cvs: '超商取貨'
  }
  return map[method] || method || '未指定'
}

// 地址或門市轉譯
const getFullAddress = (order) => {
  if (order.selectedStore) {
    return `${order.selectedStore.name} (${order.selectedStore.address})`
  }
  const r = order.recipient
  if (r && (r.city || r.address)) {
    return `${r.city || ''}${r.district || ''}${r.address || ''}`
  }
  return '門市自取 / 無地址'
}

// 時間格式化
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-TW')
}

onMounted(() => {
  fetchOrders()
})
</script>

<style scoped>
.admin-wrapper {
  max-width: 900px;
  margin: 30px auto;
  padding: 24px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #333333;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 16px;
  margin-bottom: 20px;
}

.btn-refresh {
  padding: 8px 16px;
  background: #f0f4f8;
  border: 1px solid #d9e2ec;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.state-msg {
  text-align: center;
  padding: 40px;
  color: #666;
}

.order-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  background: #fafafa;
}

.card-header {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  margin-bottom: 12px;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.85rem;
  background: #e2e8f0;
  color: #4a5568;
}

.status-badge.PAID { background: #e6fffa; color: #234e52; }
.status-badge.in_production { background: #feebc8; color: #744210; }
.status-badge.completed { background: #c6f6d5; color: #22543d; }

.delivery-highlight {
  background-color: #fef3c7;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 10px 0;
  display: inline-block;
}

.date-tag {
  color: #d97706;
  font-weight: bold;
  font-size: 1.05rem;
}

.price {
  color: #e53e3e;
  font-weight: bold;
}

.time-text {
  font-size: 0.85rem;
  color: #a0aec0;
  margin-top: 6px;
}

.btn-detail {
  width: 100%;
  margin: 12px 0;
  padding: 10px;
  background-color: #3a4750;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.action-buttons button {
  padding: 8px;
  background: #ffffff;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  cursor: pointer;
}

.btn-complete {
  grid-column: span 3;
  background: #48bb78 !important;
  color: #ffffff !important;
  font-weight: bold;
  border: none !important;
}

/* Modal 彈窗樣式 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  background: #ffffff;
  padding: 24px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-order-no {
  color: #718096;
  font-size: 0.9rem;
  margin-top: -8px;
}

.modal-section {
  margin: 16px 0;
}

.modal-section h4 {
  margin-bottom: 8px;
  color: #2d3748;
}

.cart-item-row {
  display: flex;
  justify-content: space-between;
  background: #f7fafc;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 6px;
}

.btn-close {
  width: 100%;
  padding: 10px;
  background: #e2e8f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 16px;
  font-weight: bold;
}
</style>