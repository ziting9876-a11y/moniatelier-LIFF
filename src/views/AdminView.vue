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
      <button 
        :class="['tab-btn', { active: currentTab === 'users' }]" 
        @click="currentTab = 'users'; fetchUsers()"
      >
        👥 會員紅利管理
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
        <div 
          v-for="order in orders" 
          :key="order.merchantOrderNo" 
          :class="['order-card', { 'is-completed': order.status === 'completed', 'is-cancelled': order.status === 'cancelled' }]"
        >
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
            <p><strong>💰 總金額：</strong><span class="price">NT$ {{ order.totalAmount?.toLocaleString() }}</span> <span v-if="order.usedPoints > 0" class="used-points-tag">(折抵 {{ order.usedPoints }} 點)</span></p>
            <p class="time-text">下單時間：{{ formatDate(order.createdAt) }}</p>

            <button class="btn-detail" @click="selectedOrder = order">
              🔍 查看訂單完整細節與商品明細
            </button>
          </div>

          <!-- 狀態操作按鈕區 -->
          <div class="action-buttons">
            <button :class="{ active: order.status === 'accepted' }" @click="updateStatus(order.merchantOrderNo, 'accepted')">已接單</button>
            <button :class="{ active: order.status === 'in_production' }" @click="updateStatus(order.merchantOrderNo, 'in_production')">製作中</button>
            <button :class="{ active: order.status === 'delivering' }" @click="updateStatus(order.merchantOrderNo, 'delivering')">配送中</button>
            <button class="btn-complete" :class="{ 'is-current': order.status === 'completed' }" @click="updateStatus(order.merchantOrderNo, 'completed')">✓ 已完成 (發送LINE通知)</button>
            <button class="btn-cancel-order" :class="{ 'is-current': order.status === 'cancelled' }" @click="updateStatus(order.merchantOrderNo, 'cancelled')">✕ 已取消訂單</button>
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
            <span v-if="product.isHidden" class="hidden-badge">🔒 隱藏商品</span>
          </div>

          <div class="product-details">
            <span class="cat-tag">{{ product.category }}</span>
            <h4>{{ product.name }}</h4>
            <p class="desc">{{ product.description }}</p>

            <div class="price-box">
              <span class="price-text">NT$ {{ (product.price || product.originalPrice)?.toLocaleString() }}</span>
            </div>
          </div>
          
          <div class="product-actions">
            <button class="btn-edit" @click="openProductModal(product)">✏️ 編輯內容</button>
            <button class="btn-delete" @click="deleteProduct(product._id)">🗑️ 刪除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 3. 👥 會員紅利管理 ==================== -->
    <div v-else-if="currentTab === 'users'" class="tab-content">
      <div class="admin-header">
        <h3>會員清單與紅利管理</h3>
        <button class="btn-refresh" @click="fetchUsers">🔄 重新整理會員列表</button>
      </div>

      <div v-if="loadingUsers" class="state-msg">🌸 正在載入會員資料...</div>
      <div v-else-if="users.length === 0" class="state-msg">目前尚無任何註冊會員紀錄。</div>

      <div v-else class="table-responsive">
        <table class="user-table">
          <thead>
            <tr>
              <th>會員姓名 / 暱稱</th>
              <th>目前紅利點數</th>
              <th>生日月份</th>
              <th>加入時間</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user._id">
              <td>
                <div class="user-name-cell">
                  <strong>{{ user.displayName || '未提供名稱' }}</strong>
                  <span class="sub-id">ID: {{ user.lineUserId }}</span>
                </div>
              </td>
              <td>
                <span class="points-badge-table">🎁 {{ user.points || 0 }} 點</span>
              </td>
              <td>{{ user.birthday || '未填寫' }}</td>
              <td>{{ formatDate(user.createdAt) }}</td>
              <td>
                <button class="btn-adjust-points" @click="openAdjustPointsModal(user)">
                  🎁 手動調整/發放紅利
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 🎯 手動調整會員紅利點數 Modal -->
    <div v-if="selectedUserForPoints" class="modal-overlay" @click.self="selectedUserForPoints = null">
      <div class="modal-content">
        <h3>🎁 手動調整會員紅利點數</h3>
        <p class="modal-order-no">會員：<strong>{{ selectedUserForPoints.displayName }}</strong></p>
        <p class="modal-order-no">目前累積金額/點數：<strong>{{ selectedUserForPoints.points || 0 }} 點</strong></p>
        <hr />

        <div class="form-group">
          <label>調整方式：</label>
          <select v-model="adjustForm.actionType" class="select-input">
            <option value="add">➕ 手動發送 / 贈送紅利點數（增加）</option>
            <option value="subtract">➖ 扣除紅利點數（減少）</option>
            <option value="set">🎯 直接設為特定數值</option>
          </select>
        </div>

        <div class="form-group">
          <label>異動點數數量 ($1點 = $1元)：</label>
          <input type="number" v-model.number="adjustForm.pointsChange" placeholder="請輸入點數，例：100" min="1" />
        </div>

        <div class="modal-actions">
          <button class="btn-save" @click="submitAdjustPoints">💾 確認調整點數</button>
          <button class="btn-cancel" @click="selectedUserForPoints = null">取消</button>
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
          <div class="form-group"><label>編號標籤：</label><input v-model="productForm.badge" placeholder="例：NO.01" /></div>
          <div class="form-group"><label>活動標籤：</label><input v-model="productForm.tag" placeholder="例：熱銷" /></div>
        </div>
        <div class="form-group"><label>商品分類：</label><input v-model="productForm.category" /></div>
        <div class="form-group"><label>商品名稱：</label><input v-model="productForm.name" /></div>
        <div class="form-group"><label>金額 (NT$)：</label><input type="number" v-model="productForm.price" /></div>
        <div class="form-group"><label>圖片網址：</label><input v-model="productForm.imageUrl" /></div>
        <div class="form-group"><label>文案：</label><textarea v-model="productForm.description" rows="3"></textarea></div>
        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="productForm.isHidden" />
            <span>🔒 設定為隱藏商品</span>
          </label>
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

// 訂單 State
const orders = ref([])
const loadingOrders = ref(true)
const selectedOrder = ref(null)

// 商品 State
const products = ref([])
const loadingProducts = ref(true)
const showProductModal = ref(false)
const editingProductId = ref(null)
const productForm = ref({ name: '', category: '', price: null, originalPrice: null, badge: '', tag: '', description: '', imageUrl: '', isHidden: false })

// 會員管理 State
const users = ref([])
const loadingUsers = ref(false)
const selectedUserForPoints = ref(null)
const adjustForm = ref({ pointsChange: 50, actionType: 'add' })

// 取得會員列表
const fetchUsers = async () => {
  loadingUsers.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/users`)
    const data = await res.json()
    if (data.status === 'success') {
      users.value = data.users || []
    }
  } catch (err) {
    console.error('❌ 抓取會員失敗:', err)
  } finally {
    loadingUsers.value = false
  }
}

// 開啟手動調整紅利 Modal
const openAdjustPointsModal = (user) => {
  selectedUserForPoints.value = user
  adjustForm.value = { pointsChange: 50, actionType: 'add' }
}

// 提交手動調整點數
const submitAdjustPoints = async () => {
  if (!selectedUserForPoints.value || !adjustForm.value.pointsChange) {
    alert('請輸入欲調整的點數數量！')
    return
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/adjust-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineUserId: selectedUserForPoints.value.lineUserId,
        pointsChange: adjustForm.value.pointsChange,
        actionType: adjustForm.value.actionType
      })
    })

    const data = await res.json()
    if (data.status === 'success') {
      alert(data.message)
      selectedUserForPoints.value = null
      fetchUsers()
    } else {
      alert(`❌ 更新失敗：${data.message}`)
    }
  } catch (err) {
    alert('系統連線失敗或發生異常')
  }
}

// 取得訂單列表
const fetchOrders = async () => {
  loadingOrders.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders`)
    const data = await res.json()
    if (data.status === 'success') { orders.value = data.orders || [] }
  } catch (err) { console.error('❌ 抓取訂單失敗:', err) }
  finally { loadingOrders.value = false }
}

// 取得商品列表
const fetchProducts = async () => {
  loadingProducts.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/products`)
    const data = await res.json()
    if (data.status === 'success') { products.value = data.products || [] }
  } catch (err) { console.error('❌ 抓取商品失敗:', err) }
  finally { loadingProducts.value = false }
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
  } catch (err) { console.error('❌ 更新狀態失敗:', err) }
}

const openProductModal = (product = null) => {
  if (product) {
    editingProductId.value = product._id
    productForm.value = { ...product, isHidden: product.isHidden || false }
  } else {
    editingProductId.value = null
    productForm.value = { name: '', category: '不凋花 / 永生花', price: null, originalPrice: null, badge: '', tag: '', description: '', imageUrl: '', isHidden: false }
  }
  showProductModal.value = true
}

const saveProduct = async () => {
  if (!productForm.value.name || !productForm.value.imageUrl) { alert('請填寫商品名稱與圖片！'); return }
  const method = editingProductId.value ? 'PUT' : 'POST'
  const url = editingProductId.value ? `${API_BASE_URL}/api/products/${editingProductId.value}` : `${API_BASE_URL}/api/products`
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productForm.value) })
    const data = await res.json()
    if (data.status === 'success') { alert('🌸 商品已成功儲存！'); showProductModal.value = false; fetchProducts() }
  } catch (err) { alert('儲存商品失敗') }
}

const deleteProduct = async (id) => {
  if (!confirm('確定刪除嗎？')) return
  try { await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE' }); fetchProducts() } catch (err) {}
}

const formatStatus = (s) => ({ PENDING: '待付款', PAID: '已付款', accepted: '已接單', in_production: '製作中', delivering: '配送中', completed: '✓ 已完成', cancelled: '✕ 已取消' }[s] || s)
const formatDeliveryMethod = (m) => ({ black_cat: '黑貓宅配', cvs: '超商取貨' }[m] || m || '未指定')
const formatDate = (d) => d ? new Date(d).toLocaleString('zh-TW') : ''
const getFullAddress = (o) => o.selectedStore ? `${o.selectedStore.name} (${o.selectedStore.address})` : (o.recipient?.address || '無地址')

onMounted(() => {
  fetchOrders()
  fetchProducts()
})
</script>

<style scoped>
.admin-wrapper { max-width: 980px; margin: 20px auto; padding: 24px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); font-family: sans-serif; color: #333; }
.brand-header h2 { text-align: center; color: #3a4750; margin-bottom: 20px; }
.tab-navigation { display: flex; gap: 12px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px; }
.tab-btn { padding: 12px 20px; font-size: 0.95rem; font-weight: bold; background: none; border: none; color: #718096; cursor: pointer; border-bottom: 3px solid transparent; }
.tab-btn.active { color: #3a4750; border-bottom-color: #3a4750; }
.admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.btn-refresh, .btn-add { padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; border: none; }
.btn-add { background: #3a4750; color: #fff; }
.btn-refresh { background: #edf2f7; color: #4a5568; border: 1px solid #cbd5e0; }

/* 👥 會員表格樣式 */
.table-responsive { overflow-x: auto; margin-top: 10px; }
.user-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.user-table th, .user-table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; }
.user-table th { background: #f8fafc; color: #4a5568; font-weight: bold; }
.user-name-cell { display: flex; flex-direction: column; }
.sub-id { font-size: 0.75rem; color: #a0aec0; }
.points-badge-table { background: #fef3c7; color: #92400e; font-weight: bold; padding: 4px 10px; border-radius: 12px; display: inline-block; }
.btn-adjust-points { background: #3a4750; color: #ffffff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem; }
.btn-adjust-points:hover { background: #2d3748; }

.select-input { width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; margin-top: 4px; }
.used-points-tag { color: #d97706; font-weight: bold; font-size: 0.85rem; }

/* Modal 樣式 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal-content { background: #fff; padding: 24px; border-radius: 12px; width: 90%; max-width: 480px; max-height: 85vh; overflow-y: auto; color: #333; }
.modal-actions { display: flex; gap: 10px; margin-top: 20px; }
.btn-save { flex: 2; padding: 10px; background: #3a4750; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-cancel { flex: 1; padding: 10px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; }
.btn-close { width: 100%; padding: 10px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; margin-top: 15px; font-weight: bold; }

.order-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px; background: #fafafa; }
.order-card.is-completed { background-color: #f0fff4; border-color: #c6f6d5; }
.order-card.is-cancelled { background-color: #f7fafc; opacity: 0.6; }
.card-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; }
.action-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
.action-buttons button { padding: 6px; background: #fff; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; }
.btn-complete { grid-column: span 3; background: #48bb78 !important; color: #fff !important; font-weight: bold; }
.btn-cancel-order { grid-column: span 3; background: #e2e8f0 !important; color: #718096 !important; }

.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.product-admin-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fafafa; }
.thumb-container { position: relative; width: 100%; height: 160px; }
.product-thumb { width: 100%; height: 100%; object-fit: cover; }
.hidden-badge { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.7); color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; }
.product-actions { display: flex; border-top: 1px solid #e2e8f0; }
.product-actions button { flex: 1; padding: 6px; border: none; cursor: pointer; }
.btn-edit { background: #edf2f7; }
.btn-delete { background: #fed7d7; color: #9b2c2c; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 4px; }
.form-group input, .form-group textarea { width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box; }
</style>