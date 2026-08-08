<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
// @ts-ignore
import { useCartStore } from '../stores/cart'
import liff from '@line/liff'

// --- 🎯 型別宣告 ---
interface Product {
  id: number | string
  _id?: string
  name: string
  category: string
  price: number
  originalPrice?: number | null
  badge?: string
  tag?: string
  description: string
  image?: string
  imageUrl?: string
  isHidden?: boolean
}

// --- 🎯 LINE LIFF 設定 ---
const LIFF_ID = '2010913515-HfcsIAK0'
const lineProfile = ref<{ userId: string; displayName: string; pictureUrl?: string } | null>(null)

// --- 🎯 會員紅利點數與系統 State ---
const userPoints = ref(0)
const usedPointsInput = ref(0)
const userBirthday = ref('')
const showBirthdayModal = ref(false)
const showReferralInfoModal = ref(false)
const isCopyReferralSuccess = ref(false)

// --- 🎯 API 後端基礎網址設定 ---
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://moni-atelier-backend.onrender.com').replace(/\/$/, '')

const route = useRoute()
const cartStore = useCartStore()

// --- 🎯 步驟切換控制 ---
const currentStep = ref(1)

// --- 🎯 快捷購物車 Drawer 控制 ---
const showCartDrawer = ref(false)

// --- 🎯 商品詳情 Modal 控制 ---
const selectedProductDetail = ref<Product | null>(null)
const openProductDetail = (product: Product) => { selectedProductDetail.value = product }
const closeProductDetail = () => { selectedProductDetail.value = null }

// --- 🎯 購物須知與條款 Modal 控制 ---
const showPolicyModal = ref(false)
const hasAgreedPolicy = ref(false)

const openPolicyModal = () => {
  if (cartTotalPrice.value === 0) { alert('請先選擇至少一項商品！'); return }
  if (!orderForm.value.deliveryDate) { alert('請選擇希望送達日期！'); return }

  const isStoreDelivery = ['seven_eleven', 'familymart'].includes(orderForm.value.deliveryMethod)
  if (isStoreDelivery && (!storeInput.value.name.trim() || !storeInput.value.address.trim())) {
    alert('請填寫完整取件超商門市名稱與門市地址！')
    return
  }

  if (!orderForm.value.payer.name || !orderForm.value.payer.phone || !orderForm.value.payer.email) {
    alert('請完整填寫付款人資訊！')
    return
  }

  showPolicyModal.value = true
}

// 📅 日期與月曆控制
const minDeliveryDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 5)
  d.setHours(0, 0, 0, 0)
  return d
})

const minDeliveryDateStr = computed(() => {
  const d = minDeliveryDate.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const maxDeliveryDate = computed(() => {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  d.setHours(23, 59, 59, 999)
  return d
})

const showDatePickerModal = ref(false)
const calendarViewDate = ref(new Date())

const openCalendar = () => {
  calendarViewDate.value = orderForm.value.deliveryDate ? new Date(orderForm.value.deliveryDate) : new Date(minDeliveryDate.value)
  showDatePickerModal.value = true
}

const changeMonth = (offset: number) => {
  const newDate = new Date(calendarViewDate.value)
  newDate.setMonth(newDate.getMonth() + offset)
  const now = new Date(); now.setDate(1); now.setHours(0, 0, 0, 0)
  const maxMonth = new Date(maxDeliveryDate.value); maxMonth.setDate(1); maxMonth.setHours(23, 59, 59, 999)
  if (newDate >= now && newDate <= maxMonth) calendarViewDate.value = newDate
}

const daysOfWeek = ['一', '二', '三', '四', '五', '六', '日']

const calendarDays = computed(() => {
  const year = calendarViewDate.value.getFullYear()
  const month = calendarViewDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  let startIdx = firstDay.getDay() - 1
  if (startIdx === -1) startIdx = 6
  const totalDays = lastDay.getDate()

  const days = []
  for (let i = 0; i < startIdx; i++) days.push({ dateStr: '', dayNum: 0, isDisabled: true, isSelected: false, isCurrentMonth: false })
  for (let day = 1; day <= totalDays; day++) {
    const current = new Date(year, month, day)
    current.setHours(0, 0, 0, 0)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isDisabled = current.getTime() < minDeliveryDate.value.getTime() || current.getTime() > maxDeliveryDate.value.getTime()
    days.push({ dateStr, dayNum: day, isDisabled, isSelected: orderForm.value.deliveryDate === dateStr, isCurrentMonth: true })
  }
  return days
})

const selectDate = (dayItem: { dateStr: string; isDisabled: boolean }) => {
  if (dayItem.isDisabled || !dayItem.dateStr) return
  orderForm.value.deliveryDate = dayItem.dateStr
  showDatePickerModal.value = false
}

// 🎯 從後端 API 載入真實商品
const allProducts = ref<Product[]>([])
const loadingProducts = ref(true)

// 過濾未勾選隱藏的真實商品
const displayProducts = computed(() => allProducts.value.filter(p => p.isHidden !== true))

const fetchProducts = async () => {
  loadingProducts.value = true
  const targets = [
    `${API_BASE}/api/products`,
    'https://moni-atelier-backend.onrender.com/api/products'
  ]

  let success = false
  for (const url of targets) {
    if (success) break
    try {
      console.log('🌸 嘗試抓取商品資料網址:', url)
      const res = await fetch(url)
      const data = await res.json()
      if (data.status === 'success' && Array.isArray(data.products)) {
        allProducts.value = data.products.map((p: any) => ({
          ...p,
          id: p._id || p.id,
          image: p.imageUrl || p.image
        }))
        success = true
        console.log(`✅ 成功抓取 ${allProducts.value.length} 項後端商品！`)
      }
    } catch (err) {
      console.warn(`⚠️ 嘗試連線 ${url} 失敗:`, err)
    }
  }
  loadingProducts.value = false
}

const getProductImage = (item: Product) => item.imageUrl || item.image || ''
const getProductId = (item: Product) => item._id || item.id

// 💰 購物車與折扣金額計算
const cartTotalPrice = computed(() => {
  let total = 0
  for (const [id, qty] of Object.entries(cartStore.cart || {})) {
    const product = allProducts.value.find(p => String(getProductId(p)) === String(id))
    if (product) {
      total += Number(product.price || product.originalPrice || 0) * Number(qty)
    }
  }
  return total
})

const shippingFee = computed(() => (cartTotalPrice.value === 0 || cartTotalPrice.value >= 4500) ? 0 : 300)

const actualUsedPoints = computed(() => {
  const maxAllow = Math.min(userPoints.value, cartTotalPrice.value)
  return Math.max(0, Math.min(usedPointsInput.value, maxAllow))
})

const finalTotalPrice = computed(() => Math.max(0, cartTotalPrice.value + shippingFee.value - actualUsedPoints.value))

const earnedPoints = computed(() => Math.floor(finalTotalPrice.value / 100))

const copyReferralLink = () => {
  if (!lineProfile.value?.userId) return
  const link = `${window.location.origin}/?ref=${lineProfile.value.userId}`
  navigator.clipboard.writeText(link)
  isCopyReferralSuccess.value = true
  setTimeout(() => { isCopyReferralSuccess.value = false }, 3000)
}

const saveBirthday = async () => {
  if (!userBirthday.value || !lineProfile.value?.userId) return
  try {
    const res = await fetch(`${API_BASE}/api/users/birthday`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId: lineProfile.value.userId, birthday: userBirthday.value })
    })
    const data = await res.json()
    if (data.status === 'success') {
      userPoints.value = data.points
      alert(data.message)
      showBirthdayModal.value = false
    }
  } catch (err) {
    alert('設定生日失敗，請稍後再試')
  }
}

// --- 🎯 頁面初始化 LIFF 與會員資料 ---
onMounted(async () => {
  await fetchProducts()

  const addParam = route.query.add as string
  if (addParam) {
    const productIds = addParam.split(',').map(id => id.trim()).filter(Boolean)
    productIds.forEach(id => cartStore.addToCart(id))
    currentStep.value = 2
  }

  try {
    await liff.init({ liffId: LIFF_ID })
    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile()
      lineProfile.value = profile
      if (!orderForm.value.payer.name) orderForm.value.payer.name = profile.displayName

      const userRes = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: profile.userId,
          displayName: profile.displayName,
          referrerId: route.query.ref as string || ''
        })
      })
      const userData = await userRes.json()
      if (userData.status === 'success' && userData.user) {
        userPoints.value = userData.user.points || 0
        usedPointsInput.value = userPoints.value
      }
    }
  } catch (err) {
    console.warn('LIFF 初始化失敗:', err)
  }

  if (!orderForm.value.deliveryDate) orderForm.value.deliveryDate = minDeliveryDateStr.value
})

const taiwanDistricts: Record<string, string[]> = {
  '台北市': ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'],
  '新北市': ['板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區', '樹林區', '鶯歌區', '三峽區', '淡水區', '汐止區', '瑞芳區', '土城區', '蘆洲區', '五股區', '泰山區', '林口區']
}
const taiwanCities = Object.keys(taiwanDistricts)
const sameAsPayer = ref(false)
const storeInput = ref({ name: '', address: '' })

const handleSameAsPayer = () => {
  if (sameAsPayer.value) {
    orderForm.value.recipient.name = orderForm.value.payer.name
    orderForm.value.recipient.phone = orderForm.value.payer.phone
  }
}

const orderForm = ref({
  deliveryDate: '',
  deliveryMethod: 'black_cat',
  selectedStore: null as any,
  payer: { name: '', phone: '', email: '' },
  recipient: { name: '', phone: '', city: '台北市', district: '中正區', address: '' }
})

const totalCartItemsCount = computed(() => {
  const values = Object.values(cartStore.cart || {}) as number[]
  return values.reduce((sum: number, qty: number) => sum + Number(qty), 0)
})

const isLoading = ref(false)

const executePayment = async () => {
  showPolicyModal.value = false
  const isStoreDelivery = ['seven_eleven', 'familymart'].includes(orderForm.value.deliveryMethod)
  if (isStoreDelivery) {
    orderForm.value.selectedStore = { id: 'CUSTOM', name: storeInput.value.name.trim(), address: storeInput.value.address.trim() }
  }

  try {
    isLoading.value = true
    const recipientData = {
      ...orderForm.value.recipient,
      fullAddress: isStoreDelivery ? `${storeInput.value.name} (${storeInput.value.address})` : `${orderForm.value.recipient.city}${orderForm.value.recipient.district}${orderForm.value.recipient.address}`
    }

    const response = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: cartStore.cart,
        subtotal: cartTotalPrice.value,
        shippingFee: shippingFee.value,
        usedPoints: actualUsedPoints.value,
        totalAmount: finalTotalPrice.value,
        deliveryDate: orderForm.value.deliveryDate,
        deliveryMethod: orderForm.value.deliveryMethod,
        selectedStore: orderForm.value.selectedStore,
        email: orderForm.value.payer.email,
        lineUserId: lineProfile.value?.userId || null,
        payer: orderForm.value.payer,
        recipient: recipientData
      })
    })

    const resData = await response.json()
    if (resData.status === 'success' && resData.data) {
      const data = resData.data
      const PayGateWay = data.PayGateWay || data.payGateWay
      const MerchantID = data.MerchantID || data.merchantId
      const Version = data.Version || '2.0'
      const TradeInfo = data.TradeInfo
      const TradeSha = data.TradeSha

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = PayGateWay
      const fields: Record<string, string> = { MerchantID, TradeInfo, TradeSha, Version }
      for (const key in fields) {
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = key; input.value = fields[key]
        form.appendChild(input)
      }
      document.body.appendChild(form)
      setTimeout(() => form.submit(), 50)
    } else {
      alert(resData.message || '建立訂單失敗，請稍後再試')
    }
  } catch (error) {
    alert('無法連線至伺服器或發生系統錯誤')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="page-wrapper">
    <!-- 🌸 步驟導覽列 -->
    <div class="step-indicator">
      <div class="step-item" :class="{ active: currentStep === 1 }" @click="currentStep = 1">
        <span class="step-num">1</span>
        <span class="step-text">選購商品</span>
      </div>
      <div class="step-line"></div>
      <div class="step-item" :class="{ active: currentStep === 2 }" @click="cartTotalPrice > 0 && (currentStep = 2)">
        <span class="step-num">2</span>
        <span class="step-text">訂單明細與結帳</span>
      </div>
    </div>

    <!-- 🌸 步驟一：選購商品 -->
    <div v-if="currentStep === 1" class="step-content">
      <section class="products-section">
        <h2 class="section-title">精選花藝作品</h2>
        <div v-if="loadingProducts" class="loading-state">🌸 正在為您載入最新花藝作品...</div>
        <div v-else-if="displayProducts.length === 0" class="loading-state">目前尚未有上架商品。</div>
        <div v-else class="product-grid">
          <div v-for="item in displayProducts" :key="getProductId(item)" class="product-card">
            <div class="image-wrapper" @click="openProductDetail(item)">
              <span v-if="item.badge" class="badge-no">{{ item.badge }}</span>
              <img :src="getProductImage(item)" :alt="item.name" />
              <span v-if="item.tag" class="tag-hot">{{ item.tag }}</span>
              <div class="view-detail-badge">🔍 查看詳情</div>
            </div>
            <div class="product-info">
              <span class="category">{{ item.category }}</span>
              <h3 class="product-name" @click="openProductDetail(item)">{{ item.name }}</h3>
              <p class="description">{{ item.description }}</p>
              <div class="divider"></div>
              <div class="card-footer">
                <div class="price-box">
                  <span class="price-val">NT$ {{ Number(item.price || item.originalPrice).toLocaleString() }}</span>
                </div>
                <button class="add-btn" @click.stop="cartStore.addToCart(getProductId(item))">加入購物車</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="cart-floating-bar" v-if="totalCartItemsCount > 0">
        <div class="bar-info" @click="showCartDrawer = true">
          <span>🛒 已選購 <strong>{{ totalCartItemsCount }}</strong> 件商品 ✏️</span>
          <span class="bar-price">小計：新台幣 {{ cartTotalPrice.toLocaleString() }} 元</span>
        </div>
        <button class="next-step-btn" @click="currentStep = 2">前往結帳 (下一步) →</button>
      </div>
    </div>

    <!-- 🌸 步驟二：訂單明細與結帳 -->
    <div v-if="currentStep === 2" class="step-content">
      <button class="back-btn" @click="currentStep = 1">← 返回選購商品</button>
      <section class="checkout-section">
        <div class="checkout-card">
          <h2 class="checkout-title">訂單明細與結帳</h2>
          
          <div class="cart-list">
            <div v-for="(qty, id) in cartStore.cart" :key="id" class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-name">{{ allProducts.find(p => String(getProductId(p)) === String(id))?.name || '精選花藝作品' }}</div>
                <div class="cart-item-price">新台幣 {{ ((allProducts.find(p => String(getProductId(p)) === String(id))?.price || 0) * Number(qty)).toLocaleString() }} 元</div>
              </div>
            </div>

            <!-- 🎁 會員點數、生日禮金與好友推薦專區 -->
            <div v-if="lineProfile" class="checkout-member-section">
              <div class="member-header">
                <span>👤 {{ lineProfile.displayName }} 的專屬紅利</span>
                <span class="points-badge">目前累積 <strong>{{ userPoints }}</strong> 點 ($1點=$1元)</span>
              </div>

              <!-- 1. 折抵紅利點數輸入 -->
              <div v-if="userPoints > 0" class="points-input-row">
                <label>使用點數折抵：</label>
                <input type="number" v-model.number="usedPointsInput" :max="userPoints" min="0" placeholder="0" />
                <span class="points-tip">可折抵 NT$ {{ actualUsedPoints }} 元</span>
              </div>

              <!-- 2. 生日禮金與推薦好友獎勵按鈕 -->
              <div class="member-extra-actions">
                <button type="button" class="action-outline-btn" @click="showBirthdayModal = true">
                  🎂 登錄生日領 $100 購物金
                </button>
                <button type="button" class="action-outline-btn" @click="showReferralInfoModal = true">
                  🔗 推薦好友領 $50 紅利
                </button>
              </div>
            </div>

            <div class="summary-box">
              <div class="summary-row"><span>商品小計</span><span>NT$ {{ cartTotalPrice.toLocaleString() }}</span></div>
              <div class="summary-row"><span>運費</span><span>{{ shippingFee === 0 ? '免運費' : `NT$ ${shippingFee}` }}</span></div>
              <div v-if="actualUsedPoints > 0" class="summary-row discount-row"><span>紅利折抵</span><span>- NT$ {{ actualUsedPoints }}</span></div>
            </div>
            
            <div class="total-row">
              <div>
                <span>合計 總金額</span>
                <span class="earned-points-tip"> (完成訂單可獲得 🎁 {{ earnedPoints }} 點紅利)</span>
              </div>
              <span class="total-price">新台幣 {{ finalTotalPrice.toLocaleString() }} 元</span>
            </div>
          </div>

          <hr class="divider" />

          <form @submit.prevent="openPolicyModal" class="order-form">
            <h3 class="form-subtitle">訂購與配送資訊</h3>
            <div class="form-group">
              <label>希望送達日期 *</label>
              <div class="custom-date-trigger" @click="openCalendar">📅 {{ orderForm.deliveryDate || '點擊選擇希望送達日期' }}</div>
            </div>

            <div class="form-group">
              <label>配送方式 *</label>
              <select v-model="orderForm.deliveryMethod">
                <option value="black_cat">黑貓宅配 (運費 NT$300 / 滿 NT$4,500 免運)</option>
                <option value="familymart">全家店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
                <option value="seven_eleven">7-11店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
              </select>
            </div>

            <div v-if="['seven_eleven', 'familymart'].includes(orderForm.deliveryMethod)" class="form-section store-input-section">
              <h4 class="sub-section-title">🏪 填寫門市資訊</h4>
              <div class="form-group">
                <label>門市名稱 *</label>
                <input type="text" v-model="storeInput.name" placeholder="例如：7-11 鑫南京門市" required />
              </div>
              <div class="form-group">
                <label>門市地址 *</label>
                <input type="text" v-model="storeInput.address" placeholder="例如：台北市中山區南京東路二段100號" required />
              </div>
            </div>

            <div class="form-section">
              <h4 class="sub-section-title">👤 付款人資訊</h4>
              <div class="form-group"><label>姓名 *</label><input type="text" v-model="orderForm.payer.name" required /></div>
              <div class="form-group"><label>聯絡電話 *</label><input type="tel" v-model="orderForm.payer.phone" required /></div>
              <div class="form-group"><label>Email *</label><input type="email" v-model="orderForm.payer.email" required /></div>
            </div>

            <div class="form-section">
              <div class="section-header-inline">
                <h4 class="sub-section-title">📦 收件人資訊</h4>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="sameAsPayer" @change="handleSameAsPayer" /> 同付款人
                </label>
              </div>

              <div class="form-group">
                <label>姓名 *</label>
                <input type="text" v-model="orderForm.recipient.name" :disabled="sameAsPayer" required />
              </div>
              <div class="form-group">
                <label>聯絡電話 *</label>
                <input type="tel" v-model="orderForm.recipient.phone" :disabled="sameAsPayer" required />
              </div>

              <div v-if="!['seven_eleven', 'familymart'].includes(orderForm.deliveryMethod)" class="form-group">
                <label>聯絡地址 *</label>
                <div class="address-group">
                  <select v-model="orderForm.recipient.city" required>
                    <option v-for="city in taiwanCities" :key="city" :value="city">{{ city }}</option>
                  </select>
                  <select v-model="orderForm.recipient.district" required>
                    <option v-for="dist in taiwanDistricts[orderForm.recipient.city] || []" :key="dist" :value="dist">{{ dist }}</option>
                  </select>
                </div>
                <input type="text" v-model="orderForm.recipient.address" placeholder="街道門牌資訊" required />
              </div>
            </div>

            <button type="submit" class="submit-btn" :disabled="isLoading || Object.keys(cartStore.cart).length === 0">
              前往付款（新台幣 {{ finalTotalPrice.toLocaleString() }} 元）
            </button>
          </form>
        </div>
      </section>
    </div>

    <!-- 🛒 購物車 Drawer Modal -->
    <div v-if="showCartDrawer" class="modal-backdrop" @click.self="showCartDrawer = false">
      <div class="cart-drawer-modal">
        <div class="drawer-header">
          <h3>🛒 購物車內容</h3>
          <button class="close-icon-btn" @click="showCartDrawer = false">✕</button>
        </div>
        <div class="drawer-body">
          <div v-if="Object.keys(cartStore.cart).length === 0" class="empty-cart">購物車內沒有商品</div>
          <div v-else>
            <div v-for="(qty, id) in cartStore.cart" :key="id" class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-name">{{ allProducts.find(p => String(getProductId(p)) === String(id))?.name || '精選花藝作品' }}</div>
                <div class="cart-item-price">NT$ {{ (((allProducts.find(p => String(getProductId(p)) === String(id))?.price || 0)) * Number(qty)).toLocaleString() }}</div>
              </div>
              <div class="quantity-control">
                <button @click="cartStore.removeFromCart(id)">-</button>
                <span>{{ qty }}</span>
                <button @click="cartStore.addToCart(id)">+</button>
              </div>
            </div>
          </div>
        </div>
        <div class="drawer-footer">
          <button class="confirm-drawer-btn" @click="showCartDrawer = false">完成編輯</button>
        </div>
      </div>
    </div>

    <!-- 🔍 商品詳情 Modal -->
    <div v-if="selectedProductDetail" class="modal-backdrop" @click.self="closeProductDetail">
      <div class="product-detail-modal">
        <button class="close-icon-btn" @click="closeProductDetail">✕</button>
        <div class="detail-image-wrapper">
          <img :src="getProductImage(selectedProductDetail)" :alt="selectedProductDetail.name" />
        </div>
        <div class="detail-body">
          <span class="category">{{ selectedProductDetail.category }}</span>
          <h2>{{ selectedProductDetail.name }}</h2>
          <p class="detail-desc">{{ selectedProductDetail.description }}</p>
          <div class="detail-footer">
            <span class="detail-price">NT$ {{ Number(selectedProductDetail.price || selectedProductDetail.originalPrice).toLocaleString() }}</span>
            <button class="add-btn" @click="cartStore.addToCart(getProductId(selectedProductDetail)); closeProductDetail()">加入購物車</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 🗓️ 自訂月曆 Modal -->
    <div v-if="showDatePickerModal" class="modal-backdrop" @click.self="showDatePickerModal = false">
      <div class="calendar-modal">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <button type="button" class="month-nav-btn" @click="changeMonth(-1)">‹</button>
          <span class="month-title" style="font-weight: bold; font-size: 16px;">
            {{ calendarViewDate.getFullYear() }} 年 {{ calendarViewDate.getMonth() + 1 }} 月
          </span>
          <button type="button" class="month-nav-btn" @click="changeMonth(1)">›</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px; text-align: center;">
          <div v-for="(day, idx) in daysOfWeek" :key="idx" style="font-weight: bold; font-size: 13px; color: #666;">{{ day }}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
          <button
            v-for="(day, idx) in calendarDays"
            :key="idx"
            type="button"
            :disabled="day.isDisabled || !day.isCurrentMonth"
            @click="selectDate(day)"
            :class="['calendar-day-btn', { selected: day.isSelected, disabled: day.isDisabled || !day.isCurrentMonth }]"
          >
            {{ day.dayNum || '' }}
          </button>
        </div>
        <div class="calendar-footer" style="margin-top: 16px; text-align: center;">
          <button type="button" class="close-modal-btn" @click="showDatePickerModal = false">關閉</button>
        </div>
      </div>
    </div>

    <!-- 📜 購物須知與條款 Modal -->
    <div v-if="showPolicyModal" class="modal-backdrop" @click.self="showPolicyModal = false">
      <div class="policy-modal">
        <div class="policy-modal-header">
          <h3>🌸 購物須知與條款閱讀確認</h3>
          <button class="close-icon-btn" @click="showPolicyModal = false">✕</button>
        </div>
        <div class="policy-modal-body">
          <p>歡迎光臨「墨凝花室」。客製化花禮不適用 7 天鑑賞期，請確認訂購內容無誤。</p>
        </div>
        <div class="policy-modal-footer">
          <label class="agree-checkbox-label">
            <input type="checkbox" v-model="hasAgreedPolicy" />
            我已完整閱讀並同意條款
          </label>
          <button type="button" class="confirm-pay-btn" :disabled="!hasAgreedPolicy || isLoading" @click="executePayment">
            {{ isLoading ? '處理中...' : '確認同意並前往付款' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 🎂 生日領取紅利 Modal -->
    <div v-if="showBirthdayModal" class="modal-backdrop" @click.self="showBirthdayModal = false">
      <div class="calendar-modal">
        <h3>🎂 紀錄生日月份</h3>
        <p style="font-size: 0.85rem; color: #666; margin-bottom: 12px;">於生日當月開啟選購，即可自動領取 $100 元生日購物金！</p>
        <input type="date" v-model="userBirthday" style="width:100%; padding:8px; margin-bottom:12px; border:1px solid #ccc; border-radius:4px;" />
        <button class="confirm-pay-btn" @click="saveBirthday">儲存生日月份</button>
      </div>
    </div>

    <!-- 🔗 推薦好友使用說明 Modal -->
    <div v-if="showReferralInfoModal" class="modal-backdrop" @click.self="showReferralInfoModal = false">
      <div class="calendar-modal">
        <h3>🎁 推薦好友賺紅利說明</h3>
        <div class="referral-guide-body">
          <p><strong>1. 複製您的專屬連結：</strong><br />點擊下方按鈕複製您的專屬推廣網址。</p>
          <p><strong>2. 分享給親朋好友：</strong><br />將連結發給好友，好友點開即可獲得新會員 $100 首購折抵金！</p>
          <p><strong>3. 賺取 $50 紅利獎勵：</strong><br />當好友使用您的連結完成首筆下單，系統將自動回饋您 <strong>50 點紅利 ($50元)</strong>！</p>
        </div>
        <button class="confirm-pay-btn" @click="copyReferralLink(); showReferralInfoModal = false">
          {{ isCopyReferralSuccess ? '已成功複製！' : '一鍵複製我的專屬推薦網址' }}
        </button>
        <button class="close-modal-btn" style="margin-top: 8px;" @click="showReferralInfoModal = false">關閉</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 🌸 標題與內文樣式 */
.section-title {
  color: #FFFFFF;
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 1rem;
}
.loading-state {
  text-align: center;
  color: #FFFFFF;
  padding: 2rem;
}

/* 🌸 商品卡片區塊 */
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.2rem;
}
.product-card {
  background: #FFFFFF;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.image-wrapper {
  aspect-ratio: 3/4;
  background: #34444E;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}
.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.badge-no {
  position: absolute;
  top: 8px;
  left: 8px;
  background: #FFF;
  color: #333;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: bold;
}
.tag-hot {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: #FFF;
  color: #8B5E4C;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: bold;
}
.view-detail-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0,0,0,0.6);
  color: #FFF;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
}
.product-info {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  text-align: center;
  color: #2D3748;
}
.product-name {
  font-size: 1.05rem;
  margin: 0.3rem 0;
  color: #2D3748;
}
.description {
  font-size: 0.82rem;
  color: #718096;
  line-height: 1.4;
  height: 36px;
  overflow: hidden;
}
.card-footer {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.price-val {
  font-size: 1rem;
  font-weight: bold;
  color: #8B5E4C;
}
.add-btn {
  background: #F7F9FA;
  color: #34444E;
  border: 1px solid #34444E;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}

/* 🌸 步驟導覽列 */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: #FFFFFF;
  padding: 0.8rem;
  border-radius: 8px;
}
.step-item { cursor: pointer; opacity: 0.5; color: #333; }
.step-item.active { opacity: 1; font-weight: bold; }
.step-num {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  border-radius: 50%;
  background: #CBD5E1;
  text-align: center;
  margin-right: 4px;
}
.step-item.active .step-num { background: #34444E; color: #FFF; }
.step-line { width: 30px; height: 2px; background: #CBD5E1; }

/* 🌸 浮動購物車 Bar */
.cart-floating-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 500px;
  background: #34444E;
  color: #FFFFFF;
  padding: 0.8rem 1.2rem;
  border-radius: 50px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
  z-index: 1000;
}
.bar-info { display: flex; flex-direction: column; font-size: 0.88rem; cursor: pointer; }
.bar-price { font-size: 0.78rem; color: #CBD5E1; }
.next-step-btn {
  background: #FFFFFF;
  color: #34444E;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
}

/* 🌸 結帳頁面會員區塊 */
.checkout-card {
  background: #FFFFFF;
  padding: 1.5rem;
  border-radius: 12px;
  color: #2D3748;
}
.checkout-title {
  font-size: 1.2rem;
  color: #34444E;
  margin-bottom: 1rem;
}
.checkout-member-section {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}
.member-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  font-weight: bold;
  color: #34444E;
  margin-bottom: 0.8rem;
}
.points-badge { color: #D97706; }
.points-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  margin-bottom: 0.8rem;
}
.points-input-row input {
  width: 90px;
  padding: 6px;
  border: 1px solid #CBD5E1;
  border-radius: 4px;
}
.points-tip { font-weight: bold; color: #B45309; }
.member-extra-actions {
  display: flex;
  gap: 8px;
}
.action-outline-btn {
  flex: 1;
  background: #FFFFFF;
  border: 1px solid #34444E;
  color: #34444E;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: bold;
  cursor: pointer;
}
.referral-guide-body {
  font-size: 0.85rem;
  line-height: 1.5;
  color: #4A5568;
  text-align: left;
  margin: 12px 0;
}

.submit-btn { width: 100%; background: #34444E; color: #FFF; padding: 0.9rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 1rem; }
.back-btn { background: none; border: 1px solid #FFF; color: #FFF; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; margin-bottom: 1rem; }

/* Modal 彈窗通用 */
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.calendar-modal, .policy-modal, .cart-drawer-modal, .product-detail-modal { background: #FFF; border-radius: 12px; padding: 1.2rem; max-width: 400px; width: 90%; color: #333; }
.confirm-pay-btn { width: 100%; padding: 0.75rem; background: #34444E; color: #FFF; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.close-modal-btn { width: 100%; padding: 6px; background: #E2E8F0; border: none; border-radius: 4px; cursor: pointer; }
.month-nav-btn { background: none; border: none; font-size: 18px; cursor: pointer; }
.calendar-day-btn { width: 100%; height: 32px; border: none; background: transparent; cursor: pointer; }
.calendar-day-btn.selected { background: #34444E; color: #FFF; border-radius: 50%; }
.calendar-day-btn.disabled { opacity: 0.3; cursor: not-allowed; }
</style>