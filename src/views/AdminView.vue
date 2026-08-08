<template>
  <div class="admin-wrapper">
    <!-- 頂部品牌區 -->
    <div class="brand-header">
      <h2>🌸 墨凝花室 | 後台管理系統</h2>
    </div>

    <!-- 頂部 Tab 切換 -->
    <div class="tab-navigation">
      <button 
        :class="['tab-btn', { active: currentTab === 'orders' }]" 
        @click="currentTab = 'orders'"
      >
        📋 訂單管理看板
      </button>
      <button 
        :class="['tab-btn', { active: currentTab === 'products' }]" 
        @click="currentTab = 'products'"
      >
        💐 商品圖文管理
      </button>
    </div>

    <!-- ==================== 1. 訂單管理看板 ==================== -->
    <div v-if="currentTab === 'orders'" class="tab-content">
      <div class="admin-header">
        <h3>訂單狀態列表</h3>
        <button class="btn-refresh" @click="fetchOrders">🔄 重新整理</button>
      </div>

      <div v-if="loadingOrders" class="state-msg">🌸 正在載入訂單資料...</div>
      <div v-else-if="orders.length === 0" class="state-msg">目前尚無任何訂單紀錄。</div>

      <div v-else class="orders-list">
        <div v-for="order in orders" :key="order.merchantOrderNo" class="order-card">
          <div class="card-header">
            <span class="order-no">單號：{{ order.merchantOrderNo }}</span>
            <span class="status-badge" :class="order.status">{{ formatStatus(order.status) }}</span>
          </div>

          <div class="card-body">
            <p><strong>購買人：</strong>{{ order.payer?.name || '未知' }} ({{ order.payer?.phone || '無電話' }})</p>
            <p><strong>收件人：</strong>{{ order.recipient?.name || order.payer?.name || '未指定' }} ({{ order.recipient?.phone || order.payer?.phone || '無電話' }})</p>
            
            <div class="delivery-highlight">
              <strong>📅 送達日期：</strong>
              <span class="date-tag">{{ order.deliveryDate || '未指定' }}</span>
            </div>

            <p><strong>🚚 取件方式：</strong>{{ formatDeliveryMethod(order.deliveryMethod) }}</p>
            <p><strong>💰 總金額：</strong><span class="price">NT$ {{ order.totalAmount?.toLocaleString() }}</span></p>
            <p class="time-text">下單時間：{{ formatDate(order.createdAt) }}</p>

            <button class="btn-detail" @click="selectedOrder = order">
              🔍 查看訂單完整細節與商品明細
            </button>
          </div>

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
    </div>

    <!-- ==================== 2. 商品內容管理 ==================== -->
    <div v-else-if="currentTab === 'products'" class="tab-content">
      <div class="admin-header">
        <h3>精選花藝作品列表</h3>
        <button class="btn-add" @click="openProductModal()">➕ 新增花藝作品</button>
      </div>

      <div v-if="loadingProducts" class="state-msg">🌸 正在載入商品資料...</div>
      <div v-else-if="products.length === 0" class="state-msg">目前尚未建立任何商品，請點選右上角新增。</div>

      <div v-else class="products-grid">
        <div v-for="product in products" :key="product._id" class="product-admin-card">
          <div class="thumb-container">
            <img :src="product.imageUrl" :alt="product.name" class="product-thumb" />
            <span v-if="product.badge" class="badge-tag">{{ product.badge }}</span>
            <span v-if="product.tag" class="hot-tag">{{ product.tag }}</span>
          </div>

          <div class="product-details">
            <span class="cat-tag">{{ product.category }}</span>
            <h4>{{ product.name }}</h4>
            <p class="desc">{{ product.description }}</p>

            <div class="price-box">
              <span v-if="product.originalPrice" class="old-price">原價 NT$ {{ product.originalPrice?.toLocaleString() }}</span>
              <span class="price-text">優惠價 NT$ {{ product.price?.toLocaleString() }}</span>
            </div>
          </div>
          
          <div class="product-actions">
            <button class="btn-edit" @click="openProductModal(product)">✏️ 編輯內容</button>
            <button class="btn-delete" @click="deleteProduct(product._id)">🗑️ 刪除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 🎯 訂單詳細資訊彈窗 Modal -->
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
        <button class="btn-close" @click="selectedOrder = null">關閉彈窗</button>
      </div>
    </div>

    <!-- 🎯 商品新增 / 編輯彈窗 Modal -->
    <div v-if="showProductModal" class="modal-overlay" @click.self="showProductModal = false">
      <div class="modal-content">
        <h3>{{ editingProductId ? '✏️ 編輯花藝作品' : '➕ 新增花藝作品' }}</h3>
        <hr />

        <div class="form-row">
          <div class="form-group">
            <label>編號標籤 (左上角)：</label>
            <input v-model="productForm.badge" placeholder="例：NO.01" />
          </div>
          <div class="form-group">
            <label>活動標籤 (圖片下方)：</label>
            <input v-model="productForm.tag" placeholder="例：七夕情人節最熱賣" />
          </div>
        </div>

        <div class="form-group">
          <label>商品分類：</label>
          <input v-model="productForm.category" placeholder="例：不凋花 / 永生花" />
        </div>

        <div class="form-group">
          <label>商品名稱：</label>
          <input v-model="productForm.name" placeholder="例：紅玫瑰花束【恆溫。時光淬煉的誓約】" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>原價 (NT$)：</label>
            <input type="number" v-model="productForm.originalPrice" placeholder="例：2680 (無優惠可留空)" />
          </div>
          <div class="form-group">
            <label>優惠價 (NT$)：</label>
            <input type="number" v-model="productForm.price" placeholder="例：2680 (無優惠可留空)" />
          </div>
        </div>

        <div class="form-group">
          <label>圖片網址 (URL)：</label>
          <input v-model="productForm.imageUrl" placeholder="貼上圖片連結（Imgur / ImgBB / Cloudinary）" />
          <img v-if="productForm.imageUrl" :src="productForm.imageUrl" class="img-preview" />
        </div>

        <div class="form-group">
          <label>商品文案 / 描述：</label>
          <textarea v-model="productForm.description" rows="3" placeholder="請輸入作品特色文案..."></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-save" @click="saveProduct">💾 儲存並發布</button>
          <button class="btn-cancel" @click="showProductModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API_BASE_URL = 'https://moni-atelier-backend.onrender.com'

const currentTab = ref('orders')

// 訂單相關 State
const orders = ref([])
const loadingOrders = ref(true)
const selectedOrder = ref(null)

// 商品相關 State
const products = ref([])
const loadingProducts = ref(true)
const showProductModal = ref(false)
const editingProductId = ref(null)
const productForm = ref({
  name: '',
  category: '不凋花 / 永生花',
  price: 1880,
  originalPrice: 2680,
  badge: 'NO.01',
  tag: '七夕情人節最熱賣',
  description: '',
  imageUrl: ''
})

// 取得訂單列表
const fetchOrders = async () => {
  loadingOrders.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders`)
    const data = await res.json()
    if (data.status === 'success') {
      orders.value = data.orders || []
    }
  } catch (err) {
    console.error('❌ 抓取訂單失敗:', err)
  } finally {
    loadingOrders.value = false
  }
}

// 取得商品列表
const fetchProducts = async () => {
  loadingProducts.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/products`)
    const data = await res.json()
    if (data.status === 'success') {
      products.value = data.products || []
    }
  } catch (err) {
    console.error('❌ 抓取商品失敗:', err)
  } finally {
    loadingProducts.value = false
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
    }
  } catch (err) {
    console.error('❌ 更新狀態失敗:', err)
  }
}

// 開啟商品 Modal
const openProductModal = (product = null) => {
  if (product) {
    editingProductId.value = product._id
    productForm.value = { ...product }
  } else {
    editingProductId.value = null
    productForm.value = {
      name: '',
      category: '不凋花 / 永生花',
      price: 1880,
      originalPrice: null,
      badge: '',
      tag: '',
      description: '',
      imageUrl: ''
    }
  }
  showProductModal.value = true
}

// 儲存商品
const saveProduct = async () => {
  if (!productForm.value.name || !productForm.value.imageUrl) {
    alert('請填寫商品名稱與圖片網址！')
    return
  }

  const method = editingProductId.value ? 'PUT' : 'POST'
  const url = editingProductId.value 
    ? `${API_BASE_URL}/api/products/${editingProductId.value}`
    : `${API_BASE_URL}/api/products`

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productForm.value)
    })
    const data = await res.json()
    if (data.status === 'success') {
      alert('🌸 商品已成功儲存並發布！')
      showProductModal.value = false
      fetchProducts()
    }
  } catch (err) {
    console.error('❌ 儲存商品失敗:', err)
  }
}

// 刪除商品
const deleteProduct = async (id) => {
  if (!confirm('確定要刪除這項花藝作品嗎？')) return
  try {
    await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE' })
    fetchProducts()
  } catch (err) {
    console.error('❌ 刪除商品失敗:', err)
  }
}

// 格式轉換工具
const formatStatus = (s) => ({ PENDING: '待付款', PAID: '已付款 / 待處理', accepted: '已接單', in_production: '製作中', delivering: '配送中', completed: '已完成' }[s] || s)
const formatDeliveryMethod = (m) => ({ black_cat: '黑貓宅急便', store_pickup: '門市自取', cvs: '超商取貨' }[m] || m || '未指定')
const formatDate = (d) => d ? new Date(d).toLocaleString('zh-TW') : ''
const getFullAddress = (o) => o.selectedStore ? `${o.selectedStore.name} (${o.selectedStore.address})` : (o.recipient?.address || '門市自取 / 無地址')

onMounted(() => {
  fetchOrders()
  fetchProducts()
})
</script>

<style scoped>
.admin-wrapper {
  max-width: 950px;
  margin: 20px auto;
  padding: 24px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #333333;
}

.brand-header h2 {
  text-align: center;
  color: #3a4750;
  margin-bottom: 20px;
}

.tab-navigation {
  display: flex;
  gap: 12px;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 24px;
}

.tab-btn {
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: bold;
  background: none;
  border: none;
  color: #718096;
  cursor: pointer;
  border-bottom: 3px solid transparent;
}

.tab-btn.active {
  color: #3a4750;
  border-bottom-color: #3a4750;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.btn-refresh, .btn-add {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  border: none;
}

.btn-add { background: #3a4750; color: #fff; }
.btn-refresh { background: #edf2f7; color: #4a5568; border: 1px solid #cbd5e0; }

.state-msg {
  text-align: center;
  padding: 40px;
  color: #666;
}

/* 🎯 訂單卡片樣式 */
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
  align-items: center;
  font-weight: bold;
  margin-bottom: 12px;
}

.order-no {
  font-size: 1.05rem;
  color: #2d3748;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: bold;
  background: #e2e8f0;
  color: #4a5568;
}

.status-badge.PAID { background: #feebc8; color: #744210; }
.status-badge.in_production { background: #feebc8; color: #744210; }
.status-badge.completed { background: #c6f6d5; color: #22543d; }

.card-body p {
  margin: 6px 0;
  color: #4a5568;
}

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
  font-weight: 500;
  color: #4a5568;
}

.btn-complete {
  grid-column: span 3;
  background: #48bb78 !important;
  color: #ffffff !important;
  font-weight: bold;
  border: none !important;
}

/* 🎯 商品網格與預覽卡片樣式 */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.product-admin-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  background: #fafafa;
  display: flex;
  flex-direction: column;
}

.thumb-container {
  position: relative;
  width: 100%;
  height: 180px;
}

.product-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-tag {
  position: absolute;
  top: 8px;
  left: 8px;
  background: #ffffff;
  color: #4a5568;
  font-size: 0.75rem;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.hot-tag {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  color: #8b5e4c;
  font-size: 0.75rem;
  font-weight: bold;
  padding: 4px 12px;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  white-space: nowrap;
}

.product-details {
  padding: 12px;
  flex: 1;
}

.cat-tag {
  font-size: 0.75rem;
  color: #a0aec0;
}

.product-details h4 {
  margin: 4px 0 8px 0;
  color: #2d3748;
}

.desc {
  font-size: 0.85rem;
  color: #718096;
  line-height: 1.4;
  height: 40px;
  overflow: hidden;
}

.price-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
}

.old-price {
  font-size: 0.8rem;
  color: #a0aec0;
  text-decoration: line-through;
}

.price-text {
  font-weight: bold;
  color: #e53e3e;
}

.product-actions {
  display: flex;
  border-top: 1px solid #e2e8f0;
}

.product-actions button {
  flex: 1;
  padding: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-edit { background: #edf2f7; color: #2d3748; }
.btn-delete { background: #fed7d7; color: #9b2c2c; }

/* 🎯 表單 Modal 樣式 */
.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 4px;
  color: #4a5568;
}

.form-group input, .form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  box-sizing: border-box;
}

.img-preview {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 6px;
  margin-top: 8px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-save { flex: 2; padding: 10px; background: #3a4750; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.btn-cancel { flex: 1; padding: 10px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; }

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 85vh;
  overflow-y: auto;
}
</style>