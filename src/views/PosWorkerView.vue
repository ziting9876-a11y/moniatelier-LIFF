<template>
  <div class="pos-app">
    <!-- 頂部狀態列：員工資訊、即時時間、打卡狀態 -->
    <header class="pos-topbar">
      <div class="brand">
        <span class="logo-icon">🌸</span>
        <div>
          <h2>墨凝花室 | 花藝工作台 & POS</h2>
          <span class="sub-text">工作進度排程與現場快速收銀</span>
        </div>
      </div>

      <div class="clock-badge">
        {{ currentTime }}
      </div>

      <div class="staff-control">
        <label for="staff-select">值班人員：</label>
        <select id="staff-select" v-model="currentStaff">
          <option value="花藝師-宜萱">花藝師 - 宜萱</option>
          <option value="花藝師-子庭">花藝師 - 子庭</option>
          <option value="實習花藝助理">實習花藝助理</option>
        </select>
        <button 
          :class="['btn-punch', { clocked: isClockedIn }]" 
          @click="toggleClock"
        >
          {{ isClockedIn ? '🟢 已簽到打卡 (下班)' : '⚪ 上班簽到' }}
        </button>
      </div>
    </header>

    <!-- 導航分頁 -->
    <nav class="pos-nav">
      <button 
        :class="['nav-btn', { active: activeTab === 'schedule' }]" 
        @click="activeTab = 'schedule'"
      >
        📅 製作排程與工單
      </button>
      <button 
        :class="['nav-btn', { active: activeTab === 'pos' }]" 
        @click="activeTab = 'pos'"
      >
        💐 門市 POS 收銀開單
      </button>
    </nav>

    <!-- ==================== 1. 製作排程與工單看板 ==================== -->
    <main v-if="activeTab === 'schedule'" class="tab-panel schedule-panel">
      <div class="schedule-header">
        <div class="date-filter">
          <label>排程日期：</label>
          <input type="date" v-model="selectedScheduleDate" @change="filterSchedule" />
          <button class="btn-today" @click="setToday">今日出貨</button>
        </div>
        <button class="btn-refresh" @click="fetchScheduleOrders">🔄 重新整理</button>
      </div>

      <div v-if="loadingOrders" class="loading-state">🌸 正在載入花藝排程工單...</div>
      <div v-else-if="scheduledOrders.length === 0" class="empty-state">
        所選日期目前無待製作或配送之花禮訂單。
      </div>

      <div v-else class="order-grid">
        <div 
          v-for="order in scheduledOrders" 
          :key="order.order_no || order.id" 
          :class="['order-card', order.status]"
        >
          <div class="card-top">
            <span class="order-id">單號：{{ order.order_no }}</span>
            <span class="status-chip" :class="order.status">{{ formatStatus(order.status) }}</span>
          </div>

          <div class="card-info">
            <p class="delivery-time">
              🕒 <strong>希望時段：</strong>{{ order.delivery_time_slot || '不指定' }}
            </p>
            <p><strong>取件方式：</strong>{{ formatDeliveryMethod(order.delivery_method) }}</p>
            <p><strong>收件人：</strong>{{ order.recipient_name }} ({{ order.recipient_phone }})</p>
            <p class="addr-text"><strong>地址：</strong>{{ order.recipient_address }}</p>

            <div v-if="order.card_message" class="card-msg-box">
              <strong>💌 卡片心意：</strong>
              <p>{{ order.card_message }}</p>
            </div>

            <p class="staff-record">
              <strong>製作人員：</strong>{{ order.crafted_by || '尚未指派' }}
            </p>
          </div>

          <div class="card-actions">
            <button 
              class="btn-flow" 
              :disabled="order.status === 'in_production'" 
              @click="updateOrderStatus(order.order_no, 'in_production')"
            >
              ✂️ 開始製作
            </button>
            <button 
              class="btn-flow" 
              :disabled="order.status === 'delivering'" 
              @click="updateOrderStatus(order.order_no, 'delivering')"
            >
              🚚 包裝出貨
            </button>
            <button 
              class="btn-flow done" 
              :disabled="order.status === 'completed'" 
              @click="updateOrderStatus(order.order_no, 'completed')"
            >
              ✅ 完成交件
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- ==================== 2. 門市 POS 快速收銀開單 ==================== -->
    <main v-else-if="activeTab === 'pos'" class="tab-panel pos-panel">
      <!-- 左側：商品點選區 -->
      <section class="products-section">
        <div class="category-tabs">
          <button 
            v-for="cat in categories" 
            :key="cat" 
            :class="['cat-btn', { active: selectedCat === cat }]" 
            @click="selectedCat = cat"
          >
            {{ cat }}
          </button>
        </div>

        <div class="pos-grid">
          <div 
            v-for="item in filteredProducts" 
            :key="item.id" 
            class="product-tile" 
            @click="addToCart(item)"
          >
            <img :src="item.image_url" :alt="item.title" class="tile-img" />
            <div class="tile-body">
              <span class="tile-name">{{ item.title }}</span>
              <span class="tile-price">NT$ {{ Number(item.price).toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 右側：購物籃與會員結帳區 -->
      <aside class="checkout-aside">
        <!-- LINE 會員掃描/查詢 -->
        <div class="member-search-box">
          <h4>👤 LINE 會員核銷與折抵</h4>
          <div class="input-row">
            <input 
              type="text" 
              v-model="memberKeyword" 
              placeholder="請輸入 LINE ID 或掃描條碼" 
              @keyup.enter="searchMember"
            />
            <button class="btn-search" @click="searchMember">搜尋</button>
          </div>

          <div v-if="currentMember" class="member-info-card">
            <p><strong>顧客姓名：</strong>{{ currentMember.displayName || '會員顧客' }}</p>
            <p><strong>現有紅利：</strong><span class="pts-text">{{ currentMember.points || 0 }} 點</span></p>
            <div class="points-redeem">
              <label>折抵點數：</label>
              <input 
                type="number" 
                v-model.number="pointsToUse" 
                :max="currentMember.points" 
                min="0" 
              />
              <button class="btn-all-in" @click="pointsToUse = currentMember.points">全折</button>
            </div>
          </div>
        </div>

        <!-- 購物車清單 -->
        <div class="cart-list">
          <h4>🛒 結帳明細 ({{ cart.length }} 件)</h4>
          <div v-if="cart.length === 0" class="empty-cart">尚未選入商品</div>
          <div v-for="(item, idx) in cart" :key="idx" class="cart-row">
            <div class="item-title">{{ item.title }}</div>
            <div class="item-calc">
              <button class="qty-btn" @click="updateQty(idx, -1)">-</button>
              <span>{{ item.qty }}</span>
              <button class="qty-btn" @click="updateQty(idx, 1)">+</button>
              <span class="row-price">NT$ {{ (item.price * item.qty).toLocaleString() }}</span>
              <button class="btn-del" @click="cart.splice(idx, 1)">✕</button>
            </div>
          </div>
        </div>

        <!-- 結帳金額計算與付款 -->
        <div class="checkout-footer">
          <div class="calc-row">
            <span>小計</span>
            <span>NT$ {{ subtotal.toLocaleString() }}</span>
          </div>
          <div v-if="pointsToUse > 0" class="calc-row discount">
            <span>紅利折抵</span>
            <span>- NT$ {{ pointsToUse.toLocaleString() }}</span>
          </div>
          <div class="calc-row total">
            <span>實收金額</span>
            <span class="highlight">NT$ {{ finalAmount.toLocaleString() }}</span>
          </div>

          <div class="payment-methods">
            <label>付款方式：</label>
            <div class="method-options">
              <button 
                :class="['pay-btn', { active: paymentMethod === 'cash' }]" 
                @click="paymentMethod = 'cash'"
              >
                💵 現金
              </button>
              <button 
                :class="['pay-btn', { active: paymentMethod === 'linepay' }]" 
                @click="paymentMethod = 'linepay'"
              >
                🟢 LINE Pay
              </button>
              <button 
                :class="['pay-btn', { active: paymentMethod === 'transfer' }]" 
                @click="paymentMethod = 'transfer'"
              >
                🏦 轉帳
              </button>
            </div>
          </div>

          <button 
            class="btn-checkout" 
            :disabled="cart.length === 0 || isSubmitting" 
            @click="submitPosOrder"
          >
            {{ isSubmitting ? '處理中...' : `確認結帳 (收銀員: ${currentStaff})` }}
          </button>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const API_BASE_URL = 'https://moni-atelier-backend.onrender.com'

// 員工與狀態管理
const currentStaff = ref('花藝師-宜萱')
const isClockedIn = ref(false)
const currentTime = ref('')
let timer = null

const updateClock = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-TW', { hour12: false })
}

const toggleClock = () => {
  isClockedIn.value = !isClockedIn.value
  const act = isClockedIn.value ? '上班打卡' : '下班簽退'
  alert(`[考勤記錄] ${currentStaff.value} 於 ${currentTime.value} 完成 ${act}`)
}

// 導航控制
const activeTab = ref('schedule')

// 排程資料
const selectedScheduleDate = ref(new Date().toISOString().slice(0, 10))
const scheduledOrders = ref([])
const loadingOrders = ref(false)

const setToday = () => {
  selectedScheduleDate.value = new Date().toISOString().slice(0, 10)
  fetchScheduleOrders()
}

const fetchScheduleOrders = async () => {
  loadingOrders.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders`)
    const data = await res.json()
    if (data.success) {
      scheduledOrders.value = (data.data || []).filter(o => 
        (o.delivery_date || o.deliveryDate || '').startsWith(selectedScheduleDate.value)
      )
    }
  } catch (err) {
    console.error('抓取排程失敗:', err)
  } finally {
    loadingOrders.value = false
  }
}

const updateOrderStatus = async (orderNo, status) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNo,
        status,
        craftedBy: currentStaff.value
      })
    })
    const data = await res.json()
    if (data.success || data.status === 'success') {
      alert(`訂單 ${orderNo} 狀態已更新為：${formatStatus(status)}（處理花藝師：${currentStaff.value}）`)
      fetchScheduleOrders()
    }
  } catch (err) {
    alert('更新訂單狀態失敗')
  }
}

// POS 現場收銀
const categories = ['全部', '永生花系列', '鮮花花束', '周邊加購']
const selectedCat = ref('全部')
const products = ref([])

const fetchProducts = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/products`)
    const data = await res.json()
    if (data.status === 'success' || data.products) {
      products.value = (data.products || []).map(p => ({
        id: p._id || p.id,
        title: p.name || p.title,
        price: p.price,
        category: p.category || '永生花系列',
        image_url: p.imageUrl || p.image_url
      }))
    }
  } catch (err) {
    console.error('抓取商品失敗:', err)
  }
}

const filteredProducts = computed(() => {
  if (selectedCat.value === '全部') return products.value
  return products.value.filter(p => p.category.includes(selectedCat.value.replace('系列', '')))
})

// 購物車
const cart = ref([])
const addToCart = (item) => {
  const found = cart.value.find(i => i.id === item.id)
  if (found) {
    found.qty += 1
  } else {
    cart.value.push({ ...item, qty: 1 })
  }
}

const updateQty = (idx, delta) => {
  cart.value[idx].qty += delta
  if (cart.value[idx].qty <= 0) {
    cart.value.splice(idx, 1)
  }
}

const subtotal = computed(() => {
  return cart.value.reduce((acc, item) => acc + item.price * item.qty, 0)
})

// LINE 會員與點數折抵
const memberKeyword = ref('')
const currentMember = ref(null)
const pointsToUse = ref(0)

const searchMember = async () => {
  if (!memberKeyword.value.trim()) return
  try {
    const res = await fetch(`${API_BASE_URL}/api/users`)
    const data = await res.json()
    if (data.status === 'success') {
      const target = (data.users || []).find(u => 
        u.lineUserId === memberKeyword.value.trim() || 
        u.displayName?.includes(memberKeyword.value.trim())
      )
      if (target) {
        currentMember.value = target
        pointsToUse.value = 0
      } else {
        alert('查無該會員資料')
      }
    }
  } catch (err) {
    alert('查詢會員失敗')
  }
}

const finalAmount = computed(() => {
  return Math.max(0, subtotal.value - pointsToUse.value)
})

const paymentMethod = ref('cash')
const isSubmitting = ref(false)

const submitPosOrder = async () => {
  if (cart.value.length === 0) return
  isSubmitting.value = true

  const payload = {
    totalAmount: finalAmount.value,
    subtotal: subtotal.value,
    usedPoints: pointsToUse.value,
    lineUserId: currentMember.value?.lineUserId || null,
    deliveryMethod: 'store_pickup',
    deliveryDate: new Date().toISOString().slice(0, 10),
    recipient: {
      name: currentMember.value?.displayName || '現場顧客',
      phone: '現場結帳'
    },
    cashierStaff: currentStaff.value,
    paymentMethod: paymentMethod.value
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (data.status === 'success' || data.success) {
      alert(`🎉 結帳成功！實收 NT$ ${finalAmount.value.toLocaleString()}（收銀員：${currentStaff.value}）`)
      cart.value = []
      currentMember.value = null
      pointsToUse.value = 0
      memberKeyword.value = ''
    } else {
      alert('結帳建單失敗')
    }
  } catch (err) {
    alert('結帳連線失敗')
  } finally {
    isSubmitting.value = false
  }
}

// 格式化輔助
const formatStatus = (s) => ({
  PENDING: '待付款',
  PENDING_PAYMENT: '待付款',
  PAID: '已付款',
  accepted: '已接單',
  in_production: '製作中',
  delivering: '配送中',
  completed: '已完成'
}[s] || s)

const formatDeliveryMethod = (m) => ({
  black_cat: '黑貓宅配',
  express_taipei_1: '專人雙北配送',
  store_pickup: '門市自取',
  cvs: '超商取貨'
}[m] || m || '門市取件')

onMounted(() => {
  updateClock()
  timer = setInterval(updateClock, 1000)
  fetchScheduleOrders()
  fetchProducts()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.pos-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f7fafc;
  color: #2d3748;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.pos-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #2d3748;
  color: #fff;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand h2 {
  font-size: 1.1rem;
  margin: 0;
}
.sub-text {
  font-size: 0.75rem;
  color: #cbd5e0;
}
.clock-badge {
  font-size: 1.2rem;
  font-weight: bold;
  letter-spacing: 1px;
}
.staff-control {
  display: flex;
  align-items: center;
  gap: 8px;
}
.staff-control select {
  padding: 5px;
  border-radius: 4px;
}
.btn-punch {
  padding: 6px 12px;
  background: #4a5568;
  border: 1px solid #718096;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
}
.btn-punch.clocked {
  background: #2f855a;
}

.pos-nav {
  display: flex;
  background: #fff;
  border-bottom: 2px solid #e2e8f0;
}
.nav-btn {
  padding: 12px 24px;
  border: none;
  background: none;
  font-size: 0.95rem;
  font-weight: bold;
  color: #718096;
  cursor: pointer;
  border-bottom: 3px solid transparent;
}
.nav-btn.active {
  color: #2d3748;
  border-bottom-color: #8b5e4c;
}

.tab-panel {
  flex: 1;
  overflow: hidden;
  padding: 16px;
}

/* 排程看版樣式 */
.schedule-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.btn-today, .btn-refresh {
  padding: 6px 12px;
  margin-left: 8px;
  cursor: pointer;
}
.order-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
.order-card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 14px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}
.order-card.in_production {
  border-left: 5px solid #dd6b20;
}
.order-card.delivering {
  border-left: 5px solid #3182ce;
}
.order-card.completed {
  border-left: 5px solid #38a169;
  opacity: 0.75;
}
.card-top {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  margin-bottom: 8px;
}
.card-msg-box {
  background: #fffaf0;
  border: 1px dashed #dd6b20;
  padding: 6px;
  border-radius: 4px;
  margin: 6px 0;
  font-size: 0.85rem;
}
.card-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.btn-flow {
  flex: 1;
  padding: 6px;
  font-size: 0.8rem;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  cursor: pointer;
}

/* POS 介面樣式 */
.pos-panel {
  display: flex;
  gap: 16px;
  height: calc(100vh - 120px);
}
.products-section {
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}
.category-tabs {
  display: flex;
  gap: 8px;
}
.cat-btn {
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid #cbd5e0;
  background: #fff;
  cursor: pointer;
}
.cat-btn.active {
  background: #8b5e4c;
  color: #fff;
}
.pos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.product-tile {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}
.tile-img {
  width: 100%;
  height: 100px;
  object-fit: cover;
}
.tile-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
}
.tile-price {
  color: #8b5e4c;
  font-weight: bold;
}

.checkout-aside {
  flex: 2;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  padding: 12px;
}
.member-search-box {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 10px;
}
.input-row {
  display: flex;
  gap: 6px;
}
.input-row input {
  flex: 1;
  padding: 6px;
}
.member-info-card {
  background: #f7fafc;
  padding: 8px;
  border-radius: 4px;
  margin-top: 6px;
  font-size: 0.85rem;
}
.pts-text {
  color: #dd6b20;
  font-weight: bold;
}
.points-redeem input {
  width: 70px;
}
.cart-list {
  flex: 1;
  overflow-y: auto;
  margin: 10px 0;
}
.cart-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #edf2f7;
}
.qty-btn {
  padding: 2px 6px;
}
.btn-del {
  border: none;
  background: none;
  color: #e53e3e;
  cursor: pointer;
}
.checkout-footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 10px;
}
.calc-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.calc-row.total {
  font-size: 1.1rem;
  font-weight: bold;
}
.calc-row.total .highlight {
  color: #8b5e4c;
}
.method-options {
  display: flex;
  gap: 6px;
  margin: 6px 0;
}
.pay-btn {
  flex: 1;
  padding: 6px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.pay-btn.active {
  background: #2d3748;
  color: #fff;
}
.btn-checkout {
  width: 100%;
  padding: 12px;
  background: #8b5e4c;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
}
.btn-checkout:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
}
</style>