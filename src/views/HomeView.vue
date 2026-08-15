<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
// @ts-ignore
import { useCartStore } from '../stores/cart'
import liff from '@line/liff'

// --- 🎯 1. 型別宣告 ---
interface Product {
  id: number | string
  _id?: string
  name: string
  category: string
  price: number
  originalPrice?: number | null
  leadTimeDays?: number
  badge?: string
  tag?: string
  description: string
  image?: string
  imageUrl?: string
  shortUrl?: string
  badgeTextColor?: string
  tagTextColor?: string
  badgeBgColor?: string
  badgeOpacity?: number
  isHidden?: boolean
}

// --- 🎯 2. 工具函式（必須置於最頂部以防 TDZ 報錯） ---
const getProductId = (item: Product) => item._id || item.id
const getProductImage = (item: Product) => item.imageUrl || item.image || ''
const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('zh-TW') : ''
const truncateId = (id?: string) => id ? (id.length > 12 ? id.slice(0, 6) + '...' + id.slice(-4) : id) : '訪客'
const formatStatus = (s: string) => ({ PENDING: '待付款', PAID: '已付款', accepted: '已接單', in_production: '製作中', delivering: '配送中', completed: '✓ 已完成', refunded: '↩ 已退款', cancelled: '✕ 已取消' }[s] || s)
const formatDeliveryMethod = (m: string) => ({ black_cat: '黑貓宅配', express_taipei_1: '專人雙北配送1', express_taipei_2: '專人雙北配送2', store_pickup: '門市自取', seven_eleven: '7-11店到店', familymart: '全家店到店' }[m] || m || '未指定')

// --- 🎯 3. LINE LIFF 與系統基礎設定 ---
const LIFF_ID = '2010913515-HfcsIAK0'
const lineProfile = ref<{ userId: string; displayName: string; pictureUrl?: string } | null>(null)
const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://moni-atelier-backend.onrender.com').replace(/\/$/, '')

const route = useRoute()
const cartStore = useCartStore()

// --- 🎯 4. 基本狀態與商品清單 ---
const activeTab = ref<'shop' | 'member'>('shop')
const currentStep = ref(1)
const showCartDrawer = ref(false)
const selectedProductDetail = ref<Product | null>(null)
const showPolicyModal = ref(false)
const hasAgreedPolicy = ref(false)
const isLoading = ref(false)

const allProducts = ref<Product[]>([])
const loadingProducts = ref(true)

const categories = ['全部作品', '旗艦系列花束', '輕奢系列花束', '珍藏玻璃罩系列', '懸浮心意系列']
const selectedCategory = ref('全部作品')

const displayProducts = computed(() => {
  const visibleList = allProducts.value.filter(p => p.isHidden !== true)
  if (selectedCategory.value === '全部作品') return visibleList
  return visibleList.filter(p => p.category === selectedCategory.value)
})

// --- 🎯 5. 表單狀態 ---
const orderForm = ref({
  deliveryDate: '',
  deliveryMethod: 'black_cat',
  selectedStore: null as any,
  payer: { name: '', phone: '', email: '' },
  recipient: { name: '', phone: '', city: '台北市', district: '中正區', address: '' }
})

const sameAsPayer = ref(false)
const storeInput = ref({ name: '', address: '' })

// --- 🎯 6. 會員與紅利狀態 ---
const userPoints = ref(100)
const usedPointsInput = ref(100)
const userBirthday = ref('')
const hasBirthday = ref(false)
const showBirthdayModal = ref(false)
const showReferralInfoModal = ref(false)
const isCopyReferralSuccess = ref(false)
const showPointsRules = ref(false)
const myOrders = ref<any[]>([])
const loadingOrders = ref(false)
const showSuccessModal = ref(false)
const successOrderNo = ref('')

// --- 🎯 7. 動態送達日期與物流計算 ---
const deliveryMethodDays: Record<string, number> = {
  express_taipei_1: 0,
  express_taipei_2: 0,
  black_cat: 1,
  seven_eleven: 3,
  familymart: 3
}

const minDeliveryDate = computed(() => {
  let maxLeadDays = 5
  if (cartStore?.cart && allProducts.value.length > 0) {
    for (const id of Object.keys(cartStore.cart)) {
      const product = allProducts.value.find(p => String(getProductId(p)) === String(id))
      if (product && product.leadTimeDays) {
        if (Number(product.leadTimeDays) > maxLeadDays) {
          maxLeadDays = Number(product.leadTimeDays)
        }
      }
    }
  }

  const shippingDays = deliveryMethodDays[orderForm.value.deliveryMethod] || 1
  const totalDays = maxLeadDays + shippingDays

  const d = new Date()
  d.setDate(d.getDate() + totalDays)
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

watch(minDeliveryDateStr, (newMinStr) => {
  if (!orderForm.value.deliveryDate || orderForm.value.deliveryDate < newMinStr) {
    orderForm.value.deliveryDate = newMinStr
  }
})

// --- 🎯 8. 月曆邏輯 ---
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

// --- 🎯 9. 購物車與金額計算 ---
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

const shippingFee = computed(() => {
  if (cartTotalPrice.value === 0 || cartTotalPrice.value >= 4500) return 0
  if (orderForm.value.deliveryMethod === 'express_taipei_2') {
    return 500
  }
  return 300
})

const actualUsedPoints = computed(() => {
  const maxAllow = Math.min(userPoints.value, cartTotalPrice.value)
  return Math.max(0, Math.min(usedPointsInput.value, maxAllow))
})

const finalTotalPrice = computed(() => Math.max(0, cartTotalPrice.value + shippingFee.value - actualUsedPoints.value))
const earnedPoints = computed(() => Math.floor(finalTotalPrice.value / 100))
const totalCartItemsCount = computed(() => {
  const values = Object.values(cartStore.cart || {}) as number[]
  return values.reduce((sum: number, qty: number) => sum + Number(qty), 0)
})

const taiwanDistricts: Record<string, string[]> = {
  '台北市': ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'],
  '新北市': ['板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區', '樹林區', '鶯歌區', '三峽區', '淡水區', '汐止區', '瑞芳區', '土城區', '蘆洲區', '五股區', '泰山區', '林口區']
}
const taiwanCities = Object.keys(taiwanDistricts)

const handleSameAsPayer = () => {
  if (sameAsPayer.value) {
    orderForm.value.recipient.name = orderForm.value.payer.name
    orderForm.value.recipient.phone = orderForm.value.payer.phone
  }
}

const storeNamePlaceholder = computed(() => {
  return orderForm.value.deliveryMethod === 'familymart' 
    ? '例如：全家 鑫南京店' 
    : '例如：7-11 鑫南京門市'
})

const getBadgeStyle = (product: Product, type: 'badge' | 'tag') => {
  const textColor = type === 'badge' ? (product.badgeTextColor || '#34444E') : (product.tagTextColor || '#34444E')
  const bgColor = product.badgeBgColor || '#ffffff'
  const opacity = (product.badgeOpacity !== undefined ? product.badgeOpacity : 100) / 100

  let r = 255, g = 255, b = 255
  if (bgColor.startsWith('#') && bgColor.length === 7) {
    r = parseInt(bgColor.slice(1, 3), 16)
    g = parseInt(bgColor.slice(3, 5), 16)
    b = parseInt(bgColor.slice(5, 7), 16)
  }

  return { color: textColor, backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` }
}

const getCartItemsText = (cartObj: any) => {
  if (!cartObj) return '精選花藝作品'
  const items = Object.entries(cartObj).map(([id, qty]) => {
    const p = allProducts.value.find(item => String(getProductId(item)) === String(id))
    return `${p?.name || '花藝作品'} x${qty}`
  })
  return items.join('，')
}

// --- 🎯 10. 互動方法 ---
const openProductDetail = (product: Product) => { selectedProductDetail.value = product }
const closeProductDetail = () => { selectedProductDetail.value = null }

const copyReferralLink = () => {
  if (!lineProfile.value?.userId) return
  const link = `https://liff.line.me/${LIFF_ID}?ref=${lineProfile.value.userId}`
  navigator.clipboard.writeText(link)
  isCopyReferralSuccess.value = true
  setTimeout(() => { isCopyReferralSuccess.value = false }, 3000)
}

const handleReturnToLine = () => {
  try {
    if (liff.isInClient()) {
      liff.closeWindow()
    } else {
      window.location.href = 'https://line.me/R/ti/p/@509mafly'
    }
  } catch (e) {
    window.location.href = 'https://line.me/R/ti/p/@509mafly'
  }
}

const closeSuccessAndReturn = () => {
  showSuccessModal.value = false
  handleReturnToLine()
}

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

const saveBirthday = async () => {
  if (!userBirthday.value) { alert('請先選擇完整的生日日期！'); return }
  const targetUserId = lineProfile.value?.userId
  if (!targetUserId) { alert('請從 LINE 官方帳號開啟以連線帳號！'); return }

  try {
    const res = await fetch(`${API_BASE}/api/users/birthday`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId: targetUserId, birthday: userBirthday.value })
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') {
      hasBirthday.value = true
      showBirthdayModal.value = false
      userPoints.value = data.points !== undefined ? data.points : 100
      alert(data.message || '生日日期登記成功！')
    } else {
      alert('登記生日失敗，請稍後再試。')
    }
  } catch (err) {
    alert('登記生日失敗，請稍後再試。')
  }
}

const fetchMyOrders = async () => {
  if (!lineProfile.value?.userId) return
  loadingOrders.value = true
  try {
    const res = await fetch(`${API_BASE}/api/orders`)
    const data = await res.json()
    if (data.status === 'success') {
      const allOrders = data.orders || []
      myOrders.value = allOrders.filter((o: any) => 
        o.lineUserId === lineProfile.value?.userId || 
        (o.payer?.email && o.payer.email === orderForm.value.payer.email)
      )
    }
  } catch (err) {
    console.warn('無法抓取會員訂單紀錄:', err)
  } finally {
    loadingOrders.value = false
  }
}

const loginBackendUser = async (profile: { userId: string; displayName: string; pictureUrl?: string }) => {
  const payload = {
    lineUserId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl || '',
    referrerId: (route.query.ref as string) || ''
  }

  try {
    const res = await fetch(`${API_BASE}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (res.ok && data.status === 'success' && data.user) {
      userPoints.value = data.user.points !== undefined ? data.user.points : 100
      usedPointsInput.value = userPoints.value
      if (data.user.birthday) {
        hasBirthday.value = true
        userBirthday.value = data.user.birthday
      }
      fetchMyOrders()
    }
  } catch (err) {
    userPoints.value = 100
    usedPointsInput.value = 100
  }
}

const fetchProducts = async () => {
  loadingProducts.value = true
  try {
    const res = await fetch(`${API_BASE}/api/products`)
    const data = await res.json()
    if (data.status === 'success' && Array.isArray(data.products)) {
      allProducts.value = data.products.map((p: any) => ({
        ...p,
        id: p._id || p.id,
        image: p.imageUrl || p.image,
        leadTimeDays: p.leadTimeDays || 5
      }))
    }
  } catch (err) {
    console.warn('抓取商品失敗:', err)
  } finally {
    loadingProducts.value = false
  }
}

const executePayment = async () => {
  showPolicyModal.value = false
  const isStoreDelivery = ['seven_eleven', 'familymart'].includes(orderForm.value.deliveryMethod)
  if (isStoreDelivery) {
    orderForm.value.selectedStore = { id: 'CUSTOM', name: storeInput.value.name.trim(), address: storeInput.value.address.trim() }
  }

  try {
    isLoading.value = true
    const city = isStoreDelivery ? '超商門市' : (orderForm.value.recipient.city || '台北市')
    const district = isStoreDelivery ? '門市取件' : (orderForm.value.recipient.district || '中正區')
    const addressDetail = isStoreDelivery ? `${storeInput.value.name} (${storeInput.value.address})` : (orderForm.value.recipient.address || '')

    const recipientData = {
      name: orderForm.value.recipient.name || orderForm.value.payer.name,
      phone: orderForm.value.recipient.phone || orderForm.value.payer.phone,
      city,
      district,
      address: addressDetail,
      fullAddress: isStoreDelivery ? `${storeInput.value.name} (${storeInput.value.address})` : `${city}${district}${addressDetail}`
    }

    const payload = {
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
    }

    const response = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const resData = await response.json()

    if (response.ok && resData.status === 'success' && resData.data) {
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
      const errMsg = resData?.message || resData?.error || '伺服器拒絕建立訂單，請檢查欄位是否齊全'
      alert(`❌ 建立訂單失敗：${errMsg}`)
    }
  } catch (error) {
    alert('無法連線至伺服器，請檢查網路連線或稍後再試。')
  } finally {
    isLoading.value = false
  }
}

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
      if (profile && profile.displayName && !orderForm.value.payer.name) {
        orderForm.value.payer.name = profile.displayName
      }
      await loginBackendUser(profile)
    } else {
      liff.login()
      return
    }
  } catch (err) {
    console.warn('LIFF 初始化失敗:', err)
  }

  if (!orderForm.value.deliveryDate) {
    orderForm.value.deliveryDate = minDeliveryDateStr.value
  }

  if (route.query.tab === 'member') {
    activeTab.value = 'member'
  }

  const statusParam = route.query.status as string
  const orderNoParam = route.query.orderNo as string

  if (statusParam === 'success') {
    activeTab.value = 'member'
    alert(`🌸 付款成功！您的訂單編號：${orderNoParam || '已成立'} 已完成付款。`)
    window.history.replaceState({}, document.title, window.location.pathname)
  } else if (statusParam === 'failed' || statusParam === 'error') {
    alert('⚠️ 付款程序未完成或發生異常，請重新嘗試。')
    window.history.replaceState({}, document.title, window.location.pathname)
  }
})
</script>

<template>
  <div class="page-wrapper">
    <header class="brand-top-bar">
      <h1 class="brand-title">MONI Atelier 墨凝花室</h1>
      <button type="button" class="leave-line-btn" @click="handleReturnToLine">✕ 離開</button>
    </header>

    <nav class="main-tab-nav">
      <button 
        :class="['tab-nav-btn', { active: activeTab === 'shop' }]" 
        @click="activeTab = 'shop'"
      >
        💐 精選花禮選購
      </button>
      <button 
        :class="['tab-nav-btn', { active: activeTab === 'member' }]" 
        @click="activeTab = 'member'"
      >
        👤 會員中心 / 紅利查詢
      </button>
    </nav>

    <!-- ==================== TAB 1: 💐 精選花禮選購 ==================== -->
    <div v-if="activeTab === 'shop'" class="tab-main-container">
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

      <!-- 步驟一：選購商品 -->
      <div v-if="currentStep === 1" class="step-content">
        <section class="products-section">
          <h2 class="section-title">精選花藝作品</h2>
          
          <div class="category-filter-bar">
            <button 
              v-for="cat in categories" 
              :key="cat" 
              :class="['cat-filter-btn', { active: selectedCategory === cat }]"
              @click="selectedCategory = cat"
            >
              {{ cat }}
            </button>
          </div>

          <div v-if="loadingProducts" class="loading-state">🌸 正在為您載入最新花藝作品...</div>
          <div v-else-if="displayProducts.length === 0" class="loading-state">此分類目前尚無作品。</div>
          <div v-else class="product-grid">
            <div v-for="item in displayProducts" :key="getProductId(item)" class="product-card">
              <div class="image-wrapper" @click="openProductDetail(item)">
                <span 
                  v-if="item.badge" 
                  class="badge-no" 
                  :style="getBadgeStyle(item, 'badge')"
                >
                  {{ item.badge }}
                </span>
                <img :src="getProductImage(item)" :alt="item.name" />
                <span 
                  v-if="item.tag" 
                  class="tag-hot" 
                  :style="getBadgeStyle(item, 'tag')"
                >
                  {{ item.tag }}
                </span>
                <div class="view-detail-badge">🔍 查看詳情</div>
              </div>
              <div class="product-info">
                <span class="category">{{ item.category }}</span>
                <h3 class="product-name" @click="openProductDetail(item)">{{ item.name }}</h3>
                <p class="description">{{ item.description }}</p>
                <div class="divider"></div>
                <div class="card-footer">
                  <div class="price-box">
                    <span v-if="item.originalPrice && Number(item.originalPrice) > Number(item.price)" class="price-original">
                      NT$ {{ Number(item.originalPrice).toLocaleString() }}
                    </span>
                    <span class="price-val">
                      NT$ {{ Number(item.price || item.originalPrice).toLocaleString() }}
                    </span>
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

      <!-- 步驟二：訂單明細與結帳 -->
      <div v-if="currentStep === 2" class="step-content">
        <button class="back-btn" @click="currentStep = 1">← 返回選購商品</button>
        <section class="checkout-section">
          <div class="checkout-card">
            <h2 class="checkout-title">訂單明細與結帳</h2>
            
            <div class="cart-list">
              <div v-for="(qty, id) in cartStore.cart" :key="id" class="cart-item-row">
                <span class="item-name">{{ allProducts.find(p => String(getProductId(p)) === String(id))?.name || '精選花藝作品' }} x {{ qty }}</span>
                <span class="item-price">NT$ {{ (((allProducts.find(p => String(getProductId(p)) === String(id))?.price || allProducts.find(p => String(getProductId(p)) === String(id))?.originalPrice || 0)) * Number(qty)).toLocaleString() }}</span>
              </div>

              <div class="summary-box">
                <div class="summary-row"><span>商品小計</span><span>NT$ {{ cartTotalPrice.toLocaleString() }}</span></div>
                <div class="summary-row"><span>運費</span><span>{{ shippingFee === 0 ? '免運費' : `NT$ ${shippingFee}` }}</span></div>
                <div v-if="actualUsedPoints > 0" class="summary-row discount-row"><span>紅利折抵</span><span>- NT$ {{ actualUsedPoints }}</span></div>
              </div>
              
              <div class="total-row">
                <div class="total-label-box">
                  <span class="main-total-label">實付總金額</span>
                  <span class="earned-points-tip"> (完成訂單可獲得 🎁 {{ earnedPoints }} 點紅利)</span>
                </div>
                <span class="total-price">NT$ {{ finalTotalPrice.toLocaleString() }}</span>
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
                <select v-model="orderForm.deliveryMethod" class="styled-select">
                  <option value="black_cat">黑貓宅配 (運費 NT$300 / 滿 NT$4,500 免運)</option>
                  <option value="express_taipei_1">專人雙北配送1 (9:00-18:00不指定 / 運費 NT$300 / 滿 NT$4,500 免運)</option>
                  <option value="express_taipei_2">專人雙北配送2 (9:00-18:00不指定 / 運費 NT$500 / 滿 NT$4,500 免運)</option>
                  <option value="familymart">全家店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
                  <option value="seven_eleven">7-11店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
                </select>
                
                <div v-if="orderForm.deliveryMethod === 'express_taipei_1'" class="delivery-note">
                  📍 <strong>專人雙北配送1 可送區域：</strong><br />
                  松山區、信義區、大安區、中山區、中正區、大同區、萬華區、文山區、南港區、內湖區、士林區、北投區、板橋區、三重區、中和區、永和區、汐止區。
                </div>

                <div v-if="orderForm.deliveryMethod === 'express_taipei_2'" class="delivery-note">
                  📍 <strong>專人雙北配送2 可送區域：</strong><br />
                  新莊區、新店區、土城區、蘆洲區、樹林區、淡水區、林口區。
                </div>
              </div>

              <div v-if="['seven_eleven', 'familymart'].includes(orderForm.deliveryMethod)" class="form-section store-input-section">
                <h4 class="sub-section-title">🏪 填寫門市資訊</h4>
                <div class="form-group">
                  <label>門市名稱 *</label>
                  <input type="text" v-model="storeInput.name" :placeholder="storeNamePlaceholder" required class="styled-input" />
                </div>
                <div class="form-group">
                  <label>門市地址 *</label>
                  <input type="text" v-model="storeInput.address" placeholder="例如：台北市中山區南京東路二段100號" required class="styled-input" />
                </div>
              </div>

              <div class="form-section">
                <h4 class="sub-section-title">👤 付款人資訊</h4>
                <div class="form-group"><label>姓名 *</label><input type="text" v-model="orderForm.payer.name" required class="styled-input" /></div>
                <div class="form-group"><label>聯絡電話 *</label><input type="tel" v-model="orderForm.payer.phone" required class="styled-input" /></div>
                <div class="form-group"><label>Email *</label><input type="email" v-model="orderForm.payer.email" required class="styled-input" /></div>
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
                  <input type="text" v-model="orderForm.recipient.name" :disabled="sameAsPayer" required class="styled-input" />
                </div>
                <div class="form-group">
                  <label>聯絡電話 *</label>
                  <input type="text" v-model="orderForm.recipient.phone" :disabled="sameAsPayer" required class="styled-input" />
                </div>

                <div v-if="!['seven_eleven', 'familymart'].includes(orderForm.deliveryMethod)" class="form-group">
                  <label>聯絡地址 *</label>
                  <div class="address-group">
                    <select v-model="orderForm.recipient.city" required class="styled-select">
                      <option v-for="city in taiwanCities" :key="city" :value="city">{{ city }}</option>
                    </select>
                    <select v-model="orderForm.recipient.district" required class="styled-select">
                      <option v-for="dist in taiwanDistricts[orderForm.recipient.city] || []" :key="dist" :value="dist">{{ dist }}</option>
                    </select>
                  </div>
                  <input type="text" v-model="orderForm.recipient.address" placeholder="街道門牌資訊" required class="styled-input" style="margin-top: 8px;" />
                </div>
              </div>

              <!-- 會員紅利折抵 -->
              <div class="checkout-member-card">
                <div class="member-info-header">
                  <span class="user-label">👤 {{ lineProfile?.displayName || '會員' }} 的專屬紅利</span>
                  <span class="points-badge">目前點數：<strong>{{ userPoints }}</strong> 點 ($1點=$1元)</span>
                </div>

                <div class="points-deduct-row">
                  <label>折抵紅利：</label>
                  <input type="number" v-model.number="usedPointsInput" :max="userPoints" min="0" :placeholder="userPoints > 0 ? '0' : '餘額不足'" :disabled="userPoints <= 0" />
                  <span class="points-tip">折抵 NT$ {{ actualUsedPoints }} 元</span>
                </div>

                <div class="member-actions-row" v-if="!hasBirthday">
                  <button type="button" class="btn-member-action" @click="showBirthdayModal = true">
                    🎂 登錄生日領 $100 購物金
                  </button>
                </div>
              </div>

              <button type="submit" class="submit-btn" :disabled="isLoading || Object.keys(cartStore.cart).length === 0">
                {{ isLoading ? '處理中...' : `前往付款（NT$ ${finalTotalPrice.toLocaleString()}）` }}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>

    <!-- ==================== TAB 2: 👤 獨立會員中心 / 紅利專區 ==================== -->
    <div v-else-if="activeTab === 'member'" class="tab-main-container member-tab-wrapper">
      <div class="member-card-vip">
        <div class="card-top">
          <div class="avatar-box">
            <img :src="lineProfile?.pictureUrl || defaultAvatar" alt="會員頭像" class="user-avatar" />
          </div>
          <div class="user-meta">
            <h3 class="user-name">{{ lineProfile?.displayName || '墨凝尊榮會員' }}</h3>
            <span class="vip-badge">🌸 MONI VIP 會員</span>
          </div>
        </div>
        <div class="card-bottom">
          <span class="card-number">ID: {{ truncateId(lineProfile?.userId) }}</span>
        </div>
      </div>

      <div class="points-hero-card">
        <div class="points-header">
          <span class="hero-label">目前累積紅利點數</span>
          <button class="btn-rules-info" @click="showPointsRules = !showPointsRules">💡 紅利說明</button>
        </div>
        <div class="points-amount-display">
          <span class="symbol">$</span>
          <span class="amount">{{ userPoints || 0 }}</span>
          <span class="unit">點</span>
        </div>
        <p class="points-note">✨ 結帳時 1 點可折抵現金 NT$ 1 元</p>

        <div v-if="showPointsRules" class="points-rules-dropdown">
          <h4>🌸 墨凝花室紅利回饋機制：</h4>
          <ul>
            <li><strong>首購禮：</strong>首次加入 LINE 會員即贈 100 點紅利購物金。</li>
            <li><strong>生日禮：</strong>登錄生日日期，生日當月享專屬 $100 生日購物金。</li>
            <li><strong>消費回饋：</strong>單筆實付金額滿 NT$ 100 即可累積 1 點紅利。</li>
            <li><strong>好友推薦：</strong>成功推薦好友加入註冊下單，可獲得 $50 點獎勵。</li>
          </ul>
        </div>
      </div>

      <div class="member-feature-card">
        <div class="feature-card-header">
          <h3>🎂 生日禮登錄專區</h3>
          <span class="bonus-tag">贈 $100 購物金</span>
        </div>
        <p class="feature-desc">登記您的生日完整日期（年月日），生日當月將自動發放專屬 $100 紅利購物金！</p>
        
        <div v-if="hasBirthday" class="birthday-status-box">
          <p>已登記生日：<strong>{{ userBirthday }}</strong></p>
          <span class="registered-tag">✓ 已完成登記</span>
        </div>
        <div v-else class="birthday-input-box">
          <input type="date" v-model="userBirthday" class="date-picker-input" />
          <button class="btn-save-birthday" @click="saveBirthday">確認登記領取</button>
        </div>
      </div>

      <div class="member-feature-card">
        <div class="feature-card-header">
          <h3>🔗 推薦好友獨享禮</h3>
          <span class="bonus-tag">雙方獲 $50 點</span>
        </div>
        <p class="feature-desc">分享您的專屬推薦連結給朋友，好友首購成功後，您與好友皆可獲得 $50 紅利點數！</p>
        <button class="btn-copy-referral" @click="copyReferralLink">
          {{ isCopyReferralSuccess ? '已成功複製推薦網址！' : '一鍵複製我的專屬推薦連結 📋' }}
        </button>
      </div>

      <div class="member-orders-section">
        <div class="section-title-bar">
          <h3>📦 我的歷史訂單紀錄</h3>
          <button class="btn-refresh-orders" @click="fetchMyOrders">🔄 重新整理</button>
        </div>

        <div v-if="loadingOrders" class="orders-loading">🌸 正在查詢您的歷史訂單...</div>
        <div v-else-if="myOrders.length === 0" class="orders-empty">
          <p>您目前尚無歷史訂單紀錄。</p>
          <button class="btn-go-shop" @click="activeTab = 'shop'">前往挑選花禮 💐</button>
        </div>

        <div v-else class="user-orders-list">
          <div v-for="order in myOrders" :key="order.merchantOrderNo" class="user-order-card">
            <div class="order-card-header">
              <span class="order-id">單號：{{ order.merchantOrderNo }}</span>
              <span class="order-status-badge" :class="order.status">{{ formatStatus(order.status) }}</span>
            </div>

            <div class="order-card-body">
              <p class="delivery-date">📅 希望送達日：<strong>{{ order.deliveryDate || '未指定' }}</strong></p>
              <p class="delivery-type">🚚 配送方式：{{ formatDeliveryMethod(order.deliveryMethod) }}</p>
              
              <div class="cart-summary-preview">
                <p><strong>購買項目：</strong>{{ getCartItemsText(order.cart) }}</p>
              </div>

              <div class="order-price-line">
                <span>實付總金額：</span>
                <span class="amount-highlight">NT$ {{ order.totalAmount?.toLocaleString() }}</span>
                <span v-if="order.usedPoints > 0" class="used-pts">(已折抵 {{ order.usedPoints }} 點)</span>
              </div>
            </div>
            <div class="order-card-footer">
              <span class="created-time">下單時間：{{ formatDate(order.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 🛒 購物車 Drawer Modal -->
    <div v-if="showCartDrawer" class="modal-backdrop" @click.self="showCartDrawer = false">
      <div class="cart-drawer-modal">
        <div class="drawer-header">
          <h3>🛒 購物車內容</h3>
          <button type="button" class="close-icon-btn" @click="showCartDrawer = false">✕</button>
        </div>
        <div class="drawer-body">
          <div v-if="Object.keys(cartStore.cart).length === 0" class="empty-cart">購物車內沒有商品</div>
          <div v-else class="drawer-item-list">
            <div v-for="(qty, id) in cartStore.cart" :key="id" class="drawer-cart-item">
              <div class="drawer-item-info">
                <span class="drawer-item-name">{{ allProducts.find(p => String(getProductId(p)) === String(id))?.name || '精選花藝作品' }}</span>
                <span class="drawer-item-price">NT$ {{ (((allProducts.find(p => String(getProductId(p)) === String(id))?.price || allProducts.find(p => String(getProductId(p)) === String(id))?.originalPrice || 0)) * Number(qty)).toLocaleString() }}</span>
              </div>
              <div class="quantity-control">
                <button type="button" class="qty-btn" @click="cartStore.removeFromCart(id)">-</button>
                <span class="qty-num">{{ qty }}</span>
                <button type="button" class="qty-btn" @click="cartStore.addToCart(id)">+</button>
              </div>
            </div>
          </div>
        </div>
        <div class="drawer-footer">
          <button type="button" class="confirm-drawer-btn" @click="showCartDrawer = false">完成編輯</button>
        </div>
      </div>
    </div>

    <!-- 🔍 商品詳情 Modal -->
    <div v-if="selectedProductDetail" class="modal-backdrop" @click.self="closeProductDetail">
      <div class="product-detail-modal">
        <button type="button" class="close-icon-btn close-detail-btn" @click="closeProductDetail">✕</button>
        <div class="detail-image-wrapper">
          <img :src="getProductImage(selectedProductDetail)" :alt="selectedProductDetail.name" />
        </div>
        <div class="detail-body">
          <span class="category">{{ selectedProductDetail.category }}</span>
          <h2>{{ selectedProductDetail.name }}</h2>
          <p class="detail-desc">{{ selectedProductDetail.description }}</p>
          <div class="detail-footer">
            <div class="detail-price-box">
              <span v-if="selectedProductDetail.originalPrice && Number(selectedProductDetail.originalPrice) > Number(selectedProductDetail.price)" class="price-original">
                NT$ {{ Number(selectedProductDetail.originalPrice).toLocaleString() }}
              </span>
              <span class="detail-price">
                NT$ {{ Number(selectedProductDetail.price || selectedProductDetail.originalPrice).toLocaleString() }}
              </span>
            </div>
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
          <button type="button" class="close-icon-btn" @click="showPolicyModal = false">✕</button>
        </div>
        
        <div class="policy-modal-body scrollable-policy">
          <p class="policy-intro">
            歡迎光臨「墨凝花室」（以下簡稱本店）。<br />
            為了保障您的權益，在進行訂購前，請仔細閱讀以下服務條款、出貨說明、退換貨政策及隱私權保護聲明：
          </p>

          <h4 class="policy-section-title">一、 出貨天數與配送說明</h4>
          <p><strong>製作與出貨時間：</strong></p>
          <ul>
            <li>本店花藝商品（包含手作、永生花/乾燥花及客製化作品）皆為收到訂單與付款後開始製作。</li>
            <li>一般商品於完成付款後 3 至 7 個工作天內（不含例假日）製作完成並出貨。</li>
            <li>客製化商品或大宗花禮，出貨天數為 5 至 10 個工作天，具體交期以雙方確認之溝通內容為準。</li>
          </ul>
          <p><strong>配送方式與時間：</strong></p>
          <ul>
            <li>寄出後，宅配運送時間約 1 至 2 個工作天，超商取貨約 2 至 3 個工作天（實際配送進度依物流公司公告為準）。</li>
          </ul>

          <h4 class="policy-section-title">二、 消費者權益與退換貨政策（鑑賞期說明）</h4>
          <p><strong>客製化商品不適用 7 天鑑賞期：</strong></p>
          <p>依據《消費者保護法》第 19 條第 1 項但書及《通訊交易解除權合理例外情事適用準則》第 2 條規定，本店所販售之「依消費者要求所為之客製化給付商品」及「易於腐敗、保存期限較短或解約時即將逾期之花卉植物」，不適用 7 天鑑賞期（猶豫期）之規定，訂單成立後概不接受退換貨。</p>
          <p><strong>瑕疵與破損處理：</strong></p>
          <ul>
            <li>花藝商品運送過程可能因震動有些微花瓣掉落，此屬正常現象。</li>
            <li>若您收到商品時有嚴重的箱體毀損、商品本體重大瑕疵或品項不符之情況，請於收到商品 24 小時內拍照/錄影存證，並透過客服與我們聯繫，我們將儘速為您辦理補件或補換貨事宜。</li>
          </ul>

          <h4 class="policy-section-title">三、 服務條款</h4>
          <ul>
            <li>本店商品多數包含天然植物與手作成分，姿態、顏色與照片有些微差異屬正常現象。如遇花材缺貨，本店保留在維護整體設計美感的前提下，更換等值或相似花材之權利。</li>
            <li>訂購人有義務提供正確、完整之收件人資訊，若因填寫資訊錯誤導致無法配送或退回，相關再發送之運費須由買家自行負擔。</li>
          </ul>

          <h4 class="policy-section-title">四、 隱私權政策</h4>
          <p><strong>個人資料蒐集與使用：</strong></p>
          <p>本店僅於處理商品訂購、運送配送、顧客服務及付款確認之目的範圍內，蒐集您的個人資料（包含姓名、電話、地址、Email 等）。</p>
          <p><strong>資料安全與保密：</strong></p>
          <p>本店絕不會將您的個人資料出售、出租、交換或提供給任何第三方，亦不作其他非法用途。</p>
          <p><strong>金流交易安全：</strong></p>
          <p>本店線上付款流程串接「藍新金流 NewebPay」，交易過程採用加密傳輸保護，本店不會記錄或留存您的信用卡號等敏感金融資訊。</p>
        </div>

        <div class="policy-modal-footer">
          <label class="agree-checkbox-label">
            <input type="checkbox" v-model="hasAgreedPolicy" />
            <span>我已完整閱讀並同意上述所有條款</span>
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
        <h3>🎂 紀錄生日日期</h3>
        <p style="font-size: 0.85rem; color: #666; margin-bottom: 12px;">登記您的出生年月日，生日當月開啟選購即可自動領取 $100 元生日購物金！</p>
        <input type="date" v-model="userBirthday" style="width:100%; padding:8px; margin-bottom:12px; border:1px solid #ccc; border-radius:4px;" />
        <button class="confirm-pay-btn" @click="saveBirthday">儲存生日日期</button>
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

    <!-- 🎉 訂單成立 Modal 彈窗 -->
    <div v-if="showSuccessModal" class="modal-backdrop">
      <div class="calendar-modal" style="text-align: center; padding: 1.5rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
        <h3 style="color: #34444E; font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem;">訂單成立成功！</h3>
        <p style="font-size: 0.88rem; color: #4A5568; line-height: 1.6; margin-bottom: 1.2rem;">
          訂單編號：<strong style="color: #102A43;">{{ successOrderNo }}</strong><br />
          感謝您的訂購！墨凝花室已收到您的款項與訂單，將儘速為您精心製作花藝作品 ✨
        </p>
        <button class="confirm-pay-btn" @click="closeSuccessAndReturn">
          🌸 完成訂單，返回 LINE 聊天室
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.page-wrapper { display: flex; flex-direction: column; gap: 1rem; }

/* 🌸 頂部品牌 Bar */
.brand-top-bar { display: flex; justify-content: space-between; align-items: center; background: #34444E; color: #ffffff; padding: 12px 16px; border-radius: 8px; }
.brand-title { margin: 0; font-size: 1.1rem; font-weight: 300; letter-spacing: 2px; }
.leave-line-btn { background: rgba(255,255,255,0.15); color: #fff; border: none; padding: 4px 10px; border-radius: 12px; font-size: 0.78rem; cursor: pointer; }

/* 🌸 頂部主選單 Tab */
.main-tab-nav { display: flex; background: #ffffff; border-radius: 10px; padding: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); gap: 4px; }
.tab-nav-btn { flex: 1; padding: 10px; border: none; background: transparent; font-weight: bold; font-size: 0.88rem; color: #718096; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
.tab-nav-btn.active { background: #34444E; color: #ffffff; }

.section-title { color: #FFFFFF; font-size: 1.25rem; font-weight: bold; margin-bottom: 0.8rem; }
.loading-state { text-align: center; color: #FFFFFF; padding: 2rem; }

/* 🌸 分類標籤樣式（支援水平滑動） */
.category-filter-bar { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 16px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.category-filter-bar::-webkit-scrollbar { display: none; }
.cat-filter-btn { white-space: nowrap; padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.1); color: #E2E8F0; font-size: 0.82rem; cursor: pointer; transition: all 0.2s; }
.cat-filter-btn.active { background: #ffffff; color: #34444E; border-color: #ffffff; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }

.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.2rem; }
.product-card { background: #FFFFFF; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }

.image-wrapper { position: relative !important; width: 100%; aspect-ratio: 3/4; background: #34444E; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
.image-wrapper img { width: 100%; height: 100%; object-fit: contain; }

.badge-no { position: absolute; top: 10px; left: 10px; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.tag-hot { position: absolute; bottom: 10px; right: 10px; padding: 2px 10px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); white-space: nowrap; }
.view-detail-badge { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.65); color: #FFF; font-size: 0.75rem; padding: 3px 8px; border-radius: 20px; z-index: 5; backdrop-filter: blur(2px); }

.product-info { padding: 1rem; display: flex; flex-direction: column; flex-grow: 1; text-align: center; color: #2D3748; }
.product-name { font-size: 1.05rem; margin: 0.3rem 0; color: #2D3748; cursor: pointer; }
.description { font-size: 0.82rem; color: #718096; line-height: 1.4; height: 36px; overflow: hidden; }
.card-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; }

.price-box { display: flex; align-items: baseline; gap: 6px; text-align: left; }
.price-original { text-decoration: line-through; color: #a0aec0; font-size: 0.8rem; }
.price-val { font-size: 1.05rem; font-weight: bold; color: #8B5E4C; }
.add-btn { background: #F7F9FA; color: #34444E; border: 1px solid #34444E; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: bold; cursor: pointer; }

.step-indicator { display: flex; align-items: center; justify-content: center; gap: 1rem; background: #FFFFFF; padding: 0.8rem; border-radius: 8px; }
.step-item { cursor: pointer; opacity: 0.5; color: #333; }
.step-item.active { opacity: 1; font-weight: bold; }
.step-num { display: inline-block; width: 24px; height: 24px; line-height: 24px; border-radius: 50%; background: #CBD5E1; text-align: center; margin-right: 4px; }
.step-item.active .step-num { background: #34444E; color: #FFF; }
.step-line { width: 30px; height: 2px; background: #CBD5E1; }

.cart-floating-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 500px; background: #34444E; color: #FFFFFF; padding: 0.8rem 1.2rem; border-radius: 50px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 1000; }
.bar-info { display: flex; flex-direction: column; font-size: 0.88rem; cursor: pointer; }
.bar-price { font-size: 0.78rem; color: #CBD5E1; }
.next-step-btn { background: #FFFFFF; color: #34444E; border: none; padding: 0.5rem 1rem; border-radius: 20px; font-weight: bold; cursor: pointer; }

.checkout-card { background: #FFFFFF; padding: 1.5rem; border-radius: 12px; color: #2D3748; }
.checkout-title { font-size: 1.25rem; color: #34444E; font-weight: bold; margin-bottom: 1.2rem; text-align: center; }
.cart-item-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 0.95rem; margin-bottom: 12px; color: #2D3748; }

.checkout-member-card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 1rem; border-radius: 10px; margin: 1.2rem 0; display: flex; flex-direction: column; gap: 10px; }
.member-info-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; flex-wrap: wrap; gap: 6px; }
.user-label { font-weight: bold; color: #34444E; }
.points-badge { color: #D97706; font-weight: bold; }
.points-deduct-row { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; }
.points-deduct-row input { width: 80px; padding: 6px; border: 1px solid #CBD5E1; border-radius: 6px; }
.points-tip { font-weight: bold; color: #B45309; }
.member-actions-row { display: flex; gap: 8px; margin-top: 4px; }
.btn-member-action { flex: 1; background: #FFFFFF; border: 1px solid #34444E; color: #34444E; padding: 8px; border-radius: 6px; font-size: 0.78rem; font-weight: bold; cursor: pointer; }

.member-tab-wrapper { display: flex; flex-direction: column; gap: 14px; }
.member-card-vip { background: linear-gradient(135deg, #34444e 0%, #243b53 100%); color: #ffffff; border-radius: 16px; padding: 20px; box-shadow: 0 6px 16px rgba(36, 59, 83, 0.25); }
.card-top { display: flex; align-items: center; gap: 14px; }
.avatar-box { width: 52px; height: 52px; border-radius: 50%; border: 2px solid #ffffff; overflow: hidden; background: #ffffff; }
.user-avatar { width: 100%; height: 100%; object-fit: cover; }
.user-meta { display: flex; flex-direction: column; gap: 2px; }
.user-name { margin: 0; font-size: 1.1rem; }
.vip-badge { background: #e2e8f0; color: #34444e; font-size: 0.7rem; font-weight: bold; padding: 2px 8px; border-radius: 10px; width: fit-content; }
.card-bottom { border-top: 1px solid rgba(255,255,255,0.15); margin-top: 14px; padding-top: 8px; text-align: right; font-family: monospace; font-size: 0.8rem; opacity: 0.8; }

.points-hero-card { background: #ffffff; border-radius: 16px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
.points-header { display: flex; justify-content: space-between; align-items: center; }
.hero-label { font-size: 0.85rem; color: #718096; font-weight: bold; }
.btn-rules-info { background: #edf2f7; border: none; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; color: #4a5568; cursor: pointer; }
.points-amount-display { margin: 12px 0 4px 0; display: flex; align-items: baseline; gap: 4px; color: #8b5e4c; }
.points-amount-display .symbol { font-size: 1.2rem; font-weight: bold; }
.points-amount-display .amount { font-size: 2.5rem; font-weight: 800; line-height: 1; }
.points-amount-display .unit { font-size: 0.9rem; color: #718096; }
.points-note { margin: 0; font-size: 0.8rem; color: #718096; }

.points-rules-dropdown { background: #f8fafc; border-radius: 10px; padding: 12px; margin-top: 12px; font-size: 0.8rem; color: #4a5568; text-align: left; }
.points-rules-dropdown h4 { margin: 0 0 6px 0; color: #34444e; }
.points-rules-dropdown ul { margin: 0; padding-left: 18px; }
.points-rules-dropdown li { margin-bottom: 4px; }

.member-feature-card { background: #ffffff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; text-align: left; }
.feature-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.feature-card-header h3 { margin: 0; font-size: 0.95rem; color: #2d3748; }
.bonus-tag { background: #fef3c7; color: #92400e; font-size: 0.72rem; font-weight: bold; padding: 2px 8px; border-radius: 10px; }
.feature-desc { font-size: 0.8rem; color: #718096; margin: 0 0 12px 0; line-height: 1.4; }

.birthday-input-box { display: flex; gap: 8px; }
.date-picker-input { flex: 1; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 0.85rem; }
.btn-save-birthday { background: #34444e; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer; }
.birthday-status-box { display: flex; justify-content: space-between; align-items: center; background: #f0fff4; padding: 10px; border-radius: 6px; font-size: 0.85rem; }
.registered-tag { color: #38a169; font-weight: bold; font-size: 0.8rem; }

.btn-copy-referral { width: 100%; background: #edf2f7; color: #2d3748; border: 1px solid #cbd5e0; padding: 10px; border-radius: 8px; font-weight: bold; font-size: 0.82rem; cursor: pointer; }

.member-orders-section { margin-top: 10px; text-align: left; }
.section-title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-title-bar h3 { margin: 0; font-size: 1rem; color: #ffffff; }
.btn-refresh-orders { background: none; border: none; color: #e2e8f0; font-size: 0.8rem; cursor: pointer; }

.user-order-card { background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 14px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); color: #333; }
.order-card-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 0.85rem; margin-bottom: 8px; }
.order-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; }
.order-status-badge.completed { background: #c6f6d5; color: #22543d; }
.order-status-badge.PAID { background: #ebf8ff; color: #2b6cb0; }
.order-status-badge.PENDING { background: #feebc8; color: #744210; }

.order-card-body p { margin: 4px 0; font-size: 0.82rem; color: #4a5568; }
.cart-summary-preview { background: #f8fafc; padding: 8px; border-radius: 6px; margin: 8px 0; font-size: 0.8rem; }
.order-price-line { margin-top: 8px; font-size: 0.88rem; font-weight: bold; display: flex; align-items: center; gap: 4px; }
.amount-highlight { color: #8b5e4c; font-size: 1rem; }
.used-pts { font-size: 0.75rem; color: #d97706; font-weight: normal; }
.order-card-footer { border-top: 1px dashed #e2e8f0; margin-top: 8px; padding-top: 6px; font-size: 0.72rem; color: #a0aec0; text-align: right; }

.orders-loading, .orders-empty { text-align: center; padding: 30px; background: #ffffff; border-radius: 12px; color: #718096; }
.btn-go-shop { margin-top: 10px; background: #34444e; color: #fff; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; }

.delivery-note { background: #FEF3C7; border: 1px solid #FCD34D; color: #92400E; padding: 0.8rem; border-radius: 6px; font-size: 0.82rem; line-height: 1.5; margin-top: 8px; text-align: left; }

.summary-box { background: #FAF9F6; padding: 12px; border-radius: 8px; margin: 12px 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; }
.summary-row { display: flex; justify-content: space-between; color: #4A5568; }
.discount-row { color: #D97706; font-weight: bold; }
.total-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 2px solid #E2E8F0; margin-top: 8px; }
.total-label-box { display: flex; flex-direction: column; text-align: left; }
.main-total-label { font-size: 1rem; font-weight: bold; color: #2D3748; }
.earned-points-tip { font-size: 0.75rem; color: #059669; }
.total-price { font-size: 1.25rem; font-weight: bold; color: #8B5E4C; }

.form-subtitle { font-size: 1.05rem; color: #34444E; font-weight: bold; margin: 1.2rem 0 0.8rem; text-align: left; }
.form-group { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 0.88rem; text-align: left; }
.styled-input, .styled-select, .custom-date-trigger { width: 100%; padding: 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; }
.custom-date-trigger { background: #F8FAFC; cursor: pointer; }
.address-group { display: flex; gap: 8px; }
.submit-btn { width: 100%; background: #34444E; color: #FFF; padding: 1rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer; margin-top: 1.5rem; }
.back-btn { background: none; border: 1px solid #FFF; color: #FFF; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; margin-bottom: 1rem; width: fit-content; }

.modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.cart-drawer-modal { background: #FFFFFF; border-radius: 16px; padding: 1.2rem; width: 90%; max-width: 400px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); }
.drawer-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 0.8rem; margin-bottom: 1rem; }
.drawer-header h3 { margin: 0; font-size: 1.1rem; color: #34444E; font-weight: bold; }
.close-icon-btn { background: none; border: none; font-size: 1.2rem; color: #718096; cursor: pointer; padding: 4px 8px; }
.empty-cart { text-align: center; padding: 1.5rem 0; color: #A0AEC0; font-size: 0.9rem; }
.drawer-item-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 1rem; max-height: 250px; overflow-y: auto; }
.drawer-cart-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #E2E8F0; }
.drawer-item-info { display: flex; flex-direction: column; gap: 2px; text-align: left; }
.drawer-item-name { font-size: 0.95rem; font-weight: bold; color: #2D3748; }
.drawer-item-price { font-size: 0.85rem; color: #8B5E4C; font-weight: bold; }
.quantity-control { display: flex; align-items: center; gap: 8px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 20px; padding: 2px 8px; }
.qty-btn { background: none; border: none; font-size: 1rem; font-weight: bold; color: #34444E; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.qty-num { font-size: 0.9rem; font-weight: bold; color: #2D3748; min-width: 16px; text-align: center; }
.drawer-footer { border-top: 1px solid #E2E8F0; padding-top: 0.8rem; }
.confirm-drawer-btn { width: 100%; background: #34444E; color: #FFFFFF; border: none; padding: 0.8rem; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; }

.product-detail-modal { background: #FFF; border-radius: 16px; max-width: 440px; width: 90%; max-height: 85vh; overflow-y: auto; position: relative; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.close-detail-btn { position: absolute; top: 12px; right: 12px; z-index: 10; background: rgba(0,0,0,0.5); color: #fff; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.detail-image-wrapper { width: 100%; height: 280px; background: #34444E; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.detail-image-wrapper img { width: 100%; height: 100%; object-fit: contain; }
.detail-body { padding: 1.2rem; text-align: left; display: flex; flex-direction: column; gap: 8px; }
.detail-body h2 { margin: 4px 0; font-size: 1.2rem; color: #2D3748; }
.detail-desc { font-size: 0.88rem; color: #4A5568; line-height: 1.6; white-space: pre-line; margin: 8px 0; }
.detail-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid #E2E8F0; }
.detail-price-box { display: flex; align-items: baseline; gap: 6px; }
.detail-price { font-size: 1.2rem; font-weight: bold; color: #8B5E4C; }

.policy-modal { background: #FFFFFF; border-radius: 16px; padding: 1.2rem 1.5rem; max-width: 440px; width: 90%; max-height: 85vh; color: #333333; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); }
.policy-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 0.8rem; flex-shrink: 0; }
.policy-modal-header h3 { margin: 0; font-size: 1.05rem; font-weight: bold; color: #34444E; }
.scrollable-policy { overflow-y: auto; max-height: 380px; padding: 0.8rem 0; font-size: 0.85rem; color: #4A5568; line-height: 1.6; text-align: left; }
.scrollable-policy ul { padding-left: 1.2rem; margin: 4px 0 10px; }
.scrollable-policy li { margin-bottom: 4px; }
.policy-intro { margin-bottom: 10px; font-weight: 500; }
.policy-section-title { font-size: 0.92rem; color: #34444E; font-weight: bold; margin: 12px 0 6px; border-left: 3px solid #34444E; padding-left: 6px; }
.policy-modal-footer { display: flex; flex-direction: column; gap: 0.8rem; border-top: 1px solid #E2E8F0; padding-top: 0.8rem; flex-shrink: 0; }
.agree-checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: bold; color: #2D3748; cursor: pointer; user-select: none; }
.agree-checkbox-label input { width: 18px; height: 18px; cursor: pointer; }

.calendar-modal { background: #FFF; border-radius: 12px; padding: 1.2rem; max-width: 400px; width: 90%; color: #333; }
.confirm-pay-btn { width: 100%; padding: 0.8rem; background: #34444E; color: #FFF; border: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; }
.confirm-pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.close-modal-btn { width: 100%; padding: 6px; background: #E2E8F0; border: none; border-radius: 4px; cursor: pointer; }
.month-nav-btn { background: none; border: none; font-size: 18px; cursor: pointer; }
.calendar-day-btn { width: 100%; height: 32px; border: none; background: transparent; cursor: pointer; }
.calendar-day-btn.selected { background: #34444E; color: #FFF; border-radius: 50%; }
.calendar-day-btn.disabled { opacity: 0.3; cursor: not-allowed; }
</style>