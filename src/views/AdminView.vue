<template>
  <div class="admin-dashboard">
    <header class="admin-header">
      <h2>🌸 墨凝花室｜訂單管理看板</h2>
      <button class="refresh-btn" @click="fetchOrders">🔄 重新整理</button>
    </header>

    <div v-if="loading" class="loading-state">
      <p>⏳ 載入訂單列表中...</p>
    </div>

    <div v-else-if="orderList.length === 0" class="empty-state">
      <p>目前尚無訂單紀錄。</p>
    </div>

    <div v-else class="order-list">
      <div v-for="order in orderList" :key="order.merchantOrderNo" class="order-admin-card">
        <div class="card-header">
          <span class="order-no">單號：{{ order.merchantOrderNo }}</span>
          <span class="status-tag" :class="order.status">{{ getStatusText(order.status) }}</span>
        </div>

        <div class="card-body">
          <p><strong>購買人：</strong>{{ order.payer?.name || '無名氏' }} ({{ order.payer?.phone || '無電話' }})</p>
          <p><strong>收件人：</strong>{{ order.recipient?.name || '同購買人' }}</p>
          <p><strong>取件方式：</strong>{{ order.deliveryMethod }}</p>
          <p><strong>總金額：</strong><span class="price">NT$ {{ order.totalAmount }}</span></p>
          <p class="order-time">下單時間：{{ new Date(order.createdAt).toLocaleString() }}</p>
        </div>

        <!-- 狀態切換按鈕組 -->
        <div class="status-btn-group">
          <button @click="updateStatus(order.merchantOrderNo, 'accepted')">已接單</button>
          <button @click="updateStatus(order.merchantOrderNo, 'in_production')">製作中</button>
          <button @click="updateStatus(order.merchantOrderNo, 'delivering')">配送中</button>
          <button class="complete-btn" @click="updateStatus(order.merchantOrderNo, 'completed')">
            已完成 (發送LINE通知)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import liff from '@line/liff';

const BACKEND_URL = 'https://moni-atelier-backend.onrender.com'; // 後端網址

const orderList = ref([]);
const loading = ref(true);
const adminUserId = ref('');

// 狀態文字對照表
const STATUS_MAP = {
  PENDING: '未付款',
  PAID: '已付款 / 待處理',
  ordered: '已下單',
  accepted: '已接單',
  in_production: '製作中',
  delivering: '配送中',
  completed: '已完成',
  FAILED: '交易失敗'
};

const getStatusText = (status) => STATUS_MAP[status] || status;

// 1. 向後端讀取訂單列表
const fetchOrders = async () => {
  try {
    loading.value = true;
    const res = await fetch(`${BACKEND_URL}/api/orders`);
    const data = await res.json();
    if (data.status === 'success') {
      orderList.value = data.orders || [];
    }
  } catch (err) {
    console.error('❌ 讀取訂單失敗:', err);
  } finally {
    loading.value = false;
  }
};

// 2. 切換訂單狀態並觸發 LINE 發信/推播 API
const updateStatus = async (orderNo, newStatus) => {
  if (!confirm(`確定要將訂單 ${orderNo} 狀態變更為【${getStatusText(newStatus)}】嗎？`)) {
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/orders/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNo: orderNo,
        status: newStatus,
        adminUserId: adminUserId.value
      })
    });

    const result = await res.json();

    if (result.status === 'success') {
      alert(`✅ 訂單狀態已更新為【${getStatusText(newStatus)}】！`);
      fetchOrders(); // 重新整理列表
    } else {
      alert(`⚠️ 更新失敗：${result.message}`);
    }
  } catch (err) {
    console.error('❌ 更新失敗:', err);
    alert('伺服器連線異常，請稍後再試');
  }
};

onMounted(async () => {
  // 初始化 LIFF 取得管理員個人 User ID 用於權限驗證
  try {
    await liff.init({ liffId: '2010913515-HfcsIAK0' });
    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      adminUserId.value = profile.userId;
    }
  } catch (e) {
    console.warn('LIFF 初始化失敗:', e);
  }

  fetchOrders();
});
</script>

<style scoped>
.admin-dashboard {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: #f8f9fa;
  min-height: 100vh;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 12px;
}

.admin-header h2 {
  font-size: 1.25rem;
  color: #2d3748;
  margin: 0;
}

.refresh-btn {
  background: #edf2f7;
  border: 1px solid #cbd5e0;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.order-admin-card {
  background: #ffffff;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #edf2f7;
}

.order-no {
  font-weight: bold;
  color: #4a5568;
}

.status-tag {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
  background-color: #e2e8f0;
  color: #4a5568;
}

.status-tag.PAID { background-color: #e6fffa; color: #234e52; }
.status-tag.completed { background-color: #c6f6d5; color: #22543d; }

.card-body p {
  margin: 4px 0;
  font-size: 0.95rem;
  color: #4a5568;
}

.price {
  color: #e53e3e;
  font-weight: bold;
}

.order-time {
  font-size: 0.8rem !important;
  color: #a0aec0;
}

.status-btn-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 14px;
}

.status-btn-group button {
  padding: 8px;
  border: 1px solid #cbd5e0;
  background-color: #ffffff;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.status-btn-group button:hover {
  background-color: #edf2f7;
}

.status-btn-group .complete-btn {
  grid-column: span 2;
  background-color: #48bb78;
  color: white;
  border: none;
  font-weight: bold;
}

.status-btn-group .complete-btn:hover {
  background-color: #38a169;
}
</style>