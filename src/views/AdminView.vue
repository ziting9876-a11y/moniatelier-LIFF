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
          :class="['order-card', { 'is-completed': order.status === 'completed', 'is-cancelled': order.status === 'cancelled' || order.status === 'refunded' }]"
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
            <button class="btn-refund" :class="{ 'is-current': order.status === 'refunded' }" @click="updateStatus(order.merchantOrderNo, 'refunded')">↩ 已退款</button>
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
            <span 
              v-if="product.badge" 
              class="badge-tag" 
              :style="getBadgeStyle(product, 'badge')"
            >
              {{ product.badge }}
            </span>
            <span 
              v-if="product.tag" 
              class="hot-tag" 
              :style="getBadgeStyle(product, 'tag')"
            >
              {{ product.tag }}
            </span>
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
          
          <!-- 一鍵複製 LINE 導購連結按鈕 -->
          <div class="copy-link-wrapper">
            <button class="btn-copy-link" @click="copyDirectPayLink(product)">
              🔗 複製 LINE 導購結帳連結
            </button>
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
              <th>生日日期</th>
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
                <div class="action-cell-btns">
                  <button class="btn-view-member" @click="openMemberDetailModal(user)">
                    🔍 查看完整資料
                  </button>
                  <button class="btn-adjust-points" @click="openAdjustPointsModal(user)">
                    🎁 調整紅利
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 🎯 會員完整資料與歷史訂單 Modal -->
    <div v-if="selectedMemberDetail" class="modal-overlay" @click.self="selectedMemberDetail = null">
      <div class="modal-content member-detail-modal">
        <div class="modal-header-flex">
          <h3>🌸 會員完整資料</h3>
          <button class="close-icon-btn" @click="selectedMemberDetail = null">✕</button>
        </div>
        <hr />

        <div class="member-profile-card">
          <img :src="selectedMemberDetail.pictureUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'" class="modal-avatar" />
          <div class="modal-user-meta">
            <h4>{{ selectedMemberDetail.displayName || '未提供名稱' }}</h4>
            <span class="badge-vip">👑 MONI VIP 會員</span>
          </div>
        </div>

        <div class="detail-info-box">
          <p><strong>LINE User ID：</strong><code>{{ selectedMemberDetail.lineUserId }}</code></p>
          <p><strong>目前紅利點數：</strong>🎁 <span class="highlight-pts">{{ selectedMemberDetail.points || 0 }} 點</span></p>
          <p><strong>完整生日日期：</strong>🎂 {{ selectedMemberDetail.birthday || '未登記' }}</p>
          <p><strong>電子信箱：</strong>📧 {{ selectedMemberDetail.email || '未填寫' }}</p>
          <p><strong>加入時間：</strong>📅 {{ formatDate(selectedMemberDetail.createdAt) }}</p>
          <p><strong>推薦人 (referredBy)：</strong>🔗 {{ selectedMemberDetail.referredBy || '無 (自行加入)' }}</p>
        </div>

        <h4 class="sub-title">📦 該會員歷史訂單紀錄 ({{ getMemberOrders(selectedMemberDetail).length }} 筆)</h4>
        <div class="member-orders-container">
          <div v-if="getMemberOrders(selectedMemberDetail).length === 0" class="no-order-text">
            此會員尚無下單紀錄。
          </div>
          <div v-else class="admin-sub-order-list">
            <div v-for="ord in getMemberOrders(selectedMemberDetail)" :key="ord.merchantOrderNo" class="admin-sub-order-item">
              <div class="sub-order-top">
                <span><strong>單號：</strong>{{ ord.merchantOrderNo }}</span>
                <span class="status-tag-sm" :class="ord.status">{{ formatStatus(ord.status) }}</span>
              </div>
              <p>📅 送達日：{{ ord.deliveryDate || '未指定' }} | 🚚 {{ formatDeliveryMethod(ord.deliveryMethod) }}</p>
              <p>💰 金額：<strong>NT$ {{ ord.totalAmount?.toLocaleString() }}</strong> <span v-if="ord.usedPoints > 0">(折抵 {{ ord.usedPoints }} 點)</span></p>
            </div>
          </div>
        </div>

        <button class="btn-close" @click="selectedMemberDetail = null">關閉視窗</button>
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
        <div class="form-row" style="display: flex; gap: 10px;">
          <div class="form-group" style="flex: 1;"><label>編號標籤：</label><input v-model="productForm.badge" placeholder="例：TOP.01" /></div>
          <div class="form-group" style="flex: 1;"><label>活動標籤：</label><input v-model="productForm.tag" placeholder="例：七夕花禮" /></div>
        </div>

        <!-- 🌸 自訂標籤樣式設定區塊 -->
        <div class="style-config-box">
          <h4 class="config-title">🎨 標籤外觀自訂</h4>
          <div class="form-row" style="display: flex; gap: 10px;">
            <div class="form-group" style="flex: 1;">
              <label>編號字體顏色：</label>
              <input type="color" v-model="productForm.badgeTextColor" class="color-picker" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label>活動字體顏色：</label>
              <input type="color" v-model="productForm.tagTextColor" class="color-picker" />
            </div>
          </div>
          <div class="form-row" style="display: flex; gap: 10px; align-items: center;">
            <div class="form-group" style="flex: 1;">
              <label>標籤背景顏色：</label>
              <input type="color" v-model="productForm.badgeBgColor" class="color-picker" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label>背景不透明度 ({{ productForm.badgeOpacity }}%)：</label>
              <input type="range" v-model.number="productForm.badgeOpacity" min="0" max="100" class="range-slider" />
            </div>
          </div>
        </div>

        <div class="form-group"><label>商品分類：</label><input v-model="productForm.category" /></div>
        <div class="form-group"><label>商品名稱：</label><input v-model="productForm.name" /></div>
        <div class="form-group"><label>金額 (NT$)：</label><input type="number" v-model="productForm.price" /></div>
        <div class="form-group"><label>圖片網址：</label><input v-model="productForm.imageUrl" /></div>
        <div class="form-group"><label>PicSee 短網址 (選填)：</label><input v-model="productForm.shortUrl" placeholder="例：https://pse.is/xxxxx" /></div>
        <div class="form-group"><label>文案：</label><textarea v-model="productForm.description" rows="3"></textarea></div>
        <div class="form-group checkbox-group">
          <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
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
const LIFF_ID = '2010913515-HfcsIAK0'

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
const defaultProductForm = { 
  name: '', 
  category: '不凋花 / 永生花', 
  price: null, 
  originalPrice: null, 
  badge: '', 
  tag: '', 
  description: '', 
  imageUrl: '', 
  shortUrl: '', 
  isHidden: false,
  badgeTextColor: '#34444E',
  tagTextColor: '#34444E',
  badgeBgColor: '#ffffff',
  badgeOpacity: 100
}
const productForm = ref({ ...defaultProductForm })

// 會員管理 State
const users = ref([])
const loadingUsers = ref(false)
const selectedUserForPoints = ref(null)
const selectedMemberDetail = ref(null) // 🌸 會員完整資料 Modal 控制
const adjustForm = ref({ pointsChange: 50, actionType: 'add' })

// 🎨 動態計算標籤 Inline Style（顏色與透明度）
const getBadgeStyle = (product, type) => {
  const textColor = type === 'badge' ? (product.badgeTextColor || '#34444E') : (product.tagTextColor || '#34444E')
  const bgColor = product.badgeBgColor || '#ffffff'
  const opacity = (product.badgeOpacity !== undefined ? product.badgeOpacity : 100) / 100

  let r = 255, g = 255, b = 255
  if (bgColor.startsWith('#') && bgColor.length === 7) {
    r = parseInt(bgColor.slice(1, 3), 16)
    g = parseInt(bgColor.slice(3, 5), 16)
    b = parseInt(bgColor.slice(5, 7), 16)
  }

  return {
    color: textColor,
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
}

// 🔗 複製一鍵導購連結至剪貼簿（優先複製 PicSee 短網址）
const copyDirectPayLink = (product) => {
  if (!product) return
  const rawLiffLink = `https://liff.line.me/${LIFF_ID}?add=${product._id || product.id}`
  const copyTarget = (product.shortUrl && product.shortUrl.trim()) ? product.shortUrl.trim() : rawLiffLink

  fallbackCopyText(copyTarget)
}

const fallbackCopyText = (text) => {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  try {
    document.execCommand('copy')
    alert(`✅ 已成功複製 LINE 導購結帳連結！可直接貼給顧客：\n${text}`)
  } catch (err) {
    alert(`複製失敗，請手動複製以下網址：\n${text}`)
  }
  document.body.removeChild(textArea)
}

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

// 🌸 開啟會員完整資料 Modal
const openMemberDetailModal = (user) => {
  selectedMemberDetail.value = user
}

// 🌸 篩選該會員的歷史訂單
const getMemberOrders = (user) => {
  if (!user || !orders.value.length) return []
  return orders.value.filter(o => 
    o.lineUserId === user.lineUserId || 
    (o.payer?.email && o.payer.email === user.email)
  )
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
    productForm.value = { 
      ...defaultProductForm,
      ...product, 
      shortUrl: product.shortUrl || '', 
      isHidden: product.isHidden || false,
      badgeTextColor: product.badgeTextColor || '#34444E',
      tagTextColor: product.tagTextColor || '#34444E',
      badgeBgColor: product.badgeBgColor || '#ffffff',
      badgeOpacity: product.badgeOpacity !== undefined ? product.badgeOpacity : 100
    }
  } else {
    editingProductId.value = null
    productForm.value = { ...defaultProductForm }
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

const formatStatus = (s) => ({ PENDING: '待付款', PAID: '已付款', accepted: '已接單', in_production: '製作中', delivering: '配送中', completed: '✓ 已完成', refunded: '↩ 已退款', cancelled: '✕ 已取消' }[s] || s)
const formatDeliveryMethod = (m) => ({ black_cat: '黑貓宅配', express_taipei_1: '專人雙北配送1', express_taipei_2: '專人雙北配送2', cvs: '超商取貨', seven_eleven: '7-11店到店', familymart: '全家店到店' }[m] || m || '未指定')
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

.action-cell-btns { display: flex; gap: 8px; align-items: center; }
.btn-view-member { background: #3182ce; color: #ffffff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem; }
.btn-view-member:hover { background: #2b6cb0; }
.btn-adjust-points { background: #3a4750; color: #ffffff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem; }
.btn-adjust-points:hover { background: #2d3748; }

/* 🌸 會員完整資料 Modal 樣式 */
.member-detail-modal { max-width: 540px !important; }
.modal-header-flex { display: flex; justify-content: space-between; align-items: center; }
.close-icon-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #718096; }
.member-profile-card { display: flex; align-items: center; gap: 14px; background: #f8fafc; padding: 14px; border-radius: 10px; margin: 12px 0; }
.modal-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #3a4750; }
.modal-user-meta h4 { margin: 0 0 4px 0; font-size: 1.1rem; color: #2d3748; }
.badge-vip { background: #edf2f7; color: #b7791f; font-size: 0.75rem; font-weight: bold; padding: 2px 8px; border-radius: 10px; }
.detail-info-box { background: #faf9f6; padding: 14px; border-radius: 8px; font-size: 0.88rem; line-height: 1.6; color: #4a5568; }
.detail-info-box code { background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: #2d3748; }
.highlight-pts { color: #d97706; font-weight: bold; font-size: 1.05rem; }
.sub-title { margin: 16px 0 8px 0; font-size: 0.95rem; color: #3a4750; }
.member-orders-container { max-height: 180px; overflow-y: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
.no-order-text { text-align: center; color: #a0aec0; padding: 16px; font-size: 0.85rem; }
.admin-sub-order-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 8px; font-size: 0.82rem; }
.sub-order-top { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px; }
.status-tag-sm { padding: 1px 6px; border-radius: 8px; font-size: 0.7rem; }
.status-tag-sm.completed { background: #c6f6d5; color: #22543d; }
.status-tag-sm.PAID { background: #ebf8ff; color: #2b6cb0; }
.status-tag-sm.PENDING { background: #feebc8; color: #744210; }

.select-input { width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; margin-top: 4px; }
.used-points-tag { color: #d97706; font-weight: bold; font-size: 0.85rem; }

/* Modal 樣式 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal-content { background: #fff; padding: 24px; border-radius: 12px; width: 90%; max-width: 480px; max-height: 85vh; overflow-y: auto; color: #333; }
.modal-actions { display: flex; gap: 10px; margin-top: 20px; }
.btn-save { flex: 2; padding: 10px; background: #3a4750; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-cancel { flex: 1; padding: 10px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; }
.btn-close { width: 100%; padding: 10px; background: #e2e8f0; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px; font-weight: bold; }

.order-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px; background: #fafafa; }
.order-card.is-completed { background-color: #f0fff4; border-color: #c6f6d5; }
.order-card.is-cancelled { background-color: #f7fafc; opacity: 0.6; }
.card-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; }
.action-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
.action-buttons button { padding: 6px; background: #fff; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; }
.btn-complete { grid-column: span 3; background: #48bb78 !important; color: #fff !important; font-weight: bold; }
.btn-refund { grid-column: span 3; background: #ed8936 !important; color: #fff !important; font-weight: bold; }
.btn-cancel-order { grid-column: span 3; background: #e2e8f0 !important; color: #718096 !important; }

/* 🌸 商品列表與標籤樣式 */
.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.product-admin-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fafafa; display: flex; flex-direction: column; position: relative; }
.thumb-container { position: relative; width: 100%; height: 180px; background: #34444e; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.product-thumb { width: 100%; height: 100%; object-fit: contain; }

.badge-tag { position: absolute; top: 8px; left: 8px; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 2; }

/* 🌸 活動標籤定位至右下角 */
.hot-tag { position: absolute; bottom: 8px; right: 8px; padding: 2px 10px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); white-space: nowrap; z-index: 2; }

.hidden-badge { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; z-index: 2; }

.product-details { padding: 12px; flex-grow: 1; display: flex; flex-direction: column; gap: 4px; }
.cat-tag { font-size: 0.75rem; color: #718096; font-weight: bold; }
.product-details h4 { margin: 4px 0; font-size: 0.95rem; color: #2d3748; line-height: 1.4; }
.product-details .desc { font-size: 0.8rem; color: #718096; line-height: 1.4; height: 36px; overflow: hidden; margin-bottom: 6px; }
.price-box { margin-top: auto; font-weight: bold; color: #8b5e4c; font-size: 0.95rem; }

.copy-link-wrapper { padding: 0 10px 10px; }
.btn-copy-link { width: 100%; background: #34444e; color: #ffffff; border: none; padding: 8px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: background 0.2s; }
.btn-copy-link:hover { background: #243b53; }

.product-actions { display: flex; border-top: 1px solid #e2e8f0; }
.product-actions button { flex: 1; padding: 8px; border: none; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
.btn-edit { background: #edf2f7; color: #2d3748; }
.btn-delete { background: #fed7d7; color: #9b2c2c; }

/* 🎨 樣式自訂區塊樣式 */
.style-config-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.config-title { margin: 0 0 10px 0; font-size: 0.9rem; color: #34444E; }
.color-picker { width: 100%; height: 36px; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; padding: 2px; }
.range-slider { width: 100%; cursor: pointer; }

.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 4px; }
.form-group input[type="text"], .form-group input[type="number"], .form-group textarea { width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box; }
</style>