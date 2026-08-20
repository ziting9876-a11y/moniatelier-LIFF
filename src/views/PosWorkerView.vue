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
          :disabled="isPunching"
        >
          {{ isPunching ? '處理中...' : (isClockedIn ? '🟢 已簽到打卡 (下班)' : '⚪ 上班簽到') }}
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
      <button 
        :class="['nav-btn', { active: activeTab === 'reports' }]" 
        @click="activeTab = 'reports'"
      >
        📊 業績營收報表
      </button>
    </nav>

    <!-- ==================== 1. 製作排程與工單看板 ==================== -->
    <main v-if="activeTab === 'schedule'" class="tab-panel schedule-panel">
      <!-- 今日急單警示區 -->
      <section v-if="urgentOrders.length > 0" class="urgent-banner">
        <div class="urgent-title">
          <span>🔥 今日最急待辦清單 ({{ urgentOrders.length }} 筆)</span>
          <small>排定今日配送且尚未出貨</small>
        </div>
        <div class="urgent-cards">
          <div v-for="order in urgentOrders" :key="order.order_no || order.id" class="urgent-card">
            <div class="urgent-card-head">
              <strong>單號：{{ order.order_no }}</strong>
              <span class="chip-slot">🕒 {{ order.delivery_time_slot || '今日全天' }}</span>
            </div>
            <p class="urgent-detail"><strong>收件人：</strong>{{ order.recipient_name }} | {{ formatDeliveryMethod(order.delivery_method) }}</p>
            <div class="urgent-actions">
              <button 
                class="btn-flow in-prod"
                :disabled="order.status === 'in_production'"
                @click="updateOrderStatus(order.order_no, 'in_production')"
              >
                ✂️ 製作中
              </button>
              <button 
                class="btn-flow finish"
                @click="updateOrderStatus(order.order_no, 'delivering')"
              >
                🚚 出貨
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="schedule-header">
        <div class="date-filter">
          <label>排程日期：</label>
          <input type="date" v-model="selectedScheduleDate" @change="fetchScheduleOrders" />
          <button class="btn-today" @click="setToday">今日排程</button>
        </div>
        <button class="btn-refresh" @click="fetchScheduleOrders">🔄 重新整理</button>
      </div>

      <div v-if="loadingOrders" class="loading-state">🌸 正在載入花藝排程工單...</div>
      <div v-else-if="scheduledOrders.length === 0" class="empty-state">
        所選日期目前無排程之花禮訂單。
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
            <p class="addr-text"><strong>地址：</strong>{{ order.recipient_address || '-' }}</p>

            <div v-if="order.card_message" class="card-msg-box">
              <strong>💌 卡片心意：</strong>
              <p>{{ order.card_message }}</p>
            </div>

            <p class="staff-record">
              <strong>經手人員：</strong>{{ order.cashier_name || '未指派' }}
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

      <!-- 右側：購物籃與收銀結帳區 -->
      <aside class="checkout-aside">
        <!-- LINE 會員核銷與折抵 -->
        <div class="member-search-box">
          <h4>👤 LINE 會員核銷與折抵</h4>
          <div class="input-row">
            <input 
              type="text" 
              v-model="memberKeyword" 
              placeholder="輸入姓名、LINE ID 或手機號碼" 
              @keyup.enter="searchMember"
            />
            <button class="btn-search" @click="searchMember">查詢</button>
          </div>

          <div v-if="currentMember" class="member-info-card">
            <div class="member-head">
              <span><strong>顧客：</strong>{{ currentMember.displayName || currentMember.name || 'LINE會員' }}</span>
              <button class="btn-clear-mem" @click="clearMember">✕ 取消</button>
            </div>
            <p><strong>現有紅利：</strong><span class="pts-text">{{ currentMember.points || 0 }} 點</span></p>
            <div class="points-redeem">
              <label>折抵點數：</label>
              <input 
                type="number" 
                v-model.number="pointsToUse" 
                :max="Math.min(currentMember.points || 0, subtotal)" 
                min="0" 
              />
              <button class="btn-all-in" @click="pointsToUse = Math.min(currentMember.points || 0, subtotal)">全折</button>
            </div>
          </div>
        </div>

        <!-- 購物車清單 -->
        <div class="cart-list">
          <h4>🛒 結帳明細 ({{ cart.reduce((acc, i) => acc + i.qty, 0) }} 件)</h4>
          <div v-if="cart.length === 0" class="empty-cart">尚未選入商品，請點選左側商品加入</div>
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

        <!-- 配送方式與顧客資料填寫表單 -->
        <div class="customer-form-section">
          <h4>📦 配送與收件人資訊</h4>
          <div class="form-row">
            <label>配送方式 *：</label>
            <select v-model="deliveryMethod">
              <option value="store_pickup">門市自取 (運費 NT$ 0)</option>
              <option value="black_cat">黑貓宅配 (運費 NT$300 / 滿 NT$4,500 免運)</option>
              <option value="express_taipei_1">專人雙北配送1 (9:00-18:00不指定 / 運費 NT$300 / 滿 NT$4,500 免運)</option>
              <option value="express_taipei_2">專人雙北配送2 (9:00-18:00不指定 / 運費 NT$500 / 滿 NT$4,500 免運)</option>
              <option value="cvs_familymart">全家店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
              <option value="cvs_711">7-11店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
            </select>
          </div>

          <!-- 雙北配送區域防呆提示框 -->
          <div v-if="deliveryMethod === 'express_taipei_1'" class="region-tip-box">
            <strong>📍 專人雙北配送 1 可送區域：</strong>
            <p>松山區、信義區、大安區、中山區、中正區、大同區、萬華區、文山區、南港區、內湖區、士林區、北投區、板橋區、三重區、中和區、永和區、汐止區。</p>
          </div>

          <div v-if="deliveryMethod === 'express_taipei_2'" class="region-tip-box">
            <strong>📍 專人雙北配送 2 可送區域：</strong>
            <p>新莊區、新店區、土城區、蘆洲區、樹林區、淡水區、林口區。</p>
          </div>

          <div class="form-row-2col">
            <input type="text" v-model="customerName" placeholder="顧客/收件人姓名 *" />
            <input type="text" v-model="customerPhone" placeholder="聯絡電話 *" />
          </div>

          <div v-if="deliveryMethod !== 'store_pickup'" class="form-row">
            <input type="text" v-model="customerAddress" placeholder="收件地址 / 超商門市名稱 *" />
          </div>

          <div class="form-row">
            <textarea v-model="cardMessage" placeholder="代寫卡片留言內容 (選填)" rows="2"></textarea>
          </div>
        </div>

        <!-- 金額結算與付款方式 -->
        <div class="checkout-footer">
          <div class="calc-row">
            <span>商品小計</span>
            <span>NT$ {{ subtotal.toLocaleString() }}</span>
          </div>
          <div class="calc-row">
            <span>運費 {{ subtotal >= 4500 && deliveryMethod !== 'store_pickup' ? '(滿額免運)' : '' }}</span>
            <span>NT$ {{ shippingFee.toLocaleString() }}</span>
          </div>
          <div v-if="pointsToUse > 0" class="calc-row discount">
            <span>紅利折抵</span>
            <span>- NT$ {{ pointsToUse.toLocaleString() }}</span>
          </div>
          <div class="calc-row total">
            <span>應收總額</span>
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
              <button 
                :class="['pay-btn', { active: paymentMethod === 'credit_card' }]" 
                @click="paymentMethod = 'credit_card'"
              >
                💳 刷卡
              </button>
            </div>
          </div>

          <button 
            class="btn-checkout" 
            :disabled="cart.length === 0 || isSubmitting" 
            @click="submitPosOrder"
          >
            {{ isSubmitting ? '開單中...' : `開單結帳 (收銀: ${currentStaff})` }}
          </button>
        </div>
      </aside>
    </main>

    <!-- ==================== 3. 業績營收報表 (權限保護) ==================== -->
    <main v-else-if="activeTab === 'reports'" class="tab-panel reports-panel">
      <div v-if="!isReportAuthorized" class="auth-lock-card">
        <h3>🔒 業績報表存取驗證</h3>
        <p>此區塊包含門市營業數據，請輸入管理密碼解鎖：</p>
        <div class="auth-input-group">
          <input 
            type="password" 
            v-model="adminKeyInput" 
            placeholder="請輸入密碼 (預設: moni888)" 
            @keyup.enter="verifyAdminKey"
          />
          <button class="btn-auth" @click="verifyAdminKey">解鎖查看</button>
        </div>
      </div>

      <div v-else class="report-content">
        <div class="report-topbar">
          <h3>📊 門市營收分析與日/週/月報表</h3>
          <button class="btn-refresh" @click="fetchReportData">🔄 更新數據</button>
        </div>

        <div class="stats-cards-grid">
          <div class="stat-card">
            <span class="stat-label">今日營收</span>
            <span class="stat-num">NT$ {{ reportStats.todayRevenue.toLocaleString() }}</span>
            <small>{{ reportStats.todayOrders }} 筆訂單</small>
          </div>
          <div class="stat-card">
            <span class="stat-label">本週累計營收</span>
            <span class="stat-num">NT$ {{ reportStats.weekRevenue.toLocaleString() }}</span>
            <small>{{ reportStats.weekOrders }} 筆訂單</small>
          </div>
          <div class="stat-card">
            <span class="stat-label">本月累計營收</span>
            <span class="stat-num">NT$ {{ reportStats.monthRevenue.toLocaleString() }}</span>
            <small>{{ reportStats.monthOrders }} 筆訂單</small>
          </div>
        </div>

        <div class="report-table-box">
          <h4>門市最新 20 筆結帳與出貨明細</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>訂單編號</th>
                <th>建立時間</th>
                <th>收件顧客</th>
                <th>配送方式</th>
                <th>付款方式</th>
                <th>經手人員</th>
                <th>金額</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in allOrdersList.slice(0, 20)" :key="order.order_no || order.id">
                <td>{{ order.order_no }}</td>
                <td>{{ new Date(order.created_at || Date.now()).toLocaleDateString() }}</td>
                <td>{{ order.recipient_name }}</td>
                <td>{{ formatDeliveryMethod(order.delivery_method) }}</td>
                <td>{{ order.payment_method || '未註明' }}</td>
                <td>{{ order.cashier_name || '-' }}</td>
                <td>NT$ {{ Number(order.final_amount || order.total_amount || 0).toLocaleString() }}</td>
                <td><span class="status-chip" :class="order.status">{{ formatStatus(order.status) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'

// 員工與狀態管理
const currentStaff = ref('花藝師-宜萱')
const isClockedIn = ref(false)
const isPunching = ref(false)
const currentTime = ref('')
let timer = null

const updateClock = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-TW', { hour12: false })
}

const toggleClock = async () => {
  isPunching.value = true
  const nextAction = isClockedIn.value ? 'clock_out' : 'clock_in'
  const actionText = isClockedIn.value ? '下班簽退' : '上班簽到'
  
  try {
    const { error } = await supabase.from('staff_attendance').insert([
      {
        staff_name: currentStaff.value,
        action: nextAction,
        created_at: new Date().toISOString()
      }
    ])
    if (error) throw error
    isClockedIn.value = !isClockedIn.value
    alert(`✅ [打卡成功] ${currentStaff.value} 於 ${currentTime.value} 完成 ${actionText}`)
  } catch (err) {
    console.error('考勤打卡失敗:', err)
    alert('打卡寫入失敗，請確認網路連線或稍後再試')
  } finally {
    isPunching.value = false
  }
}

// 導航控制
const activeTab = ref('schedule')

// 排程與訂單
const selectedScheduleDate = ref(new Date().toISOString().slice(0, 10))
const allOrdersList = ref([])
const loadingOrders = ref(false)

const setToday = () => {
  selectedScheduleDate.value = new Date().toISOString().slice(0, 10)
  fetchScheduleOrders()
}

const fetchScheduleOrders = async () => {
  loadingOrders.value = true
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    allOrdersList.value = data || []
  } catch (err) {
    console.error('抓取訂單失敗:', err)
  } finally {
    loadingOrders.value = false
  }
}

const scheduledOrders = computed(() => {
  return allOrdersList.value.filter(o => 
    (o.delivery_date || '').startsWith(selectedScheduleDate.value)
  )
})

const urgentOrders = computed(() => {
  const todayStr = new Date().toISOString().slice(0, 10)
  return allOrdersList.value.filter(o => 
    (o.delivery_date || '').startsWith(todayStr) &&
    o.status !== 'completed' &&
    o.status !== 'delivering'
  )
})

const updateOrderStatus = async (orderNo, status) => {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: status, cashier_name: currentStaff.value })
      .eq('order_no', orderNo)

    if (error) throw error
    alert(`訂單 ${orderNo} 狀態已更新為：${formatStatus(status)}`)
    fetchScheduleOrders()
  } catch (err) {
    alert('更新訂單狀態失敗')
  }
}

// POS 商品選購
const categories = ['全部', '永生花', '鮮花', '加購']
const selectedCat = ref('全部')
const products = ref([])

const fetchProducts = async () => {
  try {
    const { data, error } = await supabase.from('products').select('*')
    if (error) throw error
    products.value = data || []
  } catch (err) {
    console.error('抓取商品失敗:', err)
  }
}

const filteredProducts = computed(() => {
  if (selectedCat.value === '全部') return products.value
  return products.value.filter(p => (p.category || '').includes(selectedCat.value))
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
  return cart.value.reduce((acc, item) => acc + Number(item.price) * item.qty, 0)
})

// 顧客資料與配送運費計算
const deliveryMethod = ref('store_pickup')
const customerName = ref('')
const customerPhone = ref('')
const customerAddress = ref('')
const cardMessage = ref('')

const shippingFee = computed(() => {
  if (deliveryMethod.value === 'store_pickup') return 0
  // 滿 NT$ 4,500 免運
  if (subtotal.value >= 4500) return 0

  switch (deliveryMethod.value) {
    case 'express_taipei_2':
      return 500
    case 'express_taipei_1':
    case 'black_cat':
    case 'cvs_familymart':
    case 'cvs_711':
      return 300
    default:
      return 0
  }
})

// LINE 會員與點數折抵
const memberKeyword = ref('')
const currentMember = ref(null)
const pointsToUse = ref(0)

const searchMember = async () => {
  if (!memberKeyword.value.trim()) return
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .or(`name.ilike.%${memberKeyword.value}%,phone.ilike.%${memberKeyword.value}%,line_user_id.ilike.%${memberKeyword.value}%`)
      .limit(1)

    if (error) throw error
    if (data && data.length > 0) {
      currentMember.value = data[0]
      customerName.value = data[0].name || ''
      customerPhone.value = data[0].phone || ''
      pointsToUse.value = 0
    } else {
      alert('查無符合之 LINE 會員')
    }
  } catch (err) {
    console.error('查詢會員失敗:', err)
    alert('查詢會員失敗')
  }
}

const clearMember = () => {
  currentMember.value = null
  pointsToUse.value = 0
}

const finalAmount = computed(() => {
  const total = subtotal.value + shippingFee.value - pointsToUse.value
  return Math.max(0, total)
})

const paymentMethod = ref('cash')
const isSubmitting = ref(false)

const submitPosOrder = async () => {
  if (cart.value.length === 0) return
  if (!customerName.value || !customerPhone.value) {
    alert('請填寫顧客姓名與聯絡電話')
    return
  }

  isSubmitting.value = true
  const generatedOrderNo = 'POS' + Date.now().toString().slice(-8)

  const orderPayload = {
    order_no: generatedOrderNo,
    total_amount: subtotal.value + shippingFee.value,
    discount_amount: pointsToUse.value,
    final_amount: finalAmount.value,
    delivery_method: deliveryMethod.value,
    delivery_date: new Date().toISOString().slice(0, 10),
    recipient_name: customerName.value,
    recipient_phone: customerPhone.value,
    recipient_address: customerAddress.value,
    card_message: cardMessage.value,
    status: 'PAID',
    cashier_name: currentStaff.value,
    payment_method: paymentMethod.value,
    shipping_fee: shippingFee.value,
    line_user_id: currentMember.value?.line_user_id || null,
    recipient_info: {
      name: customerName.value,
      phone: customerPhone.value,
      address: customerAddress.value
    }
  }

  try {
    const { error } = await supabase.from('orders').insert([orderPayload])
    if (error) throw error

    // 若有折抵紅利，同步扣除會員資料表的點數
    if (currentMember.value && pointsToUse.value > 0) {
      const remainingPoints = (currentMember.value.points || 0) - pointsToUse.value
      await supabase
        .from('members')
        .update({ points: Math.max(0, remainingPoints) })
        .eq('id', currentMember.value.id)
    }

    alert(`🎉 結帳成功！單號：${generatedOrderNo}，實收 NT$ ${finalAmount.value.toLocaleString()}`)
    
    // 清空購物車與表單
    cart.value = []
    customerName.value = ''
    customerPhone.value = ''
    customerAddress.value = ''
    cardMessage.value = ''
    clearMember()
    memberKeyword.value = ''
    fetchScheduleOrders()
  } catch (err) {
    console.error('POS 開單失敗:', err)
    alert('結帳建單失敗，請檢查資料庫連線')
  } finally {
    isSubmitting.value = false
  }
}

// 報表與權限驗證
const adminKeyInput = ref('')
const isReportAuthorized = ref(false)

const verifyAdminKey = () => {
  if (adminKeyInput.value === 'moni888') {
    isReportAuthorized.value = true
  } else {
    alert('管理密碼錯誤')
  }
}

const reportStats = computed(() => {
  const todayStr = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().slice(0, 10)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  let todayRev = 0, todayCount = 0
  let weekRev = 0, weekCount = 0
  let monthRev = 0, monthCount = 0

  allOrdersList.value.forEach(o => {
    const d = (o.created_at || '').slice(0, 10)
    const amt = Number(o.final_amount || o.total_amount || 0)
    if (d === todayStr) {
      todayRev += amt
      todayCount += 1
    }
    if (d >= startOfWeek) {
      weekRev += amt
      weekCount += 1
    }
    if (d >= startOfMonth) {
      monthRev += amt
      monthCount += 1
    }
  })

  return {
    todayRevenue: todayRev,
    todayOrders: todayCount,
    weekRevenue: weekRev,
    weekOrders: weekCount,
    monthRevenue: monthRev,
    monthOrders: monthCount
  }
})

const fetchReportData = () => {
  fetchScheduleOrders()
}

// 格式化輔助
const formatStatus = (s) => ({
  PENDING: '待付款',
  PENDING_PAYMENT: '待付款',
  PAID: '已付款',
  in_production: '製作中',
  delivering: '配送中',
  completed: '已完成'
}[s] || s)

const formatDeliveryMethod = (m) => ({
  black_cat: '黑貓宅配',
  express_taipei_1: '專人雙北配送1',
  express_taipei_2: '專人雙北配送2',
  store_pickup: '門市自取',
  cvs_familymart: '全家店到店',
  cvs_711: '7-11店到店'
}[m] || m || '門市自取')

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
.urgent-banner {
  background: #fff5f5;
  border: 1px solid #feb2b2;
  border-radius: 8px;
  padding: 12px;
}
.urgent-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #c53030;
  font-weight: bold;
  margin-bottom: 8px;
}
.urgent-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.urgent-card {
  background: #fff;
  border: 1px solid #fed7d7;
  padding: 10px;
  border-radius: 6px;
}
.urgent-card-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}
.chip-slot {
  background: #feebc8;
  color: #c05621;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
}
.urgent-detail {
  font-size: 0.85rem;
  margin: 6px 0;
}
.urgent-actions {
  display: flex;
  gap: 6px;
}
.urgent-actions button {
  flex: 1;
  padding: 4px;
  font-size: 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  cursor: pointer;
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
.status-chip {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  background: #edf2f7;
}
.status-chip.PAID { background: #c6f6d5; color: #22543d; }
.status-chip.in_production { background: #feebc8; color: #7b341e; }
.status-chip.delivering { background: #bee3f8; color: #2c5282; }

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
  overflow-y: auto;
}
.member-search-box {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}
.input-row {
  display: flex;
  gap: 6px;
}
.input-row input {
  flex: 1;
  padding: 6px;
}
.btn-search {
  padding: 6px 12px;
  background: #4a5568;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.member-info-card {
  background: #f7fafc;
  padding: 8px;
  border-radius: 4px;
  margin-top: 6px;
  font-size: 0.85rem;
}
.member-head {
  display: flex;
  justify-content: space-between;
}
.btn-clear-mem {
  border: none;
  background: none;
  color: #e53e3e;
  cursor: pointer;
}
.pts-text {
  color: #dd6b20;
  font-weight: bold;
}
.points-redeem input {
  width: 70px;
  margin-right: 6px;
}

.cart-list {
  max-height: 160px;
  overflow-y: auto;
  margin: 8px 0;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}
.cart-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
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

.customer-form-section {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.customer-form-section h4 {
  margin: 0 0 6px 0;
}
.form-row {
  margin-bottom: 6px;
}
.form-row select, .form-row input, .form-row textarea {
  width: 100%;
  padding: 6px;
  box-sizing: border-box;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
}
.form-row-2col {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.form-row-2col input {
  flex: 1;
  padding: 6px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
}

/* 雙北配送區域提示框 */
.region-tip-box {
  background-color: #fefcbf;
  border: 1px solid #ecc94b;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #744210;
}
.region-tip-box strong {
  display: block;
  margin-bottom: 2px;
}
.region-tip-box p {
  margin: 0;
}

.checkout-footer {
  padding-top: 4px;
}
.calc-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
  font-size: 0.9rem;
}
.calc-row.total {
  font-size: 1.1rem;
  font-weight: bold;
  margin-top: 4px;
}
.calc-row.total .highlight {
  color: #8b5e4c;
}
.method-options {
  display: flex;
  gap: 4px;
  margin: 6px 0;
}
.pay-btn {
  flex: 1;
  padding: 6px 2px;
  font-size: 0.8rem;
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
  padding: 10px;
  background: #8b5e4c;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  margin-top: 6px;
}
.btn-checkout:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
}

/* 業績報表樣式 */
.reports-panel {
  overflow-y: auto;
}
.auth-lock-card {
  max-width: 400px;
  margin: 60px auto;
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  text-align: center;
}
.auth-input-group {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.auth-input-group input {
  flex: 1;
  padding: 8px;
}
.btn-auth {
  padding: 8px 16px;
  background: #8b5e4c;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.report-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.stats-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  font-size: 0.9rem;
  color: #718096;
}
.stat-num {
  font-size: 1.5rem;
  font-weight: bold;
  color: #8b5e4c;
}
.report-table-box {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.report-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 0.85rem;
}
.report-table th, .report-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #edf2f7;
}
.report-table th {
  background: #f7fafc;
  color: #4a5568;
}
</style>