<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const isCopyReferralSuccess = ref(false)

// --- 🎯 API 後端基礎網址設定 ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://moni-atelier-backend.onrender.com'

const route = useRoute()
const router = useRouter()
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
  const now = new Date(); now.setDate(1); now.setHours(0,0,0,0)
  const maxMonth = new Date(maxDeliveryDate.value); maxMonth.setDate(1); maxMonth.setHours(23,59,59,999)
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

// 🎯 商品動態讀取
const allProducts = ref<Product[]>([])
const loadingProducts = ref(true)
const displayProducts = computed(() => allProducts.value.filter(p => !p.isHidden))

const fetchProducts = async () => {
  loadingProducts.value = true
  try {
    let targetBase = (import.meta.env.VITE_API_BASE_URL || API_BASE).replace(/\/$/, '')
    const res = await fetch(`${targetBase}/api/products`)
    const data = await res.json()
    if (data.status === 'success' && data.products) {
      allProducts.value = data.products.map((p: any) => ({ ...p, id: p._id || p.id, image: p.imageUrl || p.image }))
    }
  } catch (err) {
    console.warn('❌ 抓取商品失敗:', err)
  } finally {
    loadingProducts.value = false
  }
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

// 限制可使用的最多紅利點數
const actualUsedPoints = computed(() => {
  const maxAllow = Math.min(userPoints.value, cartTotalPrice.value)
  return Math.max(0, Math.min(usedPointsInput.value, maxAllow))
})

const finalTotalPrice = computed(() => Math.max(0, cartTotalPrice.value + shippingFee.value - actualUsedPoints.value))

// 預計本次可獲得點數（滿 $100 得 1 點）
const earnedPoints = computed(() => Math.floor(finalTotalPrice.value / 100))

// 複製個人專屬好友推薦連結
const copyReferralLink = () => {
  if (!lineProfile.value?.userId) return
  const link = `${window.location.origin}/?ref=${lineProfile.value.userId}`
  navigator.clipboard.writeText(link)
  isCopyReferralSuccess.value = true
  setTimeout(() => { isCopyReferralSuccess.value = false }, 3000)
}

// 儲存生日領取紅利
const saveBirthday = async () => {
  if (!userBirthday.value || !lineProfile.value?.userId) return
  try {
    let targetBase = (import.meta.env.VITE_API_BASE_URL || API_BASE).replace(/\/$/, '')
    const res = await fetch(`${targetBase}/api/users/birthday`, {
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

  // 自動加購 URL 監聽 (?add=ID1,ID2)
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

      // 向後端登入/同步會員，取得紅利點數
      let targetBase = (import.meta.env.VITE_API_BASE_URL || API_BASE).replace(/\/$/, '')
      const userRes = await fetch(`${targetBase}/api/users/login`, {
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
        usedPointsInput.value = userPoints.value // 預設帶入最多可折扣點數
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

    let targetBase = (import.meta.env.VITE_API_BASE_URL || API_BASE).replace(/\/$/, '')
    const response = await fetch(`${targetBase}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: cartStore.cart,
        subtotal: cartTotalPrice.value,
        shippingFee: shippingFee.value,
        usedPoints: actualUsedPoints.value, // 本次折抵紅利點數
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
    <!-- 🌸 會員資訊與紅利頂部列 -->
    <div v-if="lineProfile" class="user-member-bar">
      <div class="member-info">
        <span class="user-name">👤 {{ lineProfile.displayName }}</span>
        <span class="points-badge">🎁 剩餘紅利：<strong>{{ userPoints }}</strong> 點 ($1點=$1元)</span>
      </div>
      <div class="member-actions">
        <button class="small-btn" @click="showBirthdayModal = true">🎂 填生日領100點</button>
        <button class="small-btn" @click="copyReferralLink">🔗 {{ isCopyReferralSuccess ? '已複製推薦連結！' : '推薦好友' }}</button>
      </div>
    </div>

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
          <h2 class="section-title">訂單明細與結帳</h2>
          
          <div class="cart-list">
            <div v-for="(qty, id) in cartStore.cart" :key="id" class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-name">{{ allProducts.find(p => String(getProductId(p)) === String(id))?.name || '精選花藝作品' }}</div>
                <div class="cart-item-price">新台幣 {{ ((allProducts.find(p => String(getProductId(p)) === String(id))?.price || 0) * Number(qty)).toLocaleString() }} 元</div>
              </div>
            </div>

            <!-- 🎁 紅利點數折抵區塊 -->
            <div v-if="userPoints > 0" class="points-discount-box">
              <div class="points-header">
                <span>🎁 使用紅利點數折抵 (可用 {{ userPoints }} 點)</span>
              </div>
              <div class="points-input-row">
                <input type="number" v-model.number="usedPointsInput" :max="userPoints" min="0" placeholder="輸入折抵點數" />
                <span class="points-tip">折抵 NT$ {{ actualUsedPoints }} 元</span>
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

            <div class="form-section">
              <h4 class="sub-section-title">👤 付款人資訊</h4>
              <div class="form-group"><label>姓名 *</label><input type="text" v-model="orderForm.payer.name" required /></div>
              <div class="form-group"><label>聯絡電話 *</label><input type="tel" v-model="orderForm.payer.phone" required /></div>
              <div class="form-group"><label>Email *</label><input type="email" v-model="orderForm.payer.email" required /></div>
            </div>

            <button type="submit" class="submit-btn" :disabled="isLoading || Object.keys(cartStore.cart).length === 0">
              前往付款（新台幣 {{ finalTotalPrice.toLocaleString() }} 元）
            </button>
          </form>
        </div>
      </section>
    </div>

    <!-- 🎂 生日領取紅利 Modal -->
<div v-if="showBirthdayModal" class="modal-backdrop" @click.self="showBirthdayModal = false">
  <div class="calendar-modal">
    <h3>🎂 紀錄生日月份</h3>
    <p style="font-size: 0.85rem; color: #666; margin-bottom: 12px;">
      於您的生日當月開啟選購，即可自動領取 $100 元生日購物金（可直接折抵下單）！
    </p>
    <input 
      type="date" 
      v-model="userBirthday" 
      style="width:100%; padding:8px; margin-bottom:12px; border:1px solid #ccc; border-radius:4px;" 
    />
    <button class="confirm-pay-btn" @click="saveBirthday">儲存生日月份</button>
  </div>
</div>

  </div>
</template>

<style scoped>
.user-member-bar {
  background: #34444E;
  color: #FFF;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.88rem;
}
.member-info { display: flex; flex-direction: column; gap: 2px; }
.points-badge { color: #FCD34D; font-weight: bold; }
.member-actions { display: flex; gap: 6px; }
.small-btn {
  background: #FFFFFF;
  color: #34444E;
  border: none;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: bold;
  cursor: pointer;
}
.points-discount-box {
  background: #FEF3C7;
  border: 1px solid #FDE68A;
  padding: 0.8rem;
  border-radius: 6px;
  margin: 1rem 0;
}
.points-header { font-weight: bold; color: #92400E; font-size: 0.88rem; margin-bottom: 6px; }
.points-input-row { display: flex; align-items: center; gap: 10px; }
.points-input-row input { width: 110px; padding: 6px; border: 1px solid #F59E0B; border-radius: 4px; }
.points-tip { font-size: 0.85rem; color: #B45309; font-weight: bold; }
.discount-row { color: #D97706; font-weight: bold; }
.earned-points-tip { font-size: 0.8rem; color: #059669; font-weight: normal; }

/* 延用原本簡潔質感風格 */
.page-wrapper { display: flex; flex-direction: column; gap: 1.5rem; }
.step-indicator { display: flex; align-items: center; justify-content: center; gap: 1rem; background: #FFF; padding: 1rem; border-radius: 8px; }
.step-item { cursor: pointer; opacity: 0.5; }
.step-item.active { opacity: 1; font-weight: bold; }
.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; }
.product-card { background: #FFF; border-radius: 12px; overflow: hidden; border: 1px solid #F3EBE6; display: flex; flex-direction: column; }
.image-wrapper { aspect-ratio: 3/4; background: #34444E; display: flex; align-items: center; justify-content: center; position: relative; }
.image-wrapper img { width: 100%; height: 100%; object-fit: contain; }
.add-btn { background: #F7F9FA; color: #34444E; border: 1px solid #34444E; padding: 0.5rem 0.8rem; border-radius: 6px; cursor: pointer; }
.submit-btn { width: 100%; background: #34444E; color: #FFF; padding: 0.9rem; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
</style>